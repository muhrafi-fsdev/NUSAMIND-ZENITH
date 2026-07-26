import { promises as fs } from 'node:fs';
import path from 'node:path';
import { appendAudit } from './audit';
import { approvalPhrase, autonomyProfile, EDITION, requireApproval } from './policy';
import { runProcess } from './process';
import { resolveTrustedTarget } from './workspace';
export type DestructiveRequest={kind:'delete-path'|'git-reset-hard'|'git-clean'|'npm-cache-clean'|'docker-prune';target?:string;ref?:string;approval?:string};
export async function planDestructive(home:string,r:DestructiveRequest){const subject=r.target||r.ref||r.kind;let preview:string[]=[];if(r.kind==='git-clean'){const x=await runProcess('git',['clean','-nd'],home);preview=x.stdout.split(/\r?\n/).filter(Boolean);}return{kind:r.kind,subject,preview,approval:approvalPhrase({action:r.kind,subject})};}
async function copyIfExists(src:string,dst:string){try{await fs.mkdir(path.dirname(dst),{recursive:true});await fs.cp(src,dst,{recursive:true,force:true});return true;}catch{return false;}}
export async function executeDestructive(home:string,r:DestructiveRequest){if(!autonomyProfile().destructive)throw new Error('EDITION_PLAN_ONLY');const plan=await planDestructive(home,r),a=requireApproval(r.approval,{action:r.kind,subject:plan.subject});if(!a.ok)throw new Error(`APPROVAL_REQUIRED:${a.expected}`);const backupRoot=path.join(path.resolve(home),'.nusamind','backups',`${r.kind}_${Date.now()}`);let result:unknown;
  if(r.kind==='delete-path'){if(!r.target)throw new Error('TARGET_REQUIRED');await resolveTrustedTarget(home,r.target,true);const resolved=path.resolve(r.target);if(!(await copyIfExists(resolved,path.join(backupRoot,path.basename(resolved)))))throw new Error('BACKUP_FAILED');await fs.rm(resolved,{recursive:true,force:false});result={deleted:resolved,backupRoot};}
  else if(r.kind==='git-reset-hard'){const diff=await runProcess('git',['diff','HEAD'],home);await fs.mkdir(backupRoot,{recursive:true});await fs.writeFile(path.join(backupRoot,'working-tree.patch'),diff.stdout);result=await runProcess('git',['reset','--hard',r.ref||'HEAD'],home);}
  else if(r.kind==='git-clean'){const names=(await runProcess('git',['ls-files','--others','--exclude-standard'],home)).stdout.split(/\r?\n/).filter(Boolean);for(const n of names)await copyIfExists(path.join(home,n),path.join(backupRoot,n));result=await runProcess('git',['clean','-fd'],home);}
  else if(r.kind==='npm-cache-clean')result=await runProcess('npm',['cache','clean','--force'],home,{timeoutMs:180000});
  else {if(EDITION!=='apex')throw new Error('DOCKER_PRUNE_REQUIRES_APEX');result=await runProcess('docker',['system','prune','--force'],home,{timeoutMs:300000});}
  await appendAudit(home,{at:new Date().toISOString(),edition:EDITION,action:r.kind,status:'SUCCEEDED',workspace:path.resolve(home),subject:plan.subject,details:{backupRoot}});return{ok:true,backupRoot,result};}
