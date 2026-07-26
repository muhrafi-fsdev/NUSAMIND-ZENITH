import { randomUUID } from 'node:crypto';
import { getDatabase } from './db';
export type RuntimeTrace = { requestId?: string; subsystem: string; event: string; status: 'ok'|'degraded'|'error'|'blocked'; latencyMs?: number; detail?: Record<string, unknown> };
export function recordRuntimeTrace(trace: RuntimeTrace) {
  const row = { id: randomUUID(), createdAt: new Date().toISOString(), ...trace };
  try { getDatabase().prepare('INSERT INTO runtime_traces(id,request_id,subsystem,event,status,latency_ms,detail_json,created_at) VALUES(?,?,?,?,?,?,?,?)').run(row.id,row.requestId||null,row.subsystem,row.event,row.status,row.latencyMs??null,JSON.stringify(row.detail||{}),row.createdAt); } catch { /* trace must never break the primary request */ }
  return row;
}
export function listRuntimeTraces(limit=100){return getDatabase().prepare('SELECT * FROM runtime_traces ORDER BY created_at DESC LIMIT ?').all(Math.max(1,Math.min(1000,limit)));}
