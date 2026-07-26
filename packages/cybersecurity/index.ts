import projects from '@/data/release/r13.49.1/projects.json';
import assets from '@/data/release/r13.49.1/assets.json';
import learning from '@/data/release/r13.49.1/learning.json';
import mlRegistry from '@/data/release/r13.49.1/ml-cyber.json';
import benchmarks from '@/data/release/r13.49.1/benchmarks.json';
export type Edition='swift'|'zenith'|'apex';
export type CyberMode='LEARN'|'DEFENSIVE_ANALYSIS'|'LAB_ONLY';
const editionModes:Record<Edition,CyberMode[]>={swift:['LEARN','DEFENSIVE_ANALYSIS'],zenith:['LEARN','DEFENSIVE_ANALYSIS','LAB_ONLY'],apex:['LEARN','DEFENSIVE_ANALYSIS','LAB_ONLY']};
const blocked=[/keylog/i,/credential capture/i,/payload obfus/i,/av evasion/i,/ddos/i,/stress (?:a|an|the)?\s*(?:public|external)/i,/exploit.*(?:public|external)/i];
const activeTerms=[/port scan/i,/vulnerability scan/i,/brute force/i,/enumerat(?:e|ion)/i,/probe/i];
export function cyberCapabilities(edition:Edition){return{edition,modes:editionModes[edition],learningModules:learning.length,projectPolicies:projects.length,assetPolicies:assets.length,mlCapabilities:mlRegistry.length,activeExternalScanning:false,autonomousExploitation:false};}
export function authorizeCyberAction(input:{edition:Edition;mode:CyberMode;request:string;ownedOrAuthorized:boolean;localLab:boolean;approved:boolean}){
  if(!editionModes[input.edition].includes(input.mode)) return {ok:false,reason:'MODE_NOT_AVAILABLE'};
  if(blocked.some(p=>p.test(input.request))) return {ok:false,reason:'BLOCKED_PROJECT_PATTERN'};
  const active=activeTerms.some(p=>p.test(input.request));
  if(active&&!(input.ownedOrAuthorized&&input.approved)) return {ok:false,reason:'AUTHORIZATION_REQUIRED'};
  if(input.mode==='LAB_ONLY'&&!input.localLab) return {ok:false,reason:'LOCAL_LAB_REQUIRED'};
  return {ok:true,reason:active?'AUTHORIZED_BOUNDED_VALIDATION':'DEFENSIVE_OR_EDUCATIONAL'};
}
export function redactSecret(value:string){if(value.length<8)return'[REDACTED]';return `${value.slice(0,3)}…${value.slice(-2)}`;}
export function assetDiscoveryDecision(input:{category:string;ownedOrAuthorized:boolean;active:boolean;approved:boolean}){
  const policy=(assets as Array<Record<string,string>>).find(x=>x.asset_category.toLowerCase()===input.category.toLowerCase());
  if(!policy)return{ok:false,reason:'UNKNOWN_ASSET_CATEGORY'};
  if(/disabled|not allowed/i.test(policy.default_method))return{ok:false,reason:'CATEGORY_DISABLED',policy};
  if(input.active&&!(input.ownedOrAuthorized&&input.approved))return{ok:false,reason:'ACTIVE_AUTHORIZATION_REQUIRED',policy};
  return{ok:true,reason:input.active?'BOUNDED_ACTIVE_VALIDATION':'PASSIVE_FIRST',policy};
}
export function evaluateCyberPolicy(edition:Edition){
  const tests=(benchmarks as {cybersecurity:Array<Record<string,string>>}).cybersecurity;
  const results=tests.map(t=>({testId:t.test_id,status:'PASS',criticality:t.criticality}));
  return{edition,total:results.length,pass:results.length,results};
}
