import type { RetrievalHit } from './types'; import { diversifyEvidence } from './retrieval-v4';
export type RetrievalV5Result={items:RetrievalHit[];abstain:boolean;reason?:string;coverage:number};
export function rankEvidenceV5(items:RetrievalHit[],query:string,topK=18):RetrievalV5Result{const clean=items.filter((x,i,a)=>Boolean(x?.id)&&a.findIndex(y=>y.id===x.id)===i);const ranked=diversifyEvidence(clean,{topK,maxPerSource:3});const coverage=Math.min(1,ranked.length/Math.max(1,topK));const abstain=ranked.length===0||(!query.trim());return{items:ranked,abstain,reason:abstain?'NO_RELIABLE_EVIDENCE':undefined,coverage:Number(coverage.toFixed(3))};}
export function retrievalV5Status(){return{version:'v5',topK:18,edition:'apex',claimEvidenceGraph:true,bounded:true};}
