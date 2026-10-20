import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { autonomyProfile, EDITION, isCriticalPath } from './policy';
import { appendAudit } from './audit';
import { assertAllowedPath } from '../../lib/path-policy';
export type WorkspaceAccess='read-only'|'read-write';
export type TrustedWorkspace={id:string;path:string;access:WorkspaceAccess;createdAt:string};
const registryPath=(home:string)=>path.join(path.resolve(home),'.nusamind','trusted-workspaces.json');
async function load(home:string):Promise<TrustedWorkspace[]>{try{return JSON.parse(await fs.readFile(registryPath(home),'utf8'));}catch{return[];}}
async function save(home:string,items:TrustedWorkspace[]){await fs.mkdir(path.dirname(registryPath(home)),{recursive:true});await fs.writeFile(registryPath(home),JSON.stringify(items,null,2));}
export async function registerWorkspace(home:string,target:string,access:WorkspaceAccess){
  if(access==='read-write'&&!autonomyProfile().externalWrite)throw new Error('EDITION_READ_ONLY');
  const resolved=await fs.realpath(path.resolve(target)); if(isCriticalPath(resolved)) throw new Error('CRITICAL_PATH_DENIED');
  const stat=await fs.stat(resolved); if(!stat.isDirectory()) throw new Error('WORKSPACE_MUST_BE_DIRECTORY');
  const items=await load(home); const id=crypto.createHash('sha256').update(resolved).digest('hex').slice(0,12);
  const item={id,path:resolved,access,createdAt:new Date().toISOString()}; const next=[...items.filter(x=>x.id!==id),item]; await save(home,next);
  await appendAudit(home,{at:new Date().toISOString(),edition:EDITION,action:'workspace-register',status:'SUCCEEDED',workspace:path.resolve(home),subject:resolved,details:{id,access}}); return item;
}
export async function listWorkspaces(home:string){return load(home);}
export async function resolveTrustedTarget(home:string,target:string,write=false){
  const resolved=path.resolve(target); if(isCriticalPath(resolved)) throw new Error('CRITICAL_PATH_DENIED');
  const root=assertAllowedPath(home,{roots:[home],allowMissing:false}); if(resolved===path.resolve(home)||resolved.startsWith(path.resolve(home)+path.sep)) { const canonical=assertAllowedPath(resolved,{roots:[root],allowMissing:true}); return {root,relative:path.relative(root,canonical),access:'read-write' as const}; }
  const items=await load(home); const match=items.sort((a,b)=>b.path.length-a.path.length).find(x=>resolved===x.path||resolved.startsWith(x.path+path.sep));
  if(!match) throw new Error('UNTRUSTED_EXTERNAL_WORKSPACE'); if(write&&match.access!=='read-write') throw new Error('WORKSPACE_READ_ONLY'); const canonical=assertAllowedPath(resolved,{roots:[match.path],allowMissing:true}); return {root:match.path,relative:path.relative(match.path,canonical),access:match.access};
}
export async function externalExactReplace(home:string,file:string,find:string,replacement:string,approved:boolean){
  if(!autonomyProfile().externalWrite)throw new Error('EDITION_READ_ONLY');
  if(!approved) throw new Error('APPROVAL_REQUIRED'); const target=await resolveTrustedTarget(home,file,true); file=path.join(target.root,target.relative); const current=await fs.readFile(file,'utf8');
  const count=current.split(find).length-1; if(count!==1) throw new Error(count===0?'EXACT_TEXT_NOT_FOUND':'EXACT_TEXT_NOT_UNIQUE');
  const backup=path.join(path.resolve(home),'.nusamind','backups',`external_${Date.now()}`,target.relative); await fs.mkdir(path.dirname(backup),{recursive:true}); await fs.copyFile(file,backup);
  await fs.writeFile(file,current.replace(find,replacement),'utf8'); await appendAudit(home,{at:new Date().toISOString(),edition:EDITION,action:'external-exact-replace',status:'SUCCEEDED',workspace:path.resolve(home),subject:file,details:{backup}});
  return {ok:true,file,backup};
}
