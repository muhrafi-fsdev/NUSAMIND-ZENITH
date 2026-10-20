import path from 'node:path';
import type { ApprovalContext, Capability, Edition, VerificationEvidence } from './types';

const requestedEdition = process.env.NUSAMIND_EDITION;
export const EDITION: Edition = requestedEdition === 'apex' || requestedEdition === 'swift' ? requestedEdition : 'zenith';
export const protectedBranches = new Set(['main','master','production','release','stable']);
const profiles = {
  swift: { executePush:false, forcePush:false, destructive:false, credentialWrite:false, externalWrite:false, mcpCall:false, deploy:['preview'], autoDeploy:false, softSteps:6, hardSteps:10, maxRuntimeMinutes:30, maxParallel:1 },
  zenith:{ executePush:true, forcePush:true, destructive:true, credentialWrite:true, externalWrite:true, mcpCall:true, deploy:['preview','staging'], autoDeploy:false, softSteps:20, hardSteps:40, maxRuntimeMinutes:90, maxParallel:2 },
  apex:  { executePush:true, forcePush:true, destructive:true, credentialWrite:true, externalWrite:true, mcpCall:true, deploy:['preview','staging','production'], autoDeploy:true, softSteps:40, hardSteps:150, maxRuntimeMinutes:120, maxParallel:4 },
} as const;
export function autonomyProfile(edition: Edition = EDITION){ return { edition, ...profiles[edition] }; }
export function capabilityAllowed(capability: Capability, edition: Edition = EDITION){
  const p=profiles[edition];
  switch(capability){
    case 'automatic-git-push': return p.executePush;
    case 'force-push': return p.forcePush;
    case 'destructive-action': return p.destructive;
    case 'credential-vault': return edition !== 'swift';
    case 'external-workspace-edit': return p.externalWrite;
    case 'unverified-mcp': return p.mcpCall;
    case 'autonomous-deployment': return edition !== 'swift';
    case 'extended-agent-loop': return true;
  }
}
export function approvalPhrase(ctx: ApprovalContext){
  const subject=(ctx.subject||'ACTION').replace(/[^a-zA-Z0-9._/-]/g,'_');
  const env=(ctx.environment||'').replace(/[^a-zA-Z0-9_-]/g,'_');
  return ['APPROVE',ctx.action.toUpperCase(),subject,env].filter(Boolean).join(' ');
}
export function requireApproval(provided:string|undefined,ctx:ApprovalContext){
  const expected=approvalPhrase(ctx); return {ok:provided===expected,expected};
}
export function verificationReady(v:Partial<VerificationEvidence>|undefined){
  if(!v) return {ok:false,missing:['parsed','typecheck','tests','build','security','secretScan']};
  const required=(['parsed','typecheck','tests','build','security','secretScan'] as const);
  const missing=required.filter(k=>v[k]!==true); return {ok:missing.length===0,missing};
}
const criticalRoots = process.platform==='win32'
 ? [/^[a-z]:[\\/]?$/i,/^[a-z]:[\\/]windows(?:[\\/]|$)/i,/^[a-z]:[\\/]program files/i,/^[a-z]:[\\/]users[\\/][^\\/]+$/i]
 : [/^\/$/,/^\/etc(?:\/|$)/,/^\/usr(?:\/|$)/,/^\/bin(?:\/|$)/,/^\/home\/[^/]+$/];
export function isCriticalPath(input:string){ const p=path.resolve(input); return criticalRoots.some(rx=>rx.test(p)); }
export function safeIdentifier(value:string,label='identifier'){
  if(!/^[a-zA-Z0-9._/-]{1,160}$/.test(value)) throw new Error(`INVALID_${label.toUpperCase()}`); return value;
}
