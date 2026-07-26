
import type { DatabaseSync } from 'node:sqlite';
export const SCHEMA_VERSION_1346=6;
export function applyR1346Schema(db:DatabaseSync){db.exec(`
CREATE TABLE IF NOT EXISTS prompt_registry(prompt_id TEXT NOT NULL,version TEXT NOT NULL,task_type TEXT NOT NULL,model_compatibility TEXT NOT NULL,editions TEXT NOT NULL,input_schema TEXT NOT NULL,output_schema TEXT NOT NULL,constraints_json TEXT NOT NULL,safety_json TEXT NOT NULL,benchmark_json TEXT NOT NULL,status TEXT NOT NULL,rollback_target TEXT NOT NULL,template_hash TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(prompt_id,version));
CREATE TABLE IF NOT EXISTS prompt_experiments(id TEXT PRIMARY KEY,prompt_id TEXT NOT NULL,prompt_version TEXT NOT NULL,model TEXT NOT NULL,dataset_hash TEXT NOT NULL,scorecard_json TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS prompt_runtime_traces(id TEXT PRIMARY KEY,request_id TEXT,session_id TEXT,prompt_id TEXT NOT NULL,prompt_version TEXT NOT NULL,strategy TEXT NOT NULL,model TEXT NOT NULL,context_hash TEXT NOT NULL,status TEXT NOT NULL,latency_ms INTEGER,detail_json TEXT,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_profiles(id TEXT PRIMARY KEY,model TEXT NOT NULL,version TEXT NOT NULL,checksum TEXT NOT NULL,profile_json TEXT NOT NULL,status TEXT NOT NULL,tested_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agent_checkpoints(id TEXT PRIMARY KEY,workflow_id TEXT NOT NULL,edition TEXT NOT NULL,state_json TEXT NOT NULL,checksum TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS research_registry(research_id TEXT PRIMARY KEY,topic TEXT NOT NULL,source TEXT NOT NULL,status TEXT NOT NULL,module TEXT NOT NULL,benchmark TEXT NOT NULL,activation_rule TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_prompt_active ON prompt_registry(task_type,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompt_trace_created ON prompt_runtime_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_checkpoint_workflow ON agent_checkpoints(workflow_id,updated_at DESC);
`);db.prepare('INSERT OR IGNORE INTO schema_migrations(version,name,applied_at) VALUES(?,?,?)').run(SCHEMA_VERSION_1346,'r13.46-prompt-agent-platform',new Date().toISOString());}
