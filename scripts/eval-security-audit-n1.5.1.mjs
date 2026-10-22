// nusamind-audit-ignore-file: memuat contoh kerentanan sebagai string uji untuk pemindai ini sendiri
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as nodeModule from 'node:module';

const cases = JSON.parse(fs.readFileSync('data/benchmarks/security-audit-cases.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (typeof nodeModule.registerHooks !== 'function') {
  console.log(JSON.stringify({ ok: false, reason: 'modul lib dimuat langsung dan memerlukan Node >= 22.18' }, null, 2));
  process.exit(2);
}
nodeModule.registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (error) {
      if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const lib = (p) => new URL(`../lib/${p}`, import.meta.url).href;
const audit = await import(lib('security-audit.ts'));
const rulesMod = await import(lib('security-audit-rules.ts'));
const partner = await import(lib('cyber-partner.ts'));

// Rahasia uji dibangun saat runtime agar berkas JSON dan skrip ini tidak memuat pola kredensial utuh.
const SECRETS = {
  '{{AWS}}': ['AKIA', 'IOSFODNN7EXAMPLE'].join(''),
  '{{GHP}}': `ghp_${'aB3dE6gH9jK2'.repeat(3)}`,
  '{{PEM}}': ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join(''),
  '{{JWT}}': ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJ1c2VyMSJ9', 'abcdefghij1234567890'].join('.'),
};
const fill = (text) => Object.entries(SECRETS).reduce((acc, [k, v]) => acc.split(k).join(v), text);
const join = (v) => fill(Array.isArray(v) ? v.join('\n') : v);

const failures = [];
const fail = (id, why) => failures.push({ id, why });
const countBy = (findings) => findings.reduce((acc, f) => ((acc[f.ruleId] = (acc[f.ruleId] ?? 0) + 1), acc), {});
const setEq = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/* ---------- 1. snippet cases ---------- */
for (const c of cases.snippets) {
  const code = join(c.code);
  const findings = audit.auditText(c.file.replace(/^\//, ''), code);
  const ids = [...new Set(findings.map((f) => f.ruleId))];
  if (!setEq(ids, c.expect)) fail(c.id, `rule berbeda: dapat [${ids.join(', ')}], diharapkan [${c.expect.join(', ')}]`);
  const counts = countBy(findings);
  for (const [id, n] of Object.entries(c.counts ?? {})) if (counts[id] !== n) fail(c.id, `jumlah ${id}: ${counts[id] ?? 0} != ${n}`);
  for (const [id, sev] of Object.entries(c.severity ?? {})) {
    const f = findings.find((x) => x.ruleId === id);
    if (f && f.severity !== sev) fail(c.id, `severity ${id}: ${f.severity} != ${sev}`);
  }
  for (const [id, conf] of Object.entries(c.confidence ?? {})) {
    const f = findings.find((x) => x.ruleId === id);
    if (f && f.confidence !== conf) fail(c.id, `confidence ${id}: ${f.confidence} != ${conf}`);
  }
  for (const needle of c.mustNotLeak ?? []) {
    const raw = fill(needle);
    if (JSON.stringify(findings).includes(raw)) fail(c.id, 'nilai rahasia bocor ke dalam laporan');
  }
}

/* ---------- 2. synthetic projects ---------- */
const made = [];
const mk = (prefix) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); made.push(d); return d; };
let symlinkSkipped = 0;
for (const c of cases.projects) {
  const root = mk('nm-audit-proj-');
  for (const [rel, content] of Object.entries(c.files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  if (c.symlinkTo) {
    const outside = mk('nm-audit-outside-');
    for (const [rel, content] of Object.entries(c.symlinkTo)) {
      fs.mkdirSync(path.dirname(path.join(outside, rel)), { recursive: true });
      fs.writeFileSync(path.join(outside, rel), content);
    }
    try { fs.symlinkSync(path.join(outside, 'outside'), path.join(root, 'link')); } catch { symlinkSkipped += 1; continue; }
  }
  const report = audit.auditDirectory(root, c.options ?? {});
  const ids = [...new Set(report.findings.map((f) => f.ruleId))];
  for (const id of c.expect ?? []) if (!ids.includes(id)) fail(c.id, `tidak menemukan ${id} (dapat: ${ids.join(', ') || '-'})`);
  for (const id of c.forbid ?? []) if (ids.includes(id)) fail(c.id, `menemukan ${id} yang seharusnya tidak ada`);
  const counts = countBy(report.findings);
  for (const [id, n] of Object.entries(c.expectCounts ?? {})) if (counts[id] !== n) fail(c.id, `jumlah ${id}: ${counts[id] ?? 0} != ${n}`);
  for (const [id, sev] of Object.entries(c.severity ?? {})) {
    const f = report.findings.find((x) => x.ruleId === id);
    if (f && f.severity !== sev) fail(c.id, `severity ${id}: ${f.severity} != ${sev}`);
  }
  for (const [k, n] of Object.entries(c.skipped ?? {})) if (report.coverage.skipped[k] !== n) fail(c.id, `skipped.${k}: ${report.coverage.skipped[k]} != ${n}`);
  for (const [k, n] of Object.entries(c.skippedAtLeast ?? {})) if (report.coverage.skipped[k] < n) fail(c.id, `skipped.${k}: ${report.coverage.skipped[k]} < ${n}`);
  if (c.suppressedAtLeast !== undefined && report.coverage.suppressed < c.suppressedAtLeast) fail(c.id, `suppressed ${report.coverage.suppressed} < ${c.suppressedAtLeast}`);
  if (c.truncated !== undefined && report.coverage.truncated !== c.truncated) fail(c.id, `truncated ${report.coverage.truncated}`);
  if (c.filesScanned !== undefined && report.coverage.filesScanned !== c.filesScanned) fail(c.id, `filesScanned ${report.coverage.filesScanned} != ${c.filesScanned}`);
  const serialized = JSON.stringify(report);
  for (const needle of c.mustNotLeak ?? []) if (serialized.includes(needle)) fail(c.id, 'isi berkas .env bocor ke dalam laporan');
  if (serialized.includes(root)) fail(c.id, 'path absolut folder ikut tercantum dalam laporan');
  const md = audit.renderMarkdown(report);
  for (const needle of c.markdownContains ?? []) if (!md.includes(needle)) fail(c.id, `markdown tidak memuat: ${needle}`);
}
for (const d of made) fs.rmSync(d, { recursive: true, force: true });

/* ---------- 3. reports (Markdown & SARIF) ---------- */
{
  const findings = audit.auditText('a.ts', "res.setHeader('Access-Control-Allow-Origin', '*');\nconst r = eval(x);");
  const report = audit.buildReport('demo', findings);
  const md = audit.renderMarkdown(report);
  if (!md.includes('https://cwe.mitre.org/data/definitions/942.html')) fail('report:markdown', 'tautan CWE tidak ada');
  if (!md.includes('## Batasan') || !md.includes('bukan bukti')) fail('report:markdown', 'bagian batasan tidak ada');
  if (!md.includes('A02:2025 Security Misconfiguration')) fail('report:markdown', 'kategori OWASP 2025 tidak ada');
  const sarif = audit.toSarif(report);
  const run = sarif.runs?.[0];
  if (sarif.version !== '2.1.0') fail('report:sarif', 'versi bukan 2.1.0');
  if (run?.results.length !== findings.length) fail('report:sarif', 'jumlah results berbeda dari findings');
  const declared = new Set(run?.tool.driver.rules.map((r) => r.id));
  if (!run?.results.every((r) => declared.has(r.ruleId) && r.locations[0].physicalLocation.region.startLine >= 1)) fail('report:sarif', 'rule tidak dideklarasikan atau lokasi tidak valid');
  if (!run?.results.some((r) => r.level === 'error') || !run?.results.some((r) => r.level === 'warning')) fail('report:sarif', 'pemetaan level tidak sesuai');
  const empty = audit.buildReport('kosong', []);
  if (empty.summary.riskLevel !== 'low' || !audit.renderMarkdown(empty).includes('bukan bukti sistem aman')) fail('report:empty', 'laporan kosong tidak jujur');
}

/* ---------- 4. chat partner context ---------- */
for (const c of cases.context) {
  const message = join(c.message);
  const r = partner.buildSecurityPartnerContext(message);
  if (r.active !== c.active) fail(`context:${c.id}`, `active=${r.active}`);
  for (const s of c.contains ?? []) if (!r.context.includes(s)) fail(`context:${c.id}`, `tidak memuat: ${s}`);
  for (const s of c.notContains ?? []) if (r.context.includes(s)) fail(`context:${c.id}`, `memuat yang dilarang: ${s}`);
  for (const needle of c.mustNotLeak ?? []) if (r.context.includes(fill(needle))) fail(`context:${c.id}`, 'nilai rahasia bocor ke konteks model');
}

/* ---------- 5. rule metadata integrity ---------- */
{
  const ids = rulesMod.LINE_RULES.map((r) => r.id);
  if (new Set(ids).size !== ids.length) fail('rules:unique-ids', 'id aturan duplikat');
  const owasp = new Set(Object.values(rulesMod.OWASP));
  const severities = new Set(['critical', 'high', 'medium', 'low', 'info']);
  const confidences = new Set(['high', 'medium', 'low']);
  for (const r of rulesMod.LINE_RULES) {
    if (r.pattern.global || r.pattern.sticky) fail(`rules:${r.id}`, 'pola global/sticky membuat hasil bergantung pada state');
    if (!owasp.has(r.owasp)) fail(`rules:${r.id}`, `kategori OWASP tidak dikenal: ${r.owasp}`);
    if (!severities.has(r.severity) || !confidences.has(r.confidence)) fail(`rules:${r.id}`, 'severity/confidence tidak valid');
    if (r.cwe !== undefined && !rulesMod.CWE_TITLES[r.cwe]) fail(`rules:${r.id}`, `CWE-${r.cwe} tidak ada di daftar judul terverifikasi`);
    if (!r.kinds.length || !r.why || !r.fix || !r.title) fail(`rules:${r.id}`, 'metadata tidak lengkap');
  }
  const names = Object.values(rulesMod.OWASP);
  if (!names.every((n) => /^A(?:0[1-9]|10):2025 /.test(n)) || names.length !== 10) fail('rules:owasp-edition', 'daftar OWASP bukan Top 10:2025 lengkap');
}

/* ---------- 6. regression gate on this repository ---------- */
let selfAudit = { skipped: true };
if (fs.existsSync('package.json') && fs.existsSync('lib/security-audit.ts')) {
  const report = audit.auditDirectory(process.cwd());
  selfAudit = { files: report.coverage.filesScanned, total: report.summary.total, bySeverity: report.summary.bySeverity };
  if (report.summary.bySeverity.critical || report.summary.bySeverity.high) fail('self-audit:severity', `repo memiliki temuan ${report.summary.bySeverity.critical} kritis / ${report.summary.bySeverity.high} tinggi`);
  if (report.findings.some((f) => f.ruleId === 'proj-env-not-ignored')) fail('self-audit:env', '.env tidak diabaikan oleh .gitignore');
  if (report.findings.some((f) => f.ruleId === 'js-secret-timing-compare' && f.file === 'app/api/admin/reindex/route.ts')) fail('self-audit:reindex', 'perbandingan token admin kembali tidak konstan-waktu');
  if (report.findings.some((f) => f.ruleId === 'js-path-traversal' && f.file === 'lib/coding-agent.ts')) fail('self-audit:coding-agent', 'server statis hasil generate kembali rentan path traversal');
  const allowed = new Set(['lib/security-audit-rules.ts', 'lib/security-audit.ts', 'lib/cyber-partner.ts', 'scripts/eval-security-audit-n1.5.1.mjs']);
  for (const s of report.suppressions) if (!allowed.has(s.file)) fail('self-audit:suppressions', `penekanan tak terduga pada ${s.file}`);
}

/* ---------- 7. structural ---------- */
const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const structural = {
  version: (([a, b, c]) => a === 1 && (b > 5 || (b === 5 && c >= 1)))(pkg.version.split('.').map(Number)),
  apiRoute: read('app/api/n1/security/route.ts').includes('repo.scan') && read('app/api/n1/security/route.ts').includes('resolveTrustedTarget'),
  chatRoutesWired: ['app/api/chat/route.ts', 'app/api/chat-json/route.ts'].every((p) => read(p).includes('buildSecurityPartnerContext')),
  noKeywordRefusalGate: !/refus|tolak|blocked/i.test(read('lib/cyber-partner.ts').replace(/\/\/.*$/gm, '')),
  manifest: (() => { try { const m = JSON.parse(read('data/release/n1.5.1/manifest.json')); return m.uiChanged === false && m.activeScanning === false && m.networkAccess === false; } catch { return false; } })(),
  knowledge: (() => {
    try {
      const k = JSON.parse(read('data/knowledge/security-partner.json'));
      return Array.isArray(k) && new Set(k.map((r) => r.id)).size === k.length && k.every((r) => r.id && r.title && r.text.length > 40 && Array.isArray(r.tags) && r.source);
    } catch { return false; }
  })(),
  docs: fs.existsSync('docs/security-partner-n1.5.1.md'),
};
for (const [k, v] of Object.entries(structural)) if (!v) fail(`structural:${k}`, 'gagal');

const total = cases.snippets.length + cases.projects.length - symlinkSkipped + cases.context.length + 4 + Object.keys(structural).length;
const ok = failures.length === 0;
console.log(JSON.stringify({
  ok,
  release: 'N1.5.1',
  edition: 'zenith',
  total,
  failed: failures.length,
  snippetCases: cases.snippets.length,
  projectCases: cases.projects.length,
  symlinkCasesSkipped: symlinkSkipped,
  contextCases: cases.context.length,
  rules: rulesMod.LINE_RULES.length,
  selfAudit,
  liveSuiteBenchmark: 'NOT_RUN',
  failures,
}, null, 2));
if (!ok) process.exit(1);
