import { z } from 'zod';
import { runAgenticRag } from '@/lib/agentic-rag';
import { retrieveKnowledgeV6 } from '@/lib/retrieval-v6';
import { RELEASE } from '@/lib/release';
import type { AssistantMode } from '@/lib/types';
export const runtime='nodejs';export const dynamic='force-dynamic';
const schema=z.object({query:z.string().min(1),domain:z.string().optional().default('all'),claims:z.array(z.object({id:z.string(),text:z.string(),critical:z.boolean().optional()})).optional().default([])});
export async function POST(req:Request){const body=schema.parse(await req.json());const result=await runAgenticRag({query:body.query,edition:RELEASE.edition,claims:body.claims,retrieve:async(q)=>{const mode:AssistantMode=body.domain==='quran'?'quran':body.domain==='coding'?'coding':'universal';const hits=await retrieveKnowledgeV6(q,mode,String(RELEASE.edition),12);return hits.map((x)=>({source:x.source||'local',text:x.text,contentHash:String(x.id)}));}});return Response.json({ok:true,release:RELEASE.label,result});}
