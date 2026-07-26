import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDatabase } from './db';

export type ArtifactRecord = { id:string; sessionId?:string; name:string; path:string; checksum:string; parser:string; status:string; createdAt:string };

export function checksumFile(filePath:string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function registerArtifact(filePath:string, sessionId?:string, parser='unknown'): ArtifactRecord {
  const resolved=path.resolve(filePath);
  const checksum=checksumFile(resolved);
  const id=`art_${checksum.slice(0,16)}`;
  const createdAt=new Date().toISOString();
  const db=getDatabase();
  db.prepare(`INSERT INTO artifacts(id,session_id,name,path,checksum,parser,status,created_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET session_id=excluded.session_id,path=excluded.path,parser=excluded.parser,status='active'`)
    .run(id,sessionId||null,path.basename(resolved),resolved,checksum,parser,'active',createdAt);
  return {id,sessionId,name:path.basename(resolved),path:resolved,checksum,parser,status:'active',createdAt};
}
