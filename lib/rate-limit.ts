import { authenticateRequest } from './api-auth';
type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

export function checkRateLimit(key: string, limit = 40, windowMs = 60_000): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  if (buckets.size > 1000) for (const [id, entry] of buckets) if (entry.resetAt <= now) buckets.delete(id);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const entry = { count: 1, resetAt: now + windowMs };
    buckets.set(key, entry);
    return { ok: true, remaining: limit - 1, resetAt: entry.resetAt };
  }
  current.count += 1;
  const remaining = Math.max(0, limit - current.count);
  return { ok: current.count <= limit, remaining, resetAt: current.resetAt };
}

export function getRateLimitKey(req: Request, _sessionId: string): string {
  return `chat:${authenticateRequest(req)?.identity || 'unauthenticated'}`;
}
