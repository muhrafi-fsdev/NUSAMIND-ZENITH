
import adapterData from '@/data/runtime/qwen-adapter.json';
export type QwenProfile={model:string;family:'Qwen';release:string;chatTemplate:string;toolCallFormat:string;structuredOutput:'json-schema';contextWindow:number;safeContextWindow:number;thinkingSupport:boolean;temperatureByTask:Record<string,number>;topPByTask:Record<string,number>;quantization:string;resource:{ramGb:number;vramGb:number;latencyTargetMs:number};knownFailures:string[];status:'CONFIGURED'|'PROFILED'|'DEGRADED'};
const config=adapterData as {profile:QwenProfile;requirements:unknown[]};
export function qwenProfile(){return structuredClone(config.profile);}
export function buildQwenMessages(system:string,user:string){return[{role:'system' as const,content:system},{role:'user' as const,content:user}];}
export function parseStructuredOutput<T>(raw:string,validate:(value:unknown)=>value is T){const cleaned=raw.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();let value:unknown;try{value=JSON.parse(cleaned);}catch{return{ok:false as const,error:'INVALID_JSON',raw:cleaned};}if(!validate(value))return{ok:false as const,error:'SCHEMA_MISMATCH',raw:cleaned};return{ok:true as const,value};}
export type ToolCall={name:string;arguments:Record<string,unknown>};
export function parseQwenToolCall(raw:string,allowed:string[]){const parsed=parseStructuredOutput<ToolCall>(raw,(x):x is ToolCall=>Boolean(x&&typeof x==='object'&&typeof (x as ToolCall).name==='string'&&typeof (x as ToolCall).arguments==='object'));if(!parsed.ok)return parsed;if(!allowed.includes(parsed.value.name))return{ok:false as const,error:'TOOL_NOT_ALLOWED',raw};return parsed;}
export function qwenAdapterStatus(){return{release:'N1.4',profile:config.profile,requirements:config.requirements,configured:Boolean(config.profile.chatTemplate&&config.profile.toolCallFormat),nativeThinkingClaim:config.profile.thinkingSupport};}
