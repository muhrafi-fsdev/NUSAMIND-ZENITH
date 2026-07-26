import { createHash } from 'node:crypto';
import { CacheRepository } from './repos';
import { RELEASE } from './release';
const cache=new CacheRepository();
export function semanticCacheKey(query:string,domain:string,scope='public'){return createHash('sha256').update([query.trim().toLowerCase(),domain,scope,RELEASE.version].join('|')).digest('hex');}
export function readSemanticCache<T>(key:string,scope='public'){return cache.get<T>(key,scope,RELEASE.version);}
export function writeSemanticCache(key:string,value:unknown,scope='public',ttlMs=15*60_000){cache.set(key,value,scope,RELEASE.version,ttlMs);}
