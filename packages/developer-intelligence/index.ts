import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type Edition = 'swift' | 'zenith' | 'apex';
export type DeveloperMode = 'ASK' | 'PLAN' | 'BUILD' | 'REVIEW' | 'REPAIR';
export type PermissionDecision = 'ALLOW' | 'ASK' | 'DENY' | 'READ_ONLY' | 'SANDBOX_ONLY' | 'ALLOW_ONCE' | 'ALLOW_SESSION';
export type ToolName = 'read-file'|'list-files'|'glob-files'|'grep-code'|'git-status'|'git-diff'|'lsp-diagnostics'|'run-typecheck'|'run-tests'|'run-build'|'apply-exact-patch'|'rollback-patch';

const EDITION = process.env.NUSAMIND_EDITION as Edition || 'zenith';
const modes: Record<Edition, DeveloperMode[]> = {
  swift: ['ASK','PLAN','REVIEW'],
  zenith: ['ASK','PLAN','BUILD','REVIEW','REPAIR'],
  apex: ['ASK','PLAN','BUILD','REVIEW','REPAIR'],
};
const limits = {
  swift: { maxSteps: 5, maxSkills: 1, maxParallel: 1, write: false },
  zenith: { maxSteps: 10, maxSkills: 3, maxParallel: 2, write: true },
  apex: { maxSteps: 16, maxSkills: 5, maxParallel: 4, write: true },
} satisfies Record<Edition, {maxSteps:number;maxSkills:number;maxParallel:number;write:boolean}>;

const protectedNames = [/^\.env(?:\..*)?$/i,/credential/i,/secret/i,/private[-_. ]?key/i,/id_rsa/i,/cookies?/i];
const destructive = /(?:^|\s)(?:rm\s+-rf|del\s+\/s|rmdir\s+\/s|format(?:\.com)?|diskpart|shutdown|reboot|git\s+push\s+--force|git\s+reset\s+--hard)(?:\s|$)/i;
const safeCommands = [/^git\s+(?:status|diff|log)(?:\s|$)/i,/^(?:npm|pnpm|yarn)\s+(?:test|run\s+(?:check|lint|test|build))(?:\s|$)/i,/^npx\s+tsc\s+--noEmit(?:\s|$)/i,/^python\s+-m\s+pytest(?:\s|$)/i];

export function editionProfile(edition: Edition = EDITION) { return { edition, modes: modes[edition], ...limits[edition] }; }
export function resolveMode(requested: string, edition: Edition = EDITION) {
  const value = requested.toUpperCase() as DeveloperMode;
  if (!modes[edition].includes(value)) return { ok:false, mode:'ASK' as DeveloperMode, reason:'MODE_NOT_AVAILABLE_FOR_EDITION' };
  return { ok:true, mode:value };
}
export function isProtectedPath(input: string) {
  const normalized = input.replace(/\\/g,'/');
  return normalized.split('/').some(part => protectedNames.some(rx=>rx.test(part)));
}
export function withinWorkspace(workspace: string, target: string) {
  const root = path.resolve(workspace); const resolved = path.resolve(root,target);
  return resolved === root || resolved.startsWith(root + path.sep);
}
export function permissionFor(input:{edition?:Edition;mode:DeveloperMode;tool:ToolName;target?:string;command?:string;approved?:boolean}) {
  const edition=input.edition||EDITION; const p=limits[edition];
  if (input.target && isProtectedPath(input.target)) return {decision:'DENY' as PermissionDecision,reason:'PROTECTED_PATH'};
  if (input.command && destructive.test(input.command)) return {decision:'DENY' as PermissionDecision,reason:'DESTRUCTIVE_COMMAND'};
  if (['ASK','PLAN','REVIEW'].includes(input.mode) && ['apply-exact-patch','rollback-patch'].includes(input.tool)) return {decision:'DENY' as PermissionDecision,reason:'READ_ONLY_MODE'};
  if (!p.write && ['apply-exact-patch','rollback-patch'].includes(input.tool)) return {decision:'DENY' as PermissionDecision,reason:'SWIFT_READ_ONLY'};
  if (input.command && safeCommands.some(rx=>rx.test(input.command))) return {decision:'ALLOW' as PermissionDecision,reason:'SAFE_COMMAND_ALLOWLIST'};
  if (['apply-exact-patch','rollback-patch','run-build','run-tests'].includes(input.tool)) return input.approved?{decision:'ALLOW_ONCE' as PermissionDecision,reason:'USER_APPROVED'}:{decision:'ASK' as PermissionDecision,reason:'APPROVAL_REQUIRED'};
  return {decision:'ALLOW' as PermissionDecision,reason:'READ_OR_DIAGNOSTIC_TOOL'};
}

export const toolRegistry: Array<{name:ToolName;risk:'low'|'medium'|'high';writes:boolean}> = [
  {name:'read-file',risk:'low',writes:false},{name:'list-files',risk:'low',writes:false},{name:'glob-files',risk:'low',writes:false},{name:'grep-code',risk:'low',writes:false},
  {name:'git-status',risk:'low',writes:false},{name:'git-diff',risk:'low',writes:false},{name:'lsp-diagnostics',risk:'low',writes:false},
  {name:'run-typecheck',risk:'medium',writes:false},{name:'run-tests',risk:'medium',writes:false},{name:'run-build',risk:'medium',writes:false},
  {name:'apply-exact-patch',risk:'high',writes:true},{name:'rollback-patch',risk:'high',writes:true},
];

const ignored = new Set(['node_modules','.next','.git','dist','build','coverage','.venv','__pycache__']);
export async function scanProject(workspace:string) {
  const root=path.resolve(workspace); const files:string[]=[]; const languages:Record<string,number>={};
  async function walk(dir:string){
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      if(ignored.has(entry.name)) continue; const full=path.join(dir,entry.name); const rel=path.relative(root,full).replace(/\\/g,'/');
      if(entry.isDirectory()) await walk(full); else {files.push(rel); const ext=path.extname(entry.name).toLowerCase()||'[none]'; languages[ext]=(languages[ext]||0)+1;}
      if(files.length>=5000) return;
    }
  }
  await walk(root);
  const scripts=await readPackageScripts(root);
  return {root,fileCount:files.length,languages,scripts,entryPoints:files.filter(f=>/(?:^|\/)(?:package\.json|pyproject\.toml|requirements\.txt|composer\.json|src\/index\.|app\/page\.)/.test(f)).slice(0,40),protectedFiles:files.filter(isProtectedPath).map(()=> '[REDACTED]'),truncated:files.length>=5000};
}
async function readPackageScripts(root:string){try{const v=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));return v.scripts||{};}catch{return {};}}
export function selectContext(files:string[],query:string,budget=24){const tokens=query.toLowerCase().split(/\W+/).filter(x=>x.length>2);return files.map(file=>({file,score:tokens.reduce((n,t)=>n+(file.toLowerCase().includes(t)?3:0),0)+(file.includes('src/')?1:0)})).sort((a,b)=>b.score-a.score||a.file.localeCompare(b.file)).slice(0,budget);}
export function planTask(input:{edition?:Edition;mode:DeveloperMode;request:string;files?:string[]}){const edition=input.edition||EDITION;const profile=editionProfile(edition);const selected=selectContext(input.files||[],input.request);return{edition,mode:input.mode,request:input.request,steps:['inspect-project-context','identify-affected-files','propose-minimal-change','request-approval-if-writing','run-verification','report-diff-and-evidence'].slice(0,profile.maxSteps),selectedFiles:selected,writeAllowed:profile.write&&['BUILD','REPAIR'].includes(input.mode),approvalRequired:['BUILD','REPAIR'].includes(input.mode),maxSteps:profile.maxSteps};}
export function verifyResult(input:{parsed?:boolean;typecheck?:boolean;tests?:boolean;build?:boolean;security?:boolean}){const checks={parsed:input.parsed!==false,typecheck:input.typecheck===true,tests:input.tests===true,build:input.build===true,security:input.security!==false};const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);return{ok:failed.length===0,checks,failed,status:failed.length?'NEEDS_REPAIR':'VERIFIED'};}
export async function createCheckpoint(workspace:string,files:string[]){const root=path.resolve(workspace);const id=`cp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;const store=path.join(root,'.nusamind','checkpoints',id);await fs.mkdir(store,{recursive:true});const manifest:{id:string;createdAt:string;files:Array<{path:string;sha256:string}>}={id,createdAt:new Date().toISOString(),files:[]};for(const rel of files){if(!withinWorkspace(root,rel)||isProtectedPath(rel))continue;const src=path.join(root,rel);try{const data=await fs.readFile(src);const dst=path.join(store,rel);await fs.mkdir(path.dirname(dst),{recursive:true});await fs.writeFile(dst,data);manifest.files.push({path:rel,sha256:crypto.createHash('sha256').update(data).digest('hex')});}catch{}}
await fs.writeFile(path.join(store,'checkpoint.json'),JSON.stringify(manifest,null,2));return manifest;}
export async function restoreCheckpoint(workspace:string,id:string){const root=path.resolve(workspace);const store=path.join(root,'.nusamind','checkpoints',id);const manifest=JSON.parse(await fs.readFile(path.join(store,'checkpoint.json'),'utf8')) as {files:Array<{path:string}>};for(const item of manifest.files){if(!withinWorkspace(root,item.path)||isProtectedPath(item.path))continue;const src=path.join(store,item.path),dst=path.join(root,item.path);await fs.mkdir(path.dirname(dst),{recursive:true});await fs.copyFile(src,dst);}return{ok:true,restored:manifest.files.length,id};}
export function detectDoomLoop(calls:Array<{tool:string,input:unknown}>){if(calls.length<3)return false;const last=calls.slice(-3).map(x=>JSON.stringify(x));return last.every(x=>x===last[0]);}
