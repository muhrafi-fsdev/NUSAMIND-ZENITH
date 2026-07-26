import { z } from 'zod'; import { analyzeHealthRequest, buildEmergencyHealthAnswer } from '@/lib/health-intel';
export const runtime='nodejs';export const dynamic='force-dynamic';const schema=z.object({text:z.string().min(1).max(20000)});
export async function POST(req:Request){const parsed=schema.safeParse(await req.json().catch(()=>null));if(!parsed.success)return Response.json({ok:false,error:'INVALID_HEALTH_REQUEST'},{status:400});const analysis=analyzeHealthRequest(parsed.data.text);return Response.json({ok:true,analysis,emergencyAnswer:buildEmergencyHealthAnswer(analysis)});}
