import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { assertAllowedPath } from './path-policy';

export type ApprovalScope = { identity: string; runId: string; toolId: string; argsHash: string; origin: string; workspace: string };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export const approvalHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');

export class ApprovalStore {
  private db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS n2_schema(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO n2_schema VALUES(1);
      CREATE TABLE IF NOT EXISTS n2_approvals(token_hash TEXT PRIMARY KEY, scope_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER);`);
  }
  issue(scope: ApprovalScope, ttlMs = 300_000) {
    if (Object.values(scope).some(v => !v || typeof v !== 'string') || !Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > 300_000) throw new Error('INVALID_APPROVAL_SCOPE');
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + ttlMs;
    this.db.prepare('INSERT INTO n2_approvals(token_hash,scope_hash,expires_at) VALUES(?,?,?)').run(approvalHash(token), approvalHash(scope), expiresAt);
    return { token, expiresAt };
  }
  consume(token: string, scope: ApprovalScope) {
    const result = this.db.prepare('UPDATE n2_approvals SET used_at=? WHERE token_hash=? AND scope_hash=? AND used_at IS NULL AND expires_at>?').run(Date.now(), approvalHash(token), approvalHash(scope), Date.now());
    if (result.changes !== 1) throw new Error('APPROVAL_INVALID_EXPIRED_OR_USED');
  }
  close() { this.db.close(); }
}
let cached: ApprovalStore | undefined;
export function approvals() {
  if (!cached) {
    const file = assertAllowedPath(path.join(process.cwd(), 'storage', 'n2-approvals.db'), { roots: [process.cwd()] });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    cached = new ApprovalStore(file);
  }
  return cached;
}
