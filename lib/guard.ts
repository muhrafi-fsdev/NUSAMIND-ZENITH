import path from 'node:path';

const blocked = /[;&|><`]|\b(rm\s+-rf|format|diskpart|del\s+\/s|rmdir\s+\/s|shutdown|reboot|reg\s+(add|delete)|powershell\s+-enc|mkfs|dd\s+if=)\b/i;

export function commandRisk(command: string) {
  if (!command.trim()) return { allowed: false, risk: 'blocked', reason: 'Command kosong.' };
  if (blocked.test(command)) return { allowed: false, risk: 'blocked', reason: 'Command destructive/chaining diblokir.' };
  return {
    allowed: true,
    risk: /^(npm install|npm run|git commit|python -m pytest)/i.test(command) ? 'medium' : 'low',
    reason: 'Lolos pemeriksaan awal.',
  };
}

export function pathInside(candidate: string, roots: string[]) {
  const normalized = path.resolve(candidate).toLowerCase();
  return roots.some((root) => {
    const base = path.resolve(root).toLowerCase();
    return normalized === base || normalized.startsWith(base + path.sep);
  });
}
