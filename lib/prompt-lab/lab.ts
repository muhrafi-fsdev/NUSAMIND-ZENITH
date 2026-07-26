
import { createHash } from 'node:crypto';
export type PromptCase={id:string;input:string;mustInclude?:string[];mustNotInclude?:string[]};
export function mutatePrompt(input:string){const variants=[input,input.replace(/\s+/g,'  '),`Tolong ${input}`,input.split(' ').reverse().join(' '),input.replace(/tidak/gi,'nggak'),`[bilingual] ${input} / answer in Indonesian`];return [...new Set(variants)].map((text,index)=>({id:`m${index+1}`,text}));}
export function evaluatePrompt(output:string,test:PromptCase){const lower=output.toLowerCase();const missing=(test.mustInclude||[]).filter((x)=>!lower.includes(x.toLowerCase()));const forbidden=(test.mustNotInclude||[]).filter((x)=>lower.includes(x.toLowerCase()));return{ok:missing.length===0&&forbidden.length===0,missing,forbidden};}
export function experimentHash(input:{prompt:string;model:string;dataset:string}){return createHash('sha256').update(`${input.prompt}|${input.model}|${input.dataset}`).digest('hex');}
export function proposePromptCandidate(input:{current:string;failureCluster:string[];authorized:boolean}){if(!input.authorized)return{ok:false,error:'HUMAN_REVIEW_REQUIRED'};const candidate=`${input.current}\n\nRegression constraints:\n${input.failureCluster.map((x)=>`- ${x}`).join('\n')}`;return{ok:true,candidate,status:'CANDIDATE',automaticActivation:false};}
