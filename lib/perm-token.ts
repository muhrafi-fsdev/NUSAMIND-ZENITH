import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getDatabase } from './db';
import { strongToken, tokenEquals } from './api-auth';

export type PermissionScope = 'desktop.execute'|'desktop.write'|'desktop.app'|'security.manage'|'artifact.delete'|'quarantine.release'|'tool.execute'|'sqlite.inspect'|'repo.scan';
export type TokenPayload = { id:string; scope:PermissionScope[]; exp:number; roots?:string[]; actions?:string[] };
const secret = () => [process.env.DESKTOP_CONTROL_TOKEN, process.env.NUSAMIND_SECURITY_TOKEN].find(strongToken) || '';
const encode = (value:Buffer|string) => Buffer.from(value).toString('base64url');
const now = () => new Date().toISOString();

export function issuePermissionToken(scope:PermissionScope[], ttlSeconds=300, constraints:{roots?:string[];actions?:string[]}={}) {
  if (!secret()) throw new Error('Security token utama belum dikonfigurasi.');
  const payload:TokenPayload={id:randomUUID(),scope:[...new Set(scope)],exp:Date.now()+Math.max(30,Math.min(ttlSeconds,3600))*1000,...constraints};
  const raw=encode(JSON.stringify(payload));
  const sig=encode(createHmac('sha256',secret()).update(raw).digest());
  getDatabase().prepare('INSERT OR REPLACE INTO permission_tokens(id,scope,expires_at,constraints_json,status,created_at) VALUES(?,?,?,?,?,?)').run(payload.id,JSON.stringify(payload.scope),new Date(payload.exp).toISOString(),JSON.stringify({roots:payload.roots||[],actions:payload.actions||[]}), 'active', now());
  return {id:payload.id,token:`${raw}.${sig}`,expiresAt:new Date(payload.exp).toISOString(),scope:payload.scope,constraints:{roots:payload.roots||[],actions:payload.actions||[]}};
}
export function verifyPermissionToken(token:string|undefined, required:PermissionScope) {
  if(!token||!secret()) return {ok:false,reason:'missing_token'} as const;
  const [raw,sig]=token.split('.'); if(!raw||!sig)return {ok:false,reason:'malformed_token'} as const;
  const expected=encode(createHmac('sha256',secret()).update(raw).digest());
  const a=Buffer.from(sig); const b=Buffer.from(expected); if(a.length!==b.length||!timingSafeEqual(a,b))return {ok:false,reason:'invalid_signature'} as const;
  try{
    const payload=JSON.parse(Buffer.from(raw,'base64url').toString('utf8')) as TokenPayload;
    if(payload.exp<Date.now())return{ok:false,reason:'expired'} as const;
    if(!payload.scope.includes(required))return{ok:false,reason:'scope_denied'} as const;
    const row=getDatabase().prepare('SELECT status,expires_at FROM permission_tokens WHERE id=?').get(payload.id) as {status?:string;expires_at?:string}|undefined;
    if(!row||row.status!=='active')return{ok:false,reason:'revoked_or_unknown'} as const;
    if(row.expires_at&&Date.parse(row.expires_at)<Date.now())return{ok:false,reason:'expired'} as const;
    return{ok:true,payload} as const;
  }catch{return{ok:false,reason:'invalid_payload'} as const;}
}
export function listPermissionTokens(limit=100){return getDatabase().prepare('SELECT id,scope,expires_at,constraints_json,status,created_at FROM permission_tokens ORDER BY created_at DESC LIMIT ?').all(Math.max(1,Math.min(limit,500)));}
export function revokePermissionToken(id:string){const result=getDatabase().prepare("UPDATE permission_tokens SET status='revoked' WHERE id=?").run(id);return result.changes>0;}
export function masterTokenValid(value:string|undefined){return tokenEquals(value,secret());}
