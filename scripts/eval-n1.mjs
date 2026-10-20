import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const port = 31102;
const token = randomBytes(32).toString('hex');
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '-p', String(port)], { windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ADMIN_TOKEN: token } });
let log = '', result;
child.stdout.on('data', d => { log = (log + d).slice(-2000); });
child.stderr.on('data', d => { log = (log + d).slice(-2000); });
try {
  for (let i = 0; i < 80; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/n1/evaluate`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(2000) });
      if (response.ok) { result = await response.json(); break; }
    } catch { /* Server may still be starting. */ }
  }
  if (!result) throw new Error(`SERVER_NOT_READY ${log}`);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok || result.failed !== 0) process.exitCode = 1;
  else if (result.notRun > 0) process.exitCode = 2;
} finally {
  if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
}
