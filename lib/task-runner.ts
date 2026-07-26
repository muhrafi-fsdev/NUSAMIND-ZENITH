import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export type TaskSpec={exe:string;args:string[];cwd:string;timeoutMs?:number;maxOutputBytes?:number;env?:NodeJS.ProcessEnv};
const active=new Map<string,ChildProcess>();
export function activeTaskIds(){return [...active.keys()];}
export async function runBoundedTask(spec:TaskSpec){
  const id=`task_${randomUUID()}`; const timeoutMs=Math.max(1000,Math.min(spec.timeoutMs??120000,600000));const max=Math.max(4096,Math.min(spec.maxOutputBytes??128000,2_000_000));
  return await new Promise<{id:string;exitCode:number;output:string;timedOut:boolean;truncated:boolean}>((resolve,reject)=>{
    const child=spawn(spec.exe,spec.args,{cwd:spec.cwd,shell:false,windowsHide:true,env:spec.env});active.set(id,child);let output='';let bytes=0;let truncated=false;let settled=false;
    const append=(chunk:unknown)=>{const s=String(chunk);bytes+=Buffer.byteLength(s);if(Buffer.byteLength(output)<max)output+=(s.slice(0,Math.max(0,max-Buffer.byteLength(output))));if(bytes>max)truncated=true;};
    child.stdout?.on('data',append);child.stderr?.on('data',append);
    const timer=setTimeout(()=>{if(!settled){child.kill();active.delete(id);settled=true;resolve({id,exitCode:-1,output,timedOut:true,truncated});}},timeoutMs);
    child.on('error',err=>{if(!settled){clearTimeout(timer);active.delete(id);settled=true;reject(err);}});
    child.on('close',code=>{if(!settled){clearTimeout(timer);active.delete(id);settled=true;resolve({id,exitCode:code??-1,output,timedOut:false,truncated});}});
  });
}
export function stopBoundedTask(id:string){const child=active.get(id);if(!child)return false;child.kill();active.delete(id);return true;}

export function stopAllBoundedTasks(){const ids=activeTaskIds();for(const id of ids)stopBoundedTask(id);return ids;}
