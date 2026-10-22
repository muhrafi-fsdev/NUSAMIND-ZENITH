import fs from 'node:fs';
import path from 'node:path';
import * as nodeModule from 'node:module';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || '.';
const format = flag('format', 'markdown');
const out = flag('out', '');
const failOn = flag('fail-on', 'none');
const usage = 'Pemakaian: node scripts/security-audit-n1.5.1.mjs [path] [--format json|markdown|sarif] [--out berkas] [--fail-on critical|high|medium|low|none]';
if (!['json', 'markdown', 'sarif'].includes(format) || !['critical', 'high', 'medium', 'low', 'none'].includes(failOn)) {
  console.error(usage);
  process.exit(2);
}
if (typeof nodeModule.registerHooks !== 'function') {
  console.error('Skrip ini memuat modul .ts langsung dan memerlukan Node 22.18 atau lebih baru.');
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
const lib = (p) => new URL(`../${p}`, import.meta.url).href;
const { auditDirectory, renderMarkdown, toSarif } = await import(lib('lib/security-audit.ts'));
const { resolveTrustedTarget } = await import(lib('packages/autonomy-engine/workspace.ts'));

const home = fs.realpathSync(process.cwd());
let resolved;
try {
  resolved = fs.realpathSync(path.resolve(home, target));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('PATH_MUST_BE_DIRECTORY');
  await resolveTrustedTarget(home, resolved);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(reason === 'UNTRUSTED_EXTERNAL_WORKSPACE'
    ? 'Folder di luar proyek harus didaftarkan sebagai workspace tepercaya (.nusamind/trusted-workspaces.json) sebelum diaudit.'
    : `Tidak dapat mengaudit "${target}": ${reason}`);
  process.exit(2);
}

const report = auditDirectory(resolved);
const text = format === 'sarif' ? JSON.stringify(toSarif(report), null, 2)
  : format === 'json' ? JSON.stringify(report, null, 2)
    : renderMarkdown(report, 200);

if (out) {
  const dest = path.resolve(home, out);
  if (dest !== home && !dest.startsWith(home + path.sep)) {
    console.error('--out harus berada di dalam folder proyek.');
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text, 'utf8');
  console.error(`Laporan ditulis ke ${path.relative(home, dest)} (${report.summary.total} temuan, risiko tertinggi: ${report.summary.riskLevel}).`);
} else {
  console.log(text);
}

const order = ['critical', 'high', 'medium', 'low'];
if (failOn !== 'none') {
  const limit = order.indexOf(failOn);
  if (order.slice(0, limit + 1).some((s) => report.summary.bySeverity[s] > 0)) process.exit(1);
}
