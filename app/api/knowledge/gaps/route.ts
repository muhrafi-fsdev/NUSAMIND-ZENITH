import { getKnowledgeGaps, recordKnowledgeGap } from '@/lib/knowledge-center';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(req:Request){const url=new URL(req.url);return Response.json(getKnowledgeGaps(Number(url.searchParams.get('limit')||30)));}
export async function POST(req:Request){const body=await req.json().catch(()=>({}));if(!body.query)return Response.json({ok:false,error:'QUERY_REQUIRED'},{status:400});return Response.json({ok:true,gap:recordKnowledgeGap(String(body.query),String(body.detail||''))},{status:201});}
