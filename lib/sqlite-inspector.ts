import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ArtifactRepository } from './repos';
import { editionProfile } from './edition-profile';

const repo = new ArtifactRepository();
const sensitiveColumn = /(pass|secret|token|key|email|phone|card|nik|credential|auth)/i;

function assertApex() {
  if (String(editionProfile.edition) !== 'apex') {
    throw new Error('SQLite inspector hanya tersedia pada Apex.');
  }
}

function artifactPath(id: string) {
  const row = repo.get(id) as Record<string, unknown> | undefined;
  if (!row?.path) throw new Error('Artifact SQLite tidak memiliki file tersimpan.');
  const source = path.resolve(String(row.path));
  if (!fs.existsSync(source)) throw new Error('File artifact tidak ditemukan.');
  return source;
}

function sandboxCopy(id: string) {
  const source = artifactPath(id);
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), 'storage', 'inspect');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${id}.sqlite`);
  fs.copyFileSync(source, target);
  return target;
}

function redactRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, sensitiveColumn.test(key) ? '[REDACTED]' : value]),
  ));
}

export function inspectSqliteArtifact(id: string, query?: string, rowLimit = 100) {
  assertApex();
  const file = sandboxCopy(id);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = String(
      (db.prepare('PRAGMA integrity_check').get() as Record<string, unknown> | undefined)?.integrity_check || 'unknown',
    );
    const schema = db.prepare(
      "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE type IN ('table','view','index') AND name NOT LIKE 'sqlite_%' ORDER BY type,name LIMIT 500",
    ).all();
    if (!query) return { artifactId: id, readOnly: true, integrity, schema };

    const sql = query.trim().replace(/;\s*$/, '');
    const isReadOnly = /^(?:select|with\b[\s\S]*\bselect|explain)\b/i.test(sql);
    const denied = /\b(?:insert|update|delete|drop|alter|attach|detach|vacuum|reindex|create|replace|pragma)\b/i.test(sql);
    if (!isReadOnly || denied) throw new Error('Hanya SELECT/EXPLAIN read-only yang diizinkan.');
    if (sql.includes(';')) throw new Error('Multi-statement query ditolak.');

    const limit = Math.max(1, Math.min(rowLimit, 200));
    const bounded = /\blimit\s+\d+/i.test(sql) ? sql : `${sql} LIMIT ${limit}`;
    const rows = db.prepare(bounded).all() as Array<Record<string, unknown>>;
    return { artifactId: id, readOnly: true, integrity, schema, rowCount: rows.length, rows: redactRows(rows) };
  } finally {
    db.close();
    try { fs.rmSync(file, { force: true }); } catch { /* cleanup best effort */ }
  }
}
