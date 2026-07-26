import { randomUUID } from 'node:crypto';
import { getDatabase } from './db';
export type UploadStage='scanning'|'uploading'|'parsing'|'ocr'|'indexing'|'ready'|'quarantined'|'failed';
export function createUploadRun(name:string){const id=`upl_${randomUUID()}`;setUploadStatus(id,'scanning',{name});return id;}
export function setUploadStatus(id:string,stage:UploadStage,detail:Record<string,unknown>={}){const at=new Date().toISOString();getDatabase().prepare(`INSERT INTO upload_runs(id,stage,detail_json,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET stage=excluded.stage,detail_json=excluded.detail_json,updated_at=excluded.updated_at`).run(id,stage,JSON.stringify(detail),at,at);}
export function getUploadStatus(id:string){const row=getDatabase().prepare('SELECT id,stage,detail_json,created_at,updated_at FROM upload_runs WHERE id=?').get(id) as Record<string,unknown>|undefined;if(!row)return null;let detail={};try{detail=JSON.parse(String(row.detail_json||'{}'));}catch{}return{...row,detail};}
