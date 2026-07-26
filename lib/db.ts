import { applyR1345Schema } from './db/schema-v1345';
import { applyR1346Schema, SCHEMA_VERSION_1346 } from './db/schema-v1346';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

let cached: DatabaseSync | null = null;
const DB_VERSION = SCHEMA_VERSION_1346;

function columns(db: DatabaseSync, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((row) => row.name));
}
function addColumn(db: DatabaseSync, table: string, definition: string) {
  const name = definition.trim().split(/\s+/)[0];
  if (!columns(db, table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
}
function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, title TEXT, state_json TEXT, created_at TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, session_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, data_json TEXT, created_at TEXT NOT NULL, FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS memory(session_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, importance INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, PRIMARY KEY(session_id,key), FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY, session_id TEXT, name TEXT NOT NULL, path TEXT, checksum TEXT NOT NULL, parser TEXT, status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS chunks(id TEXT PRIMARY KEY, artifact_id TEXT, domain TEXT NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL, source TEXT, trust REAL NOT NULL DEFAULT 0.5, metadata_json TEXT, checksum TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, domain TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL, location TEXT NOT NULL, checksum TEXT, trust REAL NOT NULL DEFAULT 0.5, status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, claim TEXT NOT NULL, source_id TEXT, quote TEXT, verdict TEXT NOT NULL, confidence REAL NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, request_id TEXT, session_id TEXT, event TEXT NOT NULL, status TEXT NOT NULL, latency_ms INTEGER, detail_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cache(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, scope TEXT NOT NULL, version TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY, session_id TEXT, goal TEXT NOT NULL, state TEXT NOT NULL, plan_json TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checkpoints(id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, state_json TEXT NOT NULL, checksum TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS finance_runs(id TEXT PRIMARY KEY, session_id TEXT, intent TEXT NOT NULL, inputs_json TEXT NOT NULL, result_json TEXT NOT NULL, confidence REAL NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS patch_tx(id TEXT PRIMARY KEY, job_id TEXT, target TEXT NOT NULL, backup_path TEXT, state TEXT NOT NULL, tests_json TEXT, checksum_before TEXT, checksum_after TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS replay(id TEXT PRIMARY KEY, request_json TEXT NOT NULL, response_json TEXT NOT NULL, masked INTEGER NOT NULL DEFAULT 1, checksum TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS code_symbols(id TEXT PRIMARY KEY, workspace TEXT NOT NULL, file TEXT NOT NULL, symbol TEXT NOT NULL, kind TEXT NOT NULL, line INTEGER NOT NULL, checksum TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS corpus_manifest(id TEXT PRIMARY KEY, domain TEXT NOT NULL, file TEXT NOT NULL, checksum TEXT NOT NULL, records INTEGER NOT NULL, duplicates INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS release_registry(version TEXT PRIMARY KEY, edition TEXT NOT NULL, dataset_version TEXT NOT NULL, prompt_version TEXT NOT NULL, schema_version INTEGER NOT NULL, manifest_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS security_events(id TEXT PRIMARY KEY, event TEXT NOT NULL, status TEXT NOT NULL, detail_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS quarantine(id TEXT PRIMARY KEY, name TEXT NOT NULL, reason TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS upload_runs(id TEXT PRIMARY KEY, stage TEXT NOT NULL, detail_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS permission_tokens(id TEXT PRIMARY KEY, scope TEXT NOT NULL, expires_at TEXT NOT NULL, constraints_json TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_batches(id TEXT PRIMARY KEY, version TEXT NOT NULL, source_name TEXT NOT NULL, source_kind TEXT NOT NULL, status TEXT NOT NULL, checksum TEXT NOT NULL, report_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_records(id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, domain TEXT NOT NULL, subdomain TEXT, language TEXT NOT NULL, title TEXT NOT NULL, title_key TEXT NOT NULL, content TEXT NOT NULL, source_id TEXT NOT NULL, source_type TEXT NOT NULL, trust REAL NOT NULL DEFAULT 0.5, verification TEXT NOT NULL, content_date TEXT, effective_date TEXT, expires_at TEXT, version TEXT NOT NULL, status TEXT NOT NULL, deprecated INTEGER NOT NULL DEFAULT 0, difficulty TEXT NOT NULL, allowed_editions TEXT NOT NULL, checksum TEXT NOT NULL UNIQUE, metadata_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(batch_id) REFERENCES knowledge_batches(id));
    CREATE TABLE IF NOT EXISTS knowledge_aliases(id TEXT PRIMARY KEY, record_id TEXT NOT NULL, language TEXT NOT NULL, alias TEXT NOT NULL, normalized TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(record_id) REFERENCES knowledge_records(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS knowledge_conflicts(id TEXT PRIMARY KEY, record_a TEXT NOT NULL, record_b TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, resolution_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(record_a) REFERENCES knowledge_records(id), FOREIGN KEY(record_b) REFERENCES knowledge_records(id));
    CREATE TABLE IF NOT EXISTS knowledge_gaps(id TEXT PRIMARY KEY, domain TEXT NOT NULL, query_hash TEXT NOT NULL UNIQUE, summary TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, metadata_json TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_feedback(id TEXT PRIMARY KEY, record_id TEXT, answer_hash TEXT NOT NULL, verdict TEXT NOT NULL, detail_json TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS knowledge_bench_runs(id TEXT PRIMARY KEY, edition TEXT NOT NULL, score REAL NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_know_domain ON knowledge_records(domain,status,trust DESC);
    CREATE INDEX IF NOT EXISTS idx_know_batch ON knowledge_records(batch_id,status);
    CREATE INDEX IF NOT EXISTS idx_know_expiry ON knowledge_records(expires_at,status);
    CREATE INDEX IF NOT EXISTS idx_know_conflict ON knowledge_conflicts(status,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_know_gap ON knowledge_gaps(status,priority DESC,count DESC);
    CREATE INDEX IF NOT EXISTS idx_security_created ON security_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quarantine_status ON quarantine(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_upload_updated ON upload_runs(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_memory_session ON memory(session_id, importance DESC);
    CREATE INDEX IF NOT EXISTS idx_chunks_domain ON chunks(domain, trust DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_request ON audit(request_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sources_domain ON sources(domain, trust DESC);
  `);
  addColumn(db, 'sessions', 'state_json TEXT');
  addColumn(db, 'sessions', 'created_at TEXT');
  addColumn(db, 'messages', 'data_json TEXT');
  addColumn(db, 'artifacts', 'metadata_json TEXT');
  applyR1345Schema(db);
  applyR1346Schema(db);
  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(id UNINDEXED, domain UNINDEXED, title, text, source, tokenize='unicode61 remove_diacritics 2')`);
  } catch { /* Some SQLite builds omit FTS5. Retrieval has a LIKE fallback. */ }
  db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)').run(DB_VERSION, 'r13.46-prompt-agent-platform', new Date().toISOString());
}

export function getDatabase(): DatabaseSync {
  if (cached) return cached;
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage');
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'nusamind.db'));
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY;');
  migrate(db);
  cached = db;
  return db;
}
export function databaseStatus() {
  const db = getDatabase();
  const integrity = String((db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined)?.integrity_check || 'unknown');
  const version = Number((db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version?: number } | undefined)?.version || 0);
  return { engine: 'node:sqlite', file: 'storage/nusamind.db', wal: true, foreignKeys: true, schemaVersion: version, integrity };
}
