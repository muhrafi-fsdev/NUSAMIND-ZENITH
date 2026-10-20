import { randomUUID } from 'node:crypto';
import { runProcess } from '../packages/autonomy-engine/process';
export type TaskSpec = { exe: string; args: string[]; cwd: string; timeoutMs?: number; maxOutputBytes?: number; env?: NodeJS.ProcessEnv };
const active = new Map<string, AbortController>();
export function activeTaskIds() { return [...active.keys()]; }
export async function runBoundedTask(spec: TaskSpec) {
  const id = `task_${randomUUID()}`, controller = new AbortController();
  const max = Math.max(4096, Math.min(spec.maxOutputBytes ?? 128000, 200000));
  active.set(id, controller);
  try {
    const result = await runProcess(spec.exe, spec.args, spec.cwd, { env: spec.env, timeoutMs: Math.max(1000, Math.min(spec.timeoutMs ?? 120000, 600000)), signal: controller.signal });
    const raw = Buffer.from(result.stdout + result.stderr);
    return { id, exitCode: result.code, output: raw.subarray(0, max).toString(), timedOut: result.timedOut, truncated: raw.length > max };
  } finally { active.delete(id); }
}
export function stopBoundedTask(id: string) {
  const controller = active.get(id);
  if (!controller) return false;
  controller.abort(new Error('TASK_CANCELLED'));
  return true;
}
export function stopAllBoundedTasks() { const ids = activeTaskIds(); for (const id of ids) stopBoundedTask(id); return ids; }
