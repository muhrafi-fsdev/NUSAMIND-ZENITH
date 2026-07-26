import gatesData from '@/data/release/r13.48/gates.json';
export const governanceGates=gatesData;
export function permissionGate(input:{hasPermission:boolean;toolRelevant:boolean;sensitive?:boolean}){return{allowed:input.hasPermission&&input.toolRelevant&&!input.sensitive,action:!input.hasPermission?'deny':input.sensitive?'approval-required':input.toolRelevant?'allow':'deny'};}
export function confidenceScore(input:{support:number;conflicts:number;criticalGaps:number}){const raw=Math.max(0,Math.min(1,input.support/(Math.max(1,input.support+input.conflicts+input.criticalGaps*2))));return{score:Number(raw.toFixed(2)),level:raw>=.8?'HIGH':raw>=.5?'MEDIUM':'LOW',uncertainty:raw<.8};}
export function claimGuard(claims:{text:string;evidenceIds:string[]}[]){return claims.map(c=>c.evidenceIds.length?{...c,status:'SUPPORTED'}:{...c,text:`[UNCERTAIN] ${c.text}`,status:'UNSUPPORTED'});}
export function redact(value:string){return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig,'[EMAIL]').replace(/(?:sk|token|password)[-_:= ]+[A-Za-z0-9_-]{8,}/ig,'[SECRET]');}
export function fallbackState(reason:string){return{status:'DEGRADED',truthful:true,reason};}
