import { authorizeKnowledgeWrite, importKnowledgeBatch } from '@/lib/knowledge-center';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function POST(req:Request){if(!authorizeKnowledgeWrite(req))return Response.json({ok:false,error:'FORBIDDEN'},{status:403});const result=importKnowledgeBatch(await req.json().catch(()=>({})));return Response.json(result,{status:Number(result.status||200)});}
