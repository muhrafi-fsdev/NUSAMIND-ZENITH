// nusamind-audit-ignore-file: memuat contoh pola kerentanan untuk dokumentasi dan pengujian pemindai ini sendiri
import fs from 'node:fs';
import path from 'node:path';
import { CWE_TITLES, LINE_RULES, OWASP, SECRET_PATTERNS } from './security-audit-rules';
import type { Confidence, FileKind, LineRule, Severity } from './security-audit-rules';

export type { Confidence, FileKind, Severity } from './security-audit-rules';

export const AUDIT_VERSION = '1.5.1';

export type Finding = {
  ruleId: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  cwe?: number;
  cweTitle?: string;
  owasp: string;
  file: string;
  line: number;
  snippet: string;
  why: string;
  fix: string;
};

export type Suppression = { file: string; line?: number; scope: 'file' | 'line' };

export type AuditOptions = {
  maxFiles?: number;
  maxFileBytes?: number;
  maxDepth?: number;
  includeInfo?: boolean;
};

export type AuditReport = {
  tool: 'nusamind-security-audit';
  version: string;
  target: string;
  generatedAt: string;
  mode: 'DEFENSIVE_ANALYSIS';
  passive: true;
  coverage: {
    filesScanned: number;
    bytesScanned: number;
    skipped: { symlink: number; tooLarge: number; ignoredDir: number; unsupported: number; binary: number; longLines: number; envFile: number };
    truncated: boolean;
    suppressed: number;
  };
  suppressions: Suppression[];
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byOwasp: Record<string, number>;
    riskLevel: Severity;
  };
  findings: Finding[];
  limitations: string[];
};

export const LIMITATIONS = [
  'Analisis statis berbasis pola: dapat menghasilkan false positive dan melewatkan celah (false negative), terutama logika bisnis, otorisasi, dan alur data lintas berkas.',
  'Kode tidak dijalankan dan tidak ada uji dinamis maupun jaringan; pemindaian bersifat pasif dan hanya membaca berkas.',
  'Kerentanan dependensi (CVE) tidak diperiksa secara offline. Jalankan npm audit atau OSV-Scanner pada jaringan Anda.',
  'Berkas .env asli tidak dibaca; hanya keberadaannya dan status .gitignore yang diperiksa.',
  'Tidak adanya temuan bukan bukti bahwa sistem aman.',
];

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
const severityRank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage', '__pycache__', '.venv', 'venv', '.cache', '.turbo',
  '.pytest_cache', '.nusamind', 'storage',
]);
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
const MAX_LINE = 2000;

/* ---------- classification ---------- */

const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.mts', '.cts']);
const SHELL_EXT = new Set(['.sh', '.bash', '.zsh']);
const TEXT_EXT = new Set(['.yml', '.yaml', '.json', '.md', '.txt', '.toml', '.ini', '.cfg', '.conf', '.properties', '.tf', '.xml']);

const isEnvExample = (base: string) => /^\.env\.(?:example|sample|template|dist)$/.test(base) || base.endsWith('.env.example');
export const isRealEnvFile = (base: string) => /^\.env(?:\..+)?$/.test(base) && !isEnvExample(base);

export function kindsOf(relPath: string): FileKind[] {
  const rel = relPath.replace(/\\/g, '/');
  const base = path.posix.basename(rel).toLowerCase();
  const ext = path.posix.extname(base);
  if (isRealEnvFile(base)) return [];
  if (isEnvExample(base)) return ['env-example'];
  if (base === 'dockerfile' || base.startsWith('dockerfile.') || base.endsWith('.dockerfile')) return ['dockerfile'];
  if (/^(?:docker-)?compose(?:\..+)?\.ya?ml$/.test(base)) return ['compose', 'text'];
  if (/(?:^|\/)\.github\/workflows\/[^/]+\.ya?ml$/.test(rel)) return ['workflow', 'text'];
  if (base === 'nginx.conf' || (ext === '.conf' && /nginx/.test(rel.toLowerCase()))) return ['nginx', 'text'];
  if (base === 'sshd_config') return ['sshd'];
  if (base === 'package.json') return ['package', 'text'];
  if (/^next\.config\.(?:js|mjs|cjs|ts)$/.test(base)) return ['nextconfig', 'js'];
  if (JS_EXT.has(ext)) return ['js'];
  if (ext === '.py') return ['python'];
  if (SHELL_EXT.has(ext)) return ['shell'];
  if (ext === '.ps1' || ext === '.psm1') return ['powershell'];
  if (ext === '.bat' || ext === '.cmd') return ['batch'];
  if (TEXT_EXT.has(ext)) return ['text'];
  return [];
}

const COMMENT_PREFIXES: Partial<Record<FileKind, string[]>> = {
  js: ['//', '/*', '*'],
  python: ['#'], shell: ['#'], powershell: ['#'], dockerfile: ['#'], compose: ['#'], workflow: ['#'], nginx: ['#'], sshd: ['#'],
  batch: ['rem ', '::', '@rem '],
};

function isCommentLine(line: string, kinds: FileKind[]) {
  const t = line.trim().toLowerCase();
  if (!t) return false;
  return kinds.some((k) => (COMMENT_PREFIXES[k] ?? []).some((p) => t.startsWith(p)));
}

/* ---------- redaction ---------- */

export function maskSecrets(line: string): string {
  let out = line;
  for (const s of SECRET_PATTERNS) out = out.replace(new RegExp(s.pattern.source, `${s.pattern.flags.replace(/[gy]/g, '')}g`), `[REDACTED:${s.id}]`);
  out = out.replace(/((?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)[\w-]*["']?\s*[:=]\s*["'])([^"'\s]{4,})(["'])/gi, '$1[REDACTED]$3');
  out = out.replace(/(\b[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)[A-Z0-9_]*\s*[:=]\s*)([^\s"'$][^\s]*)/g, '$1[REDACTED]');
  return out;
}

const snippetOf = (line: string) => maskSecrets(line.trim()).slice(0, 160);

function makeFinding(rule: Pick<LineRule, 'id' | 'title' | 'severity' | 'confidence' | 'cwe' | 'owasp' | 'why' | 'fix'>, file: string, line: number, text: string): Finding {
  return {
    ruleId: rule.id, title: rule.title, severity: rule.severity, confidence: rule.confidence,
    ...(rule.cwe ? { cwe: rule.cwe, cweTitle: CWE_TITLES[rule.cwe] } : {}),
    owasp: rule.owasp, file, line, snippet: snippetOf(text), why: rule.why, fix: rule.fix,
  };
}

/* ---------- file-level rules ---------- */

const HEADER_CHECKS: Array<[string, RegExp]> = [
  ['Content-Security-Policy', /content-security-policy/i],
  ['X-Frame-Options atau frame-ancestors', /x-frame-options|frame-ancestors/i],
  ['X-Content-Type-Options', /x-content-type-options/i],
  ['Strict-Transport-Security', /strict-transport-security/i],
  ['Referrer-Policy', /referrer-policy/i],
];

function lineOf(text: string, needle: RegExp | string): number {
  const idx = typeof needle === 'string' ? text.indexOf(needle) : text.search(needle);
  return idx < 0 ? 1 : text.slice(0, idx).split('\n').length;
}

function fileLevelFindings(rel: string, text: string, kinds: FileKind[]): Finding[] {
  const out: Finding[] = [];
  const posix = rel.replace(/\\/g, '/');

  if (kinds.includes('dockerfile')) {
    const lines = text.split(/\r?\n/);
    const hasUser = lines.some((l) => /^\s*USER\s+(?!root\b|0\b)\S+/i.test(l));
    const firstFrom = lines.findIndex((l) => /^\s*FROM\s/i.test(l));
    if (!hasUser && firstFrom >= 0) {
      out.push(makeFinding({
        id: 'docker-runs-as-root', title: 'Kontainer berjalan sebagai root', severity: 'medium', confidence: 'high', cwe: 250, owasp: OWASP.A02,
        why: 'Tanpa instruksi USER non-root, proses aplikasi berjalan sebagai root di dalam kontainer sehingga dampak kompromi dan peluang eskalasi lebih besar.',
        fix: 'Buat pengguna tanpa hak istimewa (RUN adduser ...) lalu tambahkan USER pengguna tersebut sebelum CMD.',
      }, posix, firstFrom + 1, lines[firstFrom]));
    }
    const stages = new Set<string>();
    lines.forEach((l, i) => {
      const m = /^\s*FROM\s+(?:--platform=\S+\s+)?(\S+)(?:\s+AS\s+(\S+))?/i.exec(l);
      if (!m) return;
      const image = m[1];
      if (m[2]) stages.add(m[2].toLowerCase());
      if (image.toLowerCase() === 'scratch' || stages.has(image.toLowerCase()) || image.includes('@sha256:')) return;
      const tag = image.includes(':') ? image.split(':').pop() : '';
      if (!tag || tag === 'latest') {
        out.push(makeFinding({
          id: 'docker-unpinned-base', title: 'Base image tanpa tag versi atau memakai :latest', severity: 'low', confidence: 'high', owasp: OWASP.A03,
          why: ':latest berubah tanpa pemberitahuan sehingga build tidak dapat diulang dan dapat membawa perubahan yang tidak diaudit.',
          fix: 'Pin ke tag versi spesifik, atau lebih baik ke digest (image@sha256:...), dan perbarui secara terkontrol.',
        }, posix, i + 1, l));
      }
    });
  }

  if (kinds.includes('nextconfig')) {
    const missing = HEADER_CHECKS.filter(([, re]) => !re.test(text)).map(([name]) => name);
    if (missing.length) {
      const noHeaders = !/headers\s*\(/.test(text);
      out.push(makeFinding({
        id: 'next-missing-security-headers', title: 'Security headers belum dikonfigurasi di next.config', severity: missing.includes('Content-Security-Policy') ? 'medium' : 'low', confidence: noHeaders ? 'high' : 'medium', owasp: OWASP.A02,
        why: `Header berikut tidak ditemukan: ${missing.join(', ')}. Header ini membatasi XSS, clickjacking, MIME sniffing, dan downgrade ke HTTP. Bila ditambahkan di reverse proxy, abaikan temuan ini.`,
        fix: 'Tambahkan async headers() pada next.config dengan Content-Security-Policy, X-Content-Type-Options: nosniff, Referrer-Policy, frame-ancestors/X-Frame-Options, dan Strict-Transport-Security untuk HTTPS.',
      }, posix, 1, 'next.config'));
    }
    if (!/poweredByHeader\s*:\s*false/.test(text)) {
      out.push(makeFinding({
        id: 'next-powered-by-header', title: 'Header X-Powered-By tidak dimatikan', severity: 'info', confidence: 'high', owasp: OWASP.A02,
        why: 'Header ini mengungkap framework yang dipakai sehingga mempermudah pencocokan kerentanan.',
        fix: 'Tambahkan poweredByHeader: false pada next.config.',
      }, posix, 1, 'next.config'));
    }
  }

  if (kinds.includes('package')) {
    let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;
    try { pkg = JSON.parse(text); } catch { pkg = null; }
    if (pkg) {
      for (const section of ['dependencies', 'devDependencies'] as const) {
        for (const [name, version] of Object.entries(pkg[section] ?? {})) {
          const v = String(version).trim();
          const at = lineOf(text, `"${name}"`);
          if (v === '' || v === '*' || v === 'latest' || v === 'x') {
            out.push(makeFinding({
              id: 'pkg-unpinned-latest', title: 'Dependensi memakai versi bebas (latest / *)', severity: 'medium', confidence: 'high', owasp: OWASP.A03,
              why: 'Versi apa pun, termasuk rilis berbahaya atau yang merusak, dapat terpasang pada instalasi berikutnya.',
              fix: 'Pin ke versi atau rentang yang ditinjau, dan commit lockfile.',
            }, posix, at, `"${name}": "${v}"`));
          } else if (/^(?:git\+|git:|https?:|github:|[\w.-]+\/[\w.-]+(?:#.*)?$)/.test(v)) {
            out.push(makeFinding({
              id: 'pkg-url-dependency', title: 'Dependensi diambil dari URL atau repositori git', severity: 'medium', confidence: 'medium', owasp: OWASP.A03,
              why: 'Sumber di luar registry tidak lewat kebijakan registry dan isinya dapat berubah tanpa perubahan versi.',
              fix: 'Pakai paket terbit di registry dengan versi tetap, atau pin ke commit SHA lengkap dan tinjau isinya.',
            }, posix, at, `"${name}": "${v}"`));
          }
        }
      }
      for (const hook of ['preinstall', 'install', 'postinstall']) {
        if (pkg.scripts?.[hook]) {
          out.push(makeFinding({
            id: 'pkg-install-script', title: `Skrip siklus instalasi (${hook}) terdefinisi`, severity: 'info', confidence: 'high', owasp: OWASP.A03,
            why: 'Skrip instalasi berjalan otomatis pada npm install; pastikan isinya aman, karena skrip serupa pada dependensi adalah vektor supply chain yang umum.',
            fix: 'Tinjau isi skrip. Pertimbangkan npm install --ignore-scripts di CI dan izinkan skrip hanya untuk paket yang dipercaya.',
          }, posix, lineOf(text, `"${hook}"`), `"${hook}": "..."`));
        }
      }
    }
  }

  if (/(?:^|\/)app\/api\/.+\/route\.(?:ts|tsx|js|jsx|mjs)$/.test(posix)) {
    const m = /export\s+(?:async\s+)?(?:function|const)\s+(POST|PUT|PATCH|DELETE)\b/.exec(text);
    if (m && !/(?:token|auth|permission|session|verify|api[_-]?key|authorization|secret|jwt|cookie|rateLimit|checkRateLimit)/i.test(text)) {
      out.push(makeFinding({
        id: 'api-route-no-visible-auth', title: `Endpoint ${m[1]} tanpa pemeriksaan autentikasi yang terlihat`, severity: 'low', confidence: 'low', cwe: 306, owasp: OWASP.A01,
        why: 'Endpoint yang mengubah state tidak menunjukkan pemeriksaan token, sesi, atau izin. Untuk aplikasi lokal yang sengaja publik ini dapat wajar; bila endpoint dapat dijangkau dari jaringan, siapa pun bisa memanggilnya.',
        fix: 'Tambahkan autentikasi dan otorisasi (token berscope atau sesi), validasi input dengan skema, dan pembatas laju. Bila memang publik, dokumentasikan alasannya.',
      }, posix, lineOf(text, m[0]), m[0]));
    }
  }

  return out;
}

/* ---------- core scanning ---------- */

const IGNORE_FILE = /nusamind-audit-ignore-file/;
const IGNORE_LINE = /nusamind-audit-ignore(?!-file|-next-line)/;
const IGNORE_NEXT = /nusamind-audit-ignore-next-line/;

export function auditText(relPath: string, text: string, kindsOverride?: FileKind[], suppressions?: Suppression[]): Finding[] {
  const kinds = kindsOverride ?? kindsOf(relPath);
  if (!kinds.length) return [];
  const file = relPath.replace(/\\/g, '/');
  const lines = text.split(/\r?\n/);
  if (lines.slice(0, 10).some((l) => IGNORE_FILE.test(l))) {
    suppressions?.push({ file, scope: 'file' });
    return [];
  }
  const rules = LINE_RULES.filter((r) => r.kinds.some((k) => kinds.includes(k)));
  const findings: Finding[] = [];
  lines.forEach((line, i) => {
    if (line.length > MAX_LINE) return;
    const comment = isCommentLine(line, kinds);
    const suppressed = IGNORE_LINE.test(line) || (i > 0 && IGNORE_NEXT.test(lines[i - 1]));
    for (const rule of rules) {
      if (comment && !rule.id.startsWith('secret-')) continue;
      const m = rule.pattern.exec(line);
      if (!m) continue;
      if (rule.unless?.test(line)) continue;
      if (rule.check && !rule.check(line, m)) continue;
      if (suppressed) {
        suppressions?.push({ file, line: i + 1, scope: 'line' });
        continue;
      }
      findings.push(makeFinding({ ...rule, ...(rule.adjust?.(line, m) ?? {}) }, file, i + 1, line));
    }
  });
  return [...findings, ...fileLevelFindings(file, text, kinds)];
}

const LANGUAGE_FILES: Record<string, string> = {
  js: 'snippet.ts', javascript: 'snippet.ts', jsx: 'snippet.ts', ts: 'snippet.ts', typescript: 'snippet.ts', tsx: 'snippet.ts', node: 'snippet.ts', mjs: 'snippet.ts',
  py: 'snippet.py', python: 'snippet.py',
  sh: 'snippet.sh', bash: 'snippet.sh', shell: 'snippet.sh', zsh: 'snippet.sh',
  ps1: 'snippet.ps1', powershell: 'snippet.ps1', pwsh: 'snippet.ps1',
  bat: 'snippet.bat', cmd: 'snippet.bat', batch: 'snippet.bat',
  dockerfile: 'Dockerfile', docker: 'Dockerfile',
  nginx: 'nginx.conf',
};

/** Memindai potongan kode yang ditempel pengguna. Mengembalikan null bila bahasanya tidak dikenali. */
export function auditSnippet(code: string, language = ''): Finding[] | null {
  const lang = language.trim().toLowerCase();
  let file = LANGUAGE_FILES[lang];
  if (!file && (lang === 'yaml' || lang === 'yml')) file = /\bservices\s*:/.test(code) ? 'docker-compose.yml' : /\bjobs\s*:/.test(code) ? '.github/workflows/snippet.yml' : 'snippet.yml';
  if (!file && (lang === 'ini' || lang === 'conf') && /PermitRootLogin|PasswordAuthentication|PermitEmptyPasswords/i.test(code)) file = 'sshd_config';
  if (!file && lang === 'json') file = /"(?:dependencies|devDependencies|scripts)"/.test(code) ? 'package.json' : 'snippet.json';
  if (!file) return null;
  return auditText(file, code);
}

/* ---------- .gitignore ---------- */

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/** Apakah berkas bernama `name` di root diabaikan oleh isi .gitignore? (pola sederhana, last-match-wins, mendukung negasi). */
export function gitignoreCovers(gitignore: string, name: string): boolean {
  let ignored = false;
  for (const raw of gitignore.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    let pattern = negated ? line.slice(1) : line;
    if (pattern.endsWith('/')) continue;
    pattern = pattern.replace(/^\/+/, '').replace(/^\*\*\//, '');
    if (globToRegExp(pattern).test(name)) ignored = !negated;
  }
  return ignored;
}

/* ---------- directory audit ---------- */

function emptyCoverage(): AuditReport['coverage'] {
  return { filesScanned: 0, bytesScanned: 0, skipped: { symlink: 0, tooLarge: 0, ignoredDir: 0, unsupported: 0, binary: 0, longLines: 0, envFile: 0 }, truncated: false, suppressed: 0 };
}

function projectLevelFindings(root: string, entries: Set<string>): Finding[] {
  const out: Finding[] = [];
  if (entries.has('package.json') && !LOCKFILES.some((l) => entries.has(l))) {
    out.push(makeFinding({
      id: 'proj-no-lockfile', title: 'Tidak ada lockfile dependensi', severity: 'low', confidence: 'high', owasp: OWASP.A03,
      why: 'Tanpa lockfile, instalasi dapat menarik versi transitif yang berbeda atau yang baru dikompromikan, dan build tidak dapat direproduksi.',
      fix: 'Jalankan npm install lalu commit package-lock.json, dan pakai npm ci di CI.',
    }, 'package.json', 1, 'package.json'));
  }
  const hasEnvExample = [...entries].some((e) => isEnvExample(e.toLowerCase()));
  const realEnv = [...entries].find((e) => isRealEnvFile(e.toLowerCase()) && e.toLowerCase() === '.env');
  if (hasEnvExample || realEnv) {
    let gitignore: string | null = null;
    try { gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8'); } catch { gitignore = null; }
    const covered = gitignore !== null && gitignoreCovers(gitignore, '.env');
    if (!covered && (entries.has('.git') || gitignore !== null)) {
      out.push(makeFinding({
        id: 'proj-env-not-ignored', title: '.env tidak diabaikan oleh .gitignore', severity: realEnv ? 'high' : 'medium', confidence: 'high', cwe: 200, owasp: OWASP.A02,
        why: realEnv
          ? 'Berkas .env ada di root dan tidak tercakup .gitignore; git add . akan memasukkan kredensial ke repositori.'
          : 'Ada .env.example yang biasanya disalin menjadi .env, tetapi .env tidak tercakup .gitignore. Salinan itu berisi rahasia dan mudah ter-commit tanpa sengaja.',
        fix: 'Tambahkan baris ".env" pada .gitignore. Bila sudah pernah ter-commit, ganti seluruh nilainya dan bersihkan riwayat git.',
      }, '.gitignore', 1, gitignore === null ? '(.gitignore tidak ada)' : '.gitignore'));
    }
  }
  return out;
}

export function auditDirectory(root: string, options: AuditOptions = {}): AuditReport {
  const maxFiles = options.maxFiles ?? 3000;
  const maxFileBytes = options.maxFileBytes ?? 1_000_000;
  const maxDepth = options.maxDepth ?? 25;
  const base = path.resolve(root);
  const coverage = emptyCoverage();
  const findings: Finding[] = [];
  const suppressions: Suppression[] = [];
  const rootEntries = new Set<string>();

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth || coverage.truncated) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (coverage.truncated) return;
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full).replace(/\\/g, '/');
      if (depth === 0) rootEntries.add(entry.name);
      if (entry.isSymbolicLink()) { coverage.skipped.symlink += 1; continue; }
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) { coverage.skipped.ignoredDir += 1; continue; }
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isRealEnvFile(entry.name.toLowerCase())) { coverage.skipped.envFile += 1; continue; }
      const kinds = kindsOf(rel);
      if (!kinds.length) { coverage.skipped.unsupported += 1; continue; }
      if (coverage.filesScanned >= maxFiles) { coverage.truncated = true; return; }
      let size = 0;
      try { size = fs.statSync(full).size; } catch { continue; }
      if (size > maxFileBytes) { coverage.skipped.tooLarge += 1; continue; }
      let buffer: Buffer;
      try { buffer = fs.readFileSync(full); } catch { continue; }
      if (buffer.subarray(0, 8000).includes(0)) { coverage.skipped.binary += 1; continue; }
      const text = buffer.toString('utf8');
      coverage.filesScanned += 1;
      coverage.bytesScanned += size;
      if (text.split('\n').some((l) => l.length > MAX_LINE)) coverage.skipped.longLines += 1;
      findings.push(...auditText(rel, text, kinds, suppressions));
    }
  };

  walk(base, 0);
  findings.push(...projectLevelFindings(base, rootEntries));
  coverage.suppressed = suppressions.length;
  return buildReport(path.basename(base) || base, findings, coverage, options, suppressions);
}

export function buildReport(target: string, findingsIn: Finding[], coverage: AuditReport['coverage'] = emptyCoverage(), options: AuditOptions = {}, suppressions: Suppression[] = []): AuditReport {
  const findings = findingsIn
    .filter((f) => options.includeInfo !== false || f.severity !== 'info')
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line);
  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byOwasp: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byOwasp[f.owasp] = (byOwasp[f.owasp] ?? 0) + 1;
  }
  const riskLevel = SEVERITY_ORDER.find((s) => s !== 'info' && bySeverity[s] > 0) ?? 'low';
  return {
    tool: 'nusamind-security-audit',
    version: AUDIT_VERSION,
    target,
    generatedAt: new Date().toISOString(),
    mode: 'DEFENSIVE_ANALYSIS',
    passive: true,
    coverage,
    suppressions: suppressions.slice(0, 100),
    summary: { total: findings.length, bySeverity, byOwasp, riskLevel },
    findings,
    limitations: LIMITATIONS,
  };
}

/* ---------- reports ---------- */

const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Kritis', high: 'Tinggi', medium: 'Sedang', low: 'Rendah', info: 'Info' };
const cweLink = (cwe: number) => `https://cwe.mitre.org/data/definitions/${cwe}.html`;

export function renderMarkdown(report: AuditReport, maxFindings = 100): string {
  const s = report.summary;
  const lines: string[] = [
    `# Laporan Audit Keamanan — ${report.target}`,
    '',
    `Mode: ${report.mode} (pasif, hanya membaca berkas) · NusaMind Security Audit ${report.version} · ${report.generatedAt}`,
    '',
    '## Ringkasan',
    '',
    `Tingkat risiko tertinggi: **${SEVERITY_LABEL[s.riskLevel]}** · Total temuan: **${s.total}** · Berkas dipindai: ${report.coverage.filesScanned}${report.coverage.truncated ? ' (dipotong oleh batas jumlah berkas)' : ''}`,
    '',
    '| Tingkat | Jumlah |',
    '| --- | --- |',
    ...(['critical', 'high', 'medium', 'low', 'info'] as Severity[]).map((k) => `| ${SEVERITY_LABEL[k]} | ${s.bySeverity[k]} |`),
    '',
  ];
  const owasp = Object.entries(s.byOwasp).sort((a, b) => b[1] - a[1]);
  if (owasp.length) {
    lines.push('Kategori OWASP Top 10:2025 yang terkena: ' + owasp.map(([k, v]) => `${k} (${v})`).join('; '), '');
  }
  if (!report.findings.length) lines.push('Tidak ada temuan dari aturan yang tersedia. Ini bukan bukti sistem aman; lihat batasan di bawah.', '');
  report.findings.slice(0, maxFindings).forEach((f, i) => {
    lines.push(
      `### ${i + 1}. [${SEVERITY_LABEL[f.severity]}] ${f.title}`,
      '',
      `- Lokasi: \`${f.file}:${f.line}\` · Keyakinan: ${f.confidence} · Aturan: \`${f.ruleId}\``,
      `- Klasifikasi: ${f.owasp}${f.cwe ? ` · [CWE-${f.cwe}](${cweLink(f.cwe)}) ${f.cweTitle ?? ''}` : ''}`,
      `- Bukti: \`${f.snippet.replace(/`/g, "'")}\``,
      `- Kenapa berisiko: ${f.why}`,
      `- Perbaikan: ${f.fix}`,
      '',
    );
  });
  if (report.findings.length > maxFindings) lines.push(`_${report.findings.length - maxFindings} temuan lain tidak ditampilkan; gunakan format JSON atau SARIF untuk daftar lengkap._`, '');
  if (report.coverage.suppressed) {
    lines.push('## Penekanan (suppression)', '', `${report.coverage.suppressed} temuan atau berkas ditekan lewat penanda nusamind-audit-ignore. Tinjau bahwa penekanan ini sah:`, '',
      ...report.suppressions.slice(0, 20).map((x) => `- \`${x.file}${x.line ? `:${x.line}` : ''}\` (${x.scope === 'file' ? 'seluruh berkas' : 'satu baris'})`), '');
  }
  lines.push('## Batasan', '', ...report.limitations.map((l) => `- ${l}`), '', '## Langkah berikutnya', '',
    '1. Verifikasi tiap temuan secara manual sebelum mengubah kode; tandai false positive.',
    '2. Perbaiki dari tingkat Kritis ke bawah dan jalankan ulang audit untuk memastikan temuan hilang.',
    '3. Lengkapi dengan npm audit atau OSV-Scanner untuk CVE dependensi, serta uji dinamis pada lingkungan yang Anda miliki atau berizin.');
  return lines.join('\n');
}

const SARIF_LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = { critical: 'error', high: 'error', medium: 'warning', low: 'note', info: 'note' };
const SARIF_SECURITY_SEVERITY: Record<Severity, string> = { critical: '9.5', high: '8.0', medium: '5.5', low: '3.0', info: '0.5' };

/** SARIF 2.1.0 (OASIS) agar hasil dapat dibaca GitHub code scanning dan alat lain. */
export function toSarif(report: AuditReport) {
  const rules = new Map<string, Finding>();
  for (const f of report.findings) if (!rules.has(f.ruleId)) rules.set(f.ruleId, f);
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'NusaMind Security Audit',
          version: report.version,
          rules: [...rules.values()].map((f) => ({
            id: f.ruleId,
            name: f.title,
            shortDescription: { text: f.title },
            fullDescription: { text: f.why },
            help: { text: f.fix },
            defaultConfiguration: { level: SARIF_LEVEL[f.severity] },
            properties: {
              tags: ['security', f.owasp, ...(f.cwe ? [`CWE-${f.cwe}`] : [])],
              'security-severity': SARIF_SECURITY_SEVERITY[f.severity],
            },
          })),
        },
      },
      results: report.findings.map((f) => ({
        ruleId: f.ruleId,
        level: SARIF_LEVEL[f.severity],
        message: { text: `${f.title}. ${f.why} Perbaikan: ${f.fix}` },
        locations: [{ physicalLocation: { artifactLocation: { uri: f.file }, region: { startLine: f.line } } }],
      })),
    }],
  };
}
