import { getDatabase } from './db';
import { AuditRepository } from './repos';
import type { MonitoringSummary } from './types';
const audit=new AuditRepository();
export async function appendInteractionLog(payload:Record<string,unknown>):Promise<void>{audit.append('interaction','ok',payload,String(payload.requestId||''),String(payload.sessionId||''),Number(payload.latencyMs||0));}
export async function getMonitoringSummary():Promise<MonitoringSummary>{const db=getDatabase();const session=Number((db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as {n?:number}|undefined)?.n||0);const memory=Number((db.prepare('SELECT COUNT(DISTINCT session_id) AS n FROM memory').get() as {n?:number}|undefined)?.n||0);const logs=Number((db.prepare('SELECT COUNT(*) AS n FROM audit').get() as {n?:number}|undefined)?.n||0);const latest=db.prepare('SELECT session_id,created_at FROM audit ORDER BY created_at DESC LIMIT 1').get() as {session_id?:string;created_at?:string}|undefined;return{totalSessions:session,totalMemoryFiles:memory,totalInteractionLogs:logs,latestSessionId:latest?.session_id,latestInteractionAt:latest?.created_at};}
