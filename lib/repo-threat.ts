import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { editionProfile } from './edition-profile';
import { scanSensitiveText } from './security-center';

const ignored = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'storage', '.cache']);
const binaryExt = new Set(['.exe', '.dll', '.msi', '.scr', '.com', '.jar', '.bin']);
const scriptExt = new Set(['.ps1', '.bat', '.cmd', '.vbs', '.js', '.mjs', '.sh']);

function assertApex() {
  if (String(editionProfile.edition) !== 'apex') {
    throw new Error('Repository threat scan penuh hanya tersedia pada Apex.');
  }
}

function allowedRoot(target: string) {
  const roots = (process.env.DESKTOP_ALLOWED_ROOTS || process.cwd())
    .split(';')
    .map((value) => path.resolve(value.trim()))
    .filter(Boolean);
  const resolved = path.resolve(target);
  const normalized = resolved.toLowerCase();
  if (!roots.some((root) => normalized === root.toLowerCase() || normalized.startsWith(root.toLowerCase() + path.sep))) {
    throw new Error('Folder di luar allowed roots.');
  }
  return resolved;
}

export function scanRepository(target: string) {
  assertApex();
  const root = allowedRoot(target);
  const findings: Array<Record<string, unknown>> = [];
  let files = 0;
  let bytes = 0;
  const types: Record<string, number> = {};

  const walk = (dir: string, depth: number) => {
    if (depth > 30 || files >= 5000) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full);
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        findings.push({ severity: 'high', kind: 'symlink', path: relative });
        continue;
      }
      if (entry.isDirectory()) {
        if (relative.replace(/\\/g, '/').includes('.git/hooks')) {
          findings.push({ severity: 'high', kind: 'git_hook_dir', path: relative });
        }
        walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      files += 1;
      if (files > 5000) {
        findings.push({ severity: 'medium', kind: 'file_limit', path: relative });
        return;
      }
      bytes += stat.size;
      const ext = path.extname(entry.name).toLowerCase() || '[none]';
      types[ext] = (types[ext] || 0) + 1;
      if (binaryExt.has(ext)) findings.push({ severity: 'high', kind: 'binary', path: relative, size: stat.size });
      if (stat.size > 2_000_000) continue;

      const text = fs.readFileSync(full, 'utf8');
      const secrets = scanSensitiveText(text);
      if (secrets.length) {
        findings.push({
          severity: secrets.some((item) => item.severity === 'critical') ? 'critical' : 'high',
          kind: 'secret_pattern',
          path: relative,
          count: secrets.length,
        });
      }
      if (entry.name === 'package.json') {
        try {
          const pkg = JSON.parse(text) as { scripts?: Record<string, string> };
          for (const [name, command] of Object.entries(pkg.scripts || {})) {
            if (/(?:curl|wget|powershell|invoke-expression|downloadstring|certutil|bitsadmin|nc\s|netcat)/i.test(command)) {
              findings.push({
                severity: 'critical',
                kind: 'suspicious_package_script',
                path: relative,
                script: name,
                commandHash: createHash('sha256').update(command).digest('hex').slice(0, 16),
              });
            }
          }
        } catch {
          findings.push({ severity: 'medium', kind: 'invalid_package_json', path: relative });
        }
      }
      if (
        scriptExt.has(ext)
        && /(?:frombase64string|invoke-expression|downloadstring|curl\s+[^\n]+\|\s*(?:sh|bash)|chmod\s+\+x)/i.test(text)
      ) {
        findings.push({ severity: 'critical', kind: 'suspicious_script', path: relative });
      }
    }
  };

  walk(root, 0);
  const risk = findings.some((item) => item.severity === 'critical')
    ? 'critical'
    : findings.some((item) => item.severity === 'high')
      ? 'high'
      : findings.length
        ? 'medium'
        : 'low';
  return { root, readOnly: true, files, bytes, types, risk, findings: findings.slice(0, 500), ignored: [...ignored] };
}
