import fs from 'node:fs';
import path from 'node:path';

export type PathPolicyOptions = { roots?: string[]; allowMissing?: boolean; allowUnc?: boolean };
const fold = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
function nearestExisting(target: string): string {
  let current = target;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}
function canonical(target: string, allowMissing: boolean): string {
  const resolved = path.resolve(target);
  if (fs.existsSync(resolved)) return fs.realpathSync.native(resolved);
  if (!allowMissing) throw new Error(`Path tidak ditemukan: ${resolved}`);
  const parent = nearestExisting(path.dirname(resolved));
  const realParent = fs.realpathSync.native(parent);
  const suffix = path.relative(parent, resolved);
  return path.resolve(realParent, suffix);
}
export function getAllowedRoots(extra: string[] = []): string[] {
  const env = String(process.env.NUSAMIND_ALLOWED_ROOTS || process.env.DESKTOP_ALLOWED_ROOTS || '')
    .split(path.delimiter).map((x) => x.trim()).filter(Boolean);
  return [...new Set([process.cwd(), path.join(/*turbopackIgnore: true*/ process.cwd(), 'data'), path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage'), path.join(/*turbopackIgnore: true*/ process.cwd(), 'workspace'), ...env, ...extra].map((x) => path.resolve(x)))];
}
export function isPathInside(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
export function assertAllowedPath(target: string, options: PathPolicyOptions = {}): string {
  if (!target || target.includes('\0')) throw new Error('Path kosong atau mengandung null byte.');
  if (!options.allowUnc && (target.startsWith('\\') || target.startsWith('//'))) throw new Error('UNC path tidak diizinkan.');
  const allowMissing = options.allowMissing ?? true;
  const candidate = canonical(target, allowMissing);
  const roots = (options.roots?.length ? options.roots : getAllowedRoots()).map((root) => canonical(root, true));
  const sameVolumeRoots = roots.filter((root) => fold(path.parse(root).root) === fold(path.parse(candidate).root));
  if (!sameVolumeRoots.some((root) => isPathInside(fold(candidate), fold(root)))) throw new Error('Path di luar allowed root atau keluar melalui symlink.');
  return candidate;
}
export function safeJoin(root: string, ...segments: string[]): string {
  return assertAllowedPath(path.join(root, ...segments), { roots: [root], allowMissing: true });
}
export function isSafeUploadName(name: string): boolean {
  return Boolean(name) && name === path.basename(name) && !name.includes('..') && !path.isAbsolute(name) && !/[\\/]/.test(name);
}
