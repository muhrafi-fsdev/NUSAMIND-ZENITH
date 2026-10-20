import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const execute = process.argv.includes('--execute');
const result = { ok: fs.existsSync('package.json') && fs.existsSync('package-lock.json'), mode: execute ? 'execute' : 'preflight', requirements: ['Node.js >=22', 'npm ci --ignore-scripts', 'npm run gate:n2'], steps: [] };
if (execute && result.ok) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nusamind-n2-cold-'));
  const excluded = new Set(['node_modules', '.git', '.next', '.nusamind', 'storage', 'workspace', 'coverage']);
  fs.cpSync(process.cwd(), temporary, { recursive: true, filter: source => !excluded.has(path.basename(source)) && (!/^\.env(?:\.|$)/.test(path.basename(source)) || path.basename(source) === '.env.example') });
  for (const args of [['ci', '--ignore-scripts', '--no-audit', '--no-fund'], ['run', 'gate:n2']]) {
    const command = ['npm', ...args].join(' ');
    const run = spawnSync('npm', args, { cwd: temporary, stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
    result.steps.push({ command, status: run.status, error: run.error?.message });
    if (run.status !== 0) { result.ok = false; break; }
  }
  result.evidenceDirectory = temporary;
}
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
