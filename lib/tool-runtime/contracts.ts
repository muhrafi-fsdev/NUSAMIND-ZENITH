
import { z } from 'zod';
export type ToolRisk='low'|'medium'|'high';
export type ToolContract<T extends z.ZodTypeAny>= {id:string;description:string;schema:T;risk:ToolRisk;permission:'read-only'|'confirm'|'human';timeoutMs:number;expectedState:string;execute:(input:z.infer<T>,signal:AbortSignal)=>Promise<unknown>|unknown};
export async function executeContract<T extends z.ZodTypeAny>(contract:ToolContract<T>,raw:unknown,granted:'read-only'|'confirm'|'human'='read-only'){
  const parsed=contract.schema.safeParse(raw);
  if(!parsed.success)return{ok:false,error:'INVALID_ARGUMENTS',issues:parsed.error.issues};
  const order={ 'read-only':0,confirm:1,human:2};
  if(order[granted]<order[contract.permission])return{ok:false,error:'PERMISSION_REQUIRED',required:contract.permission};
  const started=Date.now(), controller=new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{const error=new Error('TOOL_TIMEOUT');controller.abort(error);reject(error);},contract.timeoutMs);});
    const result=await Promise.race([Promise.resolve().then(()=>contract.execute(parsed.data,controller.signal)),timeout]);
    return{ok:true,result,latencyMs:Date.now()-started,expectedState:contract.expectedState};
  } finally { clearTimeout(timer); }
}
export function verifyExpectedState(expected:string,actual:unknown){const text=typeof actual==='string'?actual:JSON.stringify(actual);return{ok:expected===text,expected,actual:String(text).slice(0,1000)};}
export function requiredPermission(risk:ToolRisk){return risk==='high'?'human':risk==='medium'?'confirm':'read-only';}
