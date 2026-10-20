import { spawn } from 'node:child_process';
import { terminateProcessTree } from '../../lib/process-control';
import type { CommandResult } from './types';
export async function runProcess(command: string, args: string[], cwd: string, options?: { env?: NodeJS.ProcessEnv; timeoutMs?: number; input?: string; signal?: AbortSignal }) {
  options?.signal?.throwIfAborted();
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: options?.env || minimalEnvironment(), shell: false, detached: process.platform !== 'win32', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = Buffer.alloc(0), stderr = Buffer.alloc(0), timedOut = false;
    let stop: Promise<void> | undefined;
    const terminate = () => { stop ??= terminateProcessTree(child); stop.catch(reject); };
    const abort = () => terminate();
    const timer = setTimeout(() => { timedOut = true; terminate(); }, options?.timeoutMs ?? 120_000);
    options?.signal?.addEventListener('abort', abort, { once: true });
    if (options?.signal?.aborted) abort();
    child.stdout.on('data', d => { stdout = Buffer.concat([stdout, d]).subarray(-200_000); });
    child.stderr.on('data', d => { stderr = Buffer.concat([stderr, d]).subarray(-200_000); });
    const cleanup = () => { clearTimeout(timer); options?.signal?.removeEventListener('abort', abort); };
    child.once('error', error => { cleanup(); reject(error); });
    child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') reject(error); });
    child.once('close', async code => {
      cleanup();
      try {
        await stop;
        if (options?.signal?.aborted) { reject(options.signal.reason); return; }
        resolve({ code: code ?? -1, stdout: stdout.toString(), stderr: stderr.toString(), timedOut });
      } catch (error) { reject(error); }
    });
    child.stdin.end(options?.input);
  });
}
export function minimalEnvironment(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: process.env.NODE_ENV || 'production' };
  for (const key of ['PATH', 'Path', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'COMSPEC']) if (process.env[key]) env[key] = process.env[key];
  return { ...env, ...extra };
}
