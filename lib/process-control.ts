import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
export async function terminateProcessTree(child: Pick<ChildProcess, 'pid'>) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const taskkill = path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'taskkill.exe');
    await new Promise<void>((resolve, reject) => {
      const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', shell: false });
      killer.once('error', reject);
      killer.once('close', code => { if (code !== 0) reject(new Error('PROCESS_TREE_STOP_FAILED')); else resolve(); });
    });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
