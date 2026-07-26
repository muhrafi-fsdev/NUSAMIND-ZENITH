import taxonomyData from '@/data/release/r13.48/memory-types.json';
export type MemoryRecord={id:string;key:string;workspaceId:string;type:string;value:string;createdAt:string;verified:boolean;consent:boolean;supersedes?:string;expiresAt?:string;rawChainOfThought?:never};
export const memoryTaxonomy=taxonomyData;
export function canWriteMemory(type:string,consent:boolean,workspaceId:string){const permanent=/long|episodic|lesson|artifact|workflow/i.test(type);return{ok:Boolean(workspaceId)&&(!permanent||consent),reason:!workspaceId?'workspace-required':permanent&&!consent?'consent-required':'allowed'};}
export function canReadMemory(record:MemoryRecord,workspaceId:string){return record.workspaceId===workspaceId;}
export function selectFreshMemory(records:MemoryRecord[],workspaceId:string,key:string,now=new Date()){const usable=records.filter(r=>r.workspaceId===workspaceId&&r.key===key&&r.verified&&(!r.expiresAt||new Date(r.expiresAt)>now));const superseded=new Set(usable.map(r=>r.supersedes).filter(Boolean));return usable.filter(r=>!superseded.has(r.id)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0]||null;}
export function memoryPrivacy(){return{workspaceIsolation:true,consentForPermanent:true,rawChainOfThoughtStored:false,deletionSupported:true};}
