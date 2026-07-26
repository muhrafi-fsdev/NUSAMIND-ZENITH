import { randomUUID } from 'node:crypto';
import { AuditRepository } from './repos';
const repo=new AuditRepository();
const SECRET=/(token|password|secret|api[_-]?key|authorization)\s*[:=]\s*[^\s,"'}]+/gi;
function mask(value:unknown):unknown{if(typeof value==='string')return value.replace(SECRET,'$1=***');if(Array.isArray(value))return value.map(mask);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).map(([k,v])=>[k,/token|password|secret|key|authorization/i.test(k)?'***':mask(v)]));return value;}
export function createRequestId(){return `req_${randomUUID()}`;}
export function traceEvent(requestId:string,event:string,status='ok',detail:Record<string,unknown>={},sessionId?:string,latencyMs?:number){repo.append(event,status,mask(detail) as Record<string,unknown>,requestId,sessionId,latencyMs);}
export function maskedReplay(value:unknown){return mask(value);}
