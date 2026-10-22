import fs from 'node:fs';
import * as nodeModule from 'node:module';

const cases = JSON.parse(fs.readFileSync('data/benchmarks/table-engine-cases.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const out = { release: 'N1.5.0', behavioral: 'SKIPPED', reason: '' };

// Modul lib memakai impor relatif tanpa ekstensi (gaya bundler); hook ini menambahkan .ts hanya untuk pengujian.
if (typeof nodeModule.registerHooks === 'function') {
  nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      try { return nextResolve(specifier, context); } catch (error) {
        if (specifier.startsWith('.') && !/\.\w+$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
        throw error;
      }
    },
  });
}

let engine, calc, format, academic;
try {
  const url = (p) => new URL(`../lib/${p}`, import.meta.url).href;
  engine = await import(url('table-engine.ts'));
  academic = await import(url('academic-answer-engine.ts'));
  format = await import(url('answer-format.ts'));
  calc = typeof nodeModule.registerHooks === 'function' ? await import(url('calc-engine.ts')) : null;
} catch (error) {
  out.reason = `modul lib tidak dapat dimuat langsung (butuh Node >= 22.18): ${error.code || error.message}`;
  console.log(JSON.stringify({ ok: false, ...out }, null, 2));
  process.exit(2);
}

const failures = [];
const fail = (id, why) => failures.push({ id, why });
const join = (lines) => lines.join('\n');
const blockOf = (answer) => {
  const m = /^(`{3,})([^\n]*)\n([\s\S]*?)\n\1$/m.exec(answer);
  return m ? { lang: m[2], text: m[3] } : null;
};
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let handled = 0;
for (const c of cases.cases) {
  const question = join(c.question);
  const result = engine.tryBuildTableAnswer(question);
  if (c.kind === 'declined') {
    if (result !== null) fail(c.id, 'seharusnya ditolak (null) tetapi dijawab');
    continue;
  }
  if (!result) { fail(c.id, 'seharusnya dijawab tetapi null'); continue; }
  handled += 1;
  const e = c.expect;
  if (e.formulaId && result.formulaId !== e.formulaId) fail(c.id, `formulaId ${result.formulaId} != ${e.formulaId}`);
  if (e.status && result.status !== e.status) fail(c.id, `status ${result.status} != ${e.status}`);
  for (const s of e.contains ?? []) if (!result.answer.includes(s)) fail(c.id, `tidak memuat: ${s}`);
  for (const s of e.notContains ?? []) if (result.answer.includes(s)) fail(c.id, `memuat yang dilarang: ${s}`);
  if (e.fence || e.json) {
    const block = blockOf(result.answer);
    if (!block) { fail(c.id, 'tidak ada blok kode'); continue; }
    if (e.fence) {
      if (block.lang !== e.fence.lang) fail(c.id, `label blok ${block.lang} != ${e.fence.lang}`);
      if (block.text !== join(e.fence.lines)) fail(c.id, `isi blok berbeda:\n${block.text}\n--- diharapkan ---\n${join(e.fence.lines)}`);
    }
    if (e.json) {
      let parsed; try { parsed = JSON.parse(block.text); } catch { parsed = undefined; }
      if (!deepEqual(parsed, e.json)) fail(c.id, `JSON berbeda: ${block.text}`);
    }
  }
  // Pengaman: formatter jawaban akhir tidak boleh mengubah hasil deterministik.
  const formatted = format.formatFinalAnswer(result.answer, question, 'zenith', 'auto');
  if (formatted !== result.answer.trim() && (e.formatterKeeps || e.fence || e.json)) fail(c.id, 'formatFinalAnswer mengubah blok hasil');
}

for (const r of cases.research) {
  const profile = academic.classifyAcademicRequest(r.question, 'zenith');
  const isResearch = profile.domain === 'research';
  if (isResearch !== r.research) fail(`research:${r.id}`, `domain=${profile.domain}`);
  if (r.research) {
    const text = academic.buildAcademicAnswerInstruction(r.question, 'zenith');
    for (const s of ['Dasar dan sumber', 'Jangan mengarang', 'tidak mengakses web']) if (!text.includes(s)) fail(`research:${r.id}`, `instruksi tidak memuat ${s}`);
  }
}

let integration = 'SKIPPED';
if (calc) {
  integration = 'RUN';
  for (const i of cases.integration) {
    const r = calc.tryBuildCalculationAnswer(i.question, 'zenith', 'auto');
    if (i.handled && !r) { fail(`integration:${i.id}`, 'tidak ditangani'); continue; }
    if (i.domain && r?.domain !== i.domain) fail(`integration:${i.id}`, `domain ${r?.domain}`);
    if (i.domainNot && r?.domain === i.domainNot) fail(`integration:${i.id}`, `domain tidak boleh ${i.domainNot}`);
    for (const s of i.contains ?? []) if (!r?.answer.includes(s)) fail(`integration:${i.id}`, `tidak memuat ${s}`);
  }
}

const structural = {
  version: /^1\.(?:[5-9]|\d{2,})\.\d+$/.test(pkg.version),
  engineWiredIntoCalc: fs.readFileSync('lib/calc-engine.ts', 'utf8').includes('tryBuildTableAnswer'),
  fenceAwareTableFormatter: /fenced/.test(fs.readFileSync('lib/answer-format.ts', 'utf8')),
  manifest: fs.existsSync('data/release/n1.5/manifest.json') && JSON.parse(fs.readFileSync('data/release/n1.5/manifest.json', 'utf8')).uiChanged === false,
};
for (const [k, v] of Object.entries(structural)) if (!v) fail(`structural:${k}`, 'gagal');

const total = cases.cases.length + cases.research.length + (calc ? cases.integration.length : 0) + Object.keys(structural).length;
const ok = failures.length === 0;
console.log(JSON.stringify({
  ok,
  release: 'N1.5.0',
  edition: 'zenith',
  total,
  failed: failures.length,
  engineCases: cases.cases.length,
  answeredByEngine: handled,
  researchCases: cases.research.length,
  integration,
  liveSuiteBenchmark: 'NOT_RUN',
  failures,
}, null, 2));
if (!ok) process.exit(1);
