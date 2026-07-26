import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AuditRecord } from './types';
const secretKey=/token|secret|password|credential|api[-_]?key|authorization/i;
function redact(value:unknown):unknown{
  if(Array.isArray(value)) return value.map(redact);
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,secretKey.test(k)?'[REDACTED]':redact(v)]));
  if(typeof value==='string') return value.replace(/(Bearer\s+)[^\s]+/gi,'$1[REDACTED]');
  return value;
}
export async function appendAudit(workspace:string,record:AuditRecord){
  const dir=path.join(path.resolve(workspace),'.nusamind','audit'); await fs.mkdir(dir,{recursive:true});
  await fs.appendFile(path.join(dir,'autonomy.jsonl'),JSON.stringify(redact(record))+'\n','utf8');
}
