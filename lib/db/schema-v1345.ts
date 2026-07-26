import type { DatabaseSync } from 'node:sqlite';
export const SCHEMA_VERSION_1345 = 5;
export function applyR1345Schema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_traces(id TEXT PRIMARY KEY, request_id TEXT, subsystem TEXT NOT NULL, event TEXT NOT NULL, status TEXT NOT NULL, latency_ms INTEGER, detail_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS health_sessions(id TEXT PRIMARY KEY, session_id TEXT, masked_summary TEXT NOT NULL, consent_scope TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS ml_models(id TEXT PRIMARY KEY, edition TEXT NOT NULL, task TEXT NOT NULL, version TEXT NOT NULL, checksum TEXT NOT NULL, metrics_json TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, activated_at TEXT);
    CREATE TABLE IF NOT EXISTS evidence_links(id TEXT PRIMARY KEY, claim_hash TEXT NOT NULL, source_id TEXT NOT NULL, relation TEXT NOT NULL, confidence REAL NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS pack_registry(id TEXT PRIMARY KEY, kind TEXT NOT NULL, version TEXT NOT NULL, checksum TEXT NOT NULL, records INTEGER NOT NULL, status TEXT NOT NULL, metadata_json TEXT, installed_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS capability_snapshots(id TEXT PRIMARY KEY, edition TEXT NOT NULL, manifest_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS migration_jobs(id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL, checkpoint_json TEXT, started_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS prediction_drift(id TEXT PRIMARY KEY, model_id TEXT NOT NULL, window_start TEXT NOT NULL, window_end TEXT NOT NULL, metric TEXT NOT NULL, value REAL NOT NULL, threshold REAL NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_trace_created ON runtime_traces(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_expiry ON health_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_ml_model_status ON ml_models(task,status,created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evidence_claim ON evidence_links(claim_hash,confidence DESC);
    CREATE INDEX IF NOT EXISTS idx_pack_status ON pack_registry(kind,status);
  `);
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)').run(SCHEMA_VERSION_1345, 'r13.45-runtime-health-ml-retrieval', new Date().toISOString());
}
