import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const directory = path.resolve('docs/n2/evidence');
fs.mkdirSync(directory, { recursive: true });
const scripts = ['check:lock', 'lint', 'check:dual', 'test:n2', 'cli:menu:test', 'quran:exact:test', 'quran:db:test', 'health:test', 'ui:check', 'security:smoke', 'distribution:check', 'typescript:n141:benchmark', 'build', 'test:n2:http', 'test:n2:ui', 'benchmark:n1'];
const commands = scripts.map(name => ({ name, args: ['run', name] }));
commands.push({ name: 'production-audit', args: ['audit', '--omit=dev', '--audit-level=high', '--json'] });
const results = [];
for (const { name, args } of commands) {
  const start = Date.now();
  const run = spawnSync('npm', args, { cwd: process.cwd(), encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  const output = `${run.stdout || ''}\n${run.stderr || ''}${run.error ? '\n' + run.error.message : ''}`.replace(/\u001b\[[0-9;]*m/g, '');
  const file = name.replace(/:/g, '-') + '.txt';
  fs.writeFileSync(path.join(directory, file), output);
  const status = run.status === 0 ? 'PASSED' : name === 'benchmark:n1' && run.status === 2 ? 'NOT_RUN' : 'FAILED';
  const entry = { command: ['npm', ...args].join(' '), status, exitCode: run.status, elapsedMs: Date.now() - start, outputFile: file, sha256: crypto.createHash('sha256').update(output).digest('hex') };
  results.push(entry);
  console.log(`${status} (${run.status}) ${entry.command}`);
}
fs.writeFileSync(path.join(directory, 'commands.json'), JSON.stringify({ at: new Date().toISOString(), node: process.version, platform: process.platform, releaseStatus: 'BLOCKED_NOT_N2_GA', results }, null, 2) + '\n');
if (results.some(r => r.status === 'FAILED')) process.exitCode = 1;
