import path from 'node:path';
import { promises as fs } from 'node:fs';
import { appendAudit } from './audit';
import { approvalPhrase, autonomyProfile, EDITION, protectedBranches, requireApproval, safeIdentifier, verificationReady } from './policy';
import { runProcess } from './process';
import type { VerificationEvidence } from './types';
const protectedFile=/(^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|.*\.pem|.*\.p12|credentials?\.json|cookies?\.txt)$/i;
const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{20,}\b/,/(?:api[_-]?key|password|secret|token)\s*[:=]\s*['\"][^'\"]{8,}['\"]/i];
async function git(cwd:string,args:string[]){const r=await runProcess('git',args,cwd,{timeoutMs:180000});if(r.code!==0)throw new Error(`GIT_FAILED: ${r.stderr||r.stdout}`);return r.stdout.trim();}
export async function secretScan(workspace:string){
  const names=new Set<string>(); for(const args of [['diff','--name-only','--cached'],['diff','--name-only'],['ls-files','--others','--exclude-standard']]){try{for(const n of (await git(workspace,args)).split(/\r?\n/).filter(Boolean))names.add(n);}catch{}}
  const findings:Array<{file:string;reason:string}>=[];for(const file of names){if(protectedFile.test(file)){findings.push({file,reason:'PROTECTED_FILENAME'});continue;}try{const data=await fs.readFile(path.join(workspace,file));if(data.length>2_000_000)continue;const text=data.toString('utf8');if(secretPatterns.some(rx=>rx.test(text)))findings.push({file,reason:'POTENTIAL_SECRET'});}catch{}}
  return{ok:findings.length===0,checked:names.size,findings};
}
export async function planGitPush(workspace:string,options?:{remote?:string;branch?:string;force?:boolean}){
  const remote=safeIdentifier(options?.remote||'origin','remote'),branch=safeIdentifier(options?.branch||await git(workspace,['branch','--show-current']),'branch');
  const [status,scan]=await Promise.all([git(workspace,['status','--porcelain=v1']),secretScan(workspace)]);let remoteSha='';try{remoteSha=await git(workspace,['ls-remote','--heads',remote,`refs/heads/${branch}`]).then(x=>x.split(/\s+/)[0]||'');}catch{}
  return{edition:EDITION,remote,branch,force:options?.force===true,protectedBranch:protectedBranches.has(branch),statusLines:status?status.split(/\r?\n/).length:0,secretScan:scan,remoteSha,approval:approvalPhrase({action:options?.force?'force-push':'git-push',subject:branch})};
}
export async function executeGitPush(workspace:string,input:{remote?:string;branch?:string;force?:boolean;approval?:string;verification?:Partial<VerificationEvidence>;stageAll?:boolean;commitMessage?:string}){
  const p=autonomyProfile(); if(!p.executePush)throw new Error('EDITION_PLAN_ONLY'); if(input.force&&!p.forcePush)throw new Error('FORCE_PUSH_NOT_AVAILABLE');
  const plan=await planGitPush(workspace,input);const a=requireApproval(input.approval,{action:input.force?'force-push':'git-push',subject:plan.branch});if(!a.ok)throw new Error(`APPROVAL_REQUIRED:${a.expected}`);
  const verify=verificationReady(input.verification);if(!verify.ok)throw new Error(`VERIFICATION_REQUIRED:${verify.missing.join(',')}`);if(!plan.secretScan.ok)throw new Error('SECRET_SCAN_FAILED');
  if(plan.protectedBranch&&input.force&&EDITION!=='apex')throw new Error('PROTECTED_BRANCH_FORCE_REQUIRES_APEX');
  if(input.stageAll){await git(workspace,['add','-A']);const staged=await secretScan(workspace);if(!staged.ok)throw new Error('SECRET_SCAN_FAILED_AFTER_STAGE');if(input.commitMessage){await git(workspace,['commit','-m',input.commitMessage]);}}
  let backupBranch:string|undefined;
  if(input.force){await git(workspace,['fetch',plan.remote,plan.branch]);const remoteSha=await git(workspace,['rev-parse',`${plan.remote}/${plan.branch}`]);backupBranch=`backup/${plan.branch}-${new Date().toISOString().replace(/[:.]/g,'-')}`;await git(workspace,['push',plan.remote,`${remoteSha}:refs/heads/${backupBranch}`]);await git(workspace,['push',`--force-with-lease=${plan.branch}:${remoteSha}`,plan.remote,`HEAD:${plan.branch}`]);}
  else await git(workspace,['push',plan.remote,`HEAD:${plan.branch}`]);
  await appendAudit(workspace,{at:new Date().toISOString(),edition:EDITION,action:input.force?'force-push':'automatic-git-push',status:'SUCCEEDED',workspace:path.resolve(workspace),subject:plan.branch,details:{remote:plan.remote,backupBranch}});return{ok:true,branch:plan.branch,remote:plan.remote,backupBranch,forceWithLease:input.force===true};
}
