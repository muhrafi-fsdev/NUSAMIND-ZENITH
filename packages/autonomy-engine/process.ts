import { spawn } from 'node:child_process';
import type { CommandResult } from './types';
export async function runProcess(command:string,args:string[],cwd:string,options?:{env?:NodeJS.ProcessEnv;timeoutMs?:number;input?:string}){
  return await new Promise<CommandResult>((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:options?.env||process.env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
    let stdout='',stderr='',timedOut=false; const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},options?.timeoutMs||120000);
    child.stdout.on('data',d=>stdout+=String(d)); child.stderr.on('data',d=>stderr+=String(d)); child.on('error',reject);
    child.on('close',code=>{clearTimeout(timer);resolve({code:code??-1,stdout:stdout.slice(-200000),stderr:stderr.slice(-200000),timedOut});});
    if(options?.input) child.stdin.write(options.input); child.stdin.end();
  });
}
export function minimalEnvironment(extra:Record<string,string>={}){
  const keys=['PATH','Path','SYSTEMROOT','WINDIR','TEMP','TMP','HOME','USERPROFILE','COMSPEC']; const env:NodeJS.ProcessEnv={};
  for(const k of keys) if(process.env[k]) env[k]=process.env[k]; return {...env,...extra};
}
