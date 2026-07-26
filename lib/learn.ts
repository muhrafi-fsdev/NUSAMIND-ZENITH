import crypto from 'node:crypto';
import { getDatabase } from './db';
export function queueFeedback(sessionId:string,claim:string,verdict:string,evidence=''){const id='fb_'+crypto.randomUUID();getDatabase().prepare('INSERT INTO feedback(id,session_id,claim,verdict,evidence,verified,created_at) VALUES(?,?,?,?,?,?,?)').run(id,sessionId,claim,verdict,evidence,0,new Date().toISOString());return {id,status:'pending-verification'};}
export function verifyFeedback(id:string,approved:boolean){getDatabase().prepare('UPDATE feedback SET verified=? WHERE id=?').run(approved?1:-1,id);return {id,verified:approved};}
