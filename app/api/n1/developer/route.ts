import { editionProfile, permissionFor, planTask, resolveMode, scanProject, toolRegistry, verifyResult } from '@/packages/developer-intelligence';
export const runtime='nodejs'; export const dynamic='force-dynamic';
function authorized(req:Request){const token=process.env.CODING_AGENT_TOKEN; if(!token)return ['localhost','127.0.0.1'].some(x=>(req.headers.get('host')||'').startsWith(x)); return req.headers.get('x-coding-token')===token;}
export async function GET(){return Response.json({ok:true,release:'N1.1',profile:editionProfile(),tools:toolRegistry});}
export async function POST(req:Request){try{const body=await req.json() as Record<string,unknown>;const action=String(body.action||'plan');if(['scan','plan','permission','verify'].includes(action)&&!authorized(req))return Response.json({ok:false,error:'LOCALHOST_OR_TOKEN_REQUIRED'},{status:403});
if(action==='scan')return Response.json({ok:true,project:await scanProject(String(body.workspace||process.cwd()))});
if(action==='permission'){const m=resolveMode(String(body.mode||'ASK'));if(!m.ok)return Response.json({ok:false,...m},{status:400});return Response.json({ok:true,permission:permissionFor({mode:m.mode,tool:String(body.tool||'read-file') as never,target:String(body.target||''),command:String(body.command||''),approved:body.approved===true})});}
if(action==='verify')return Response.json({ok:true,result:verifyResult(body as never)});
const m=resolveMode(String(body.mode||'PLAN'));if(!m.ok)return Response.json({ok:false,...m},{status:400});return Response.json({ok:true,plan:planTask({mode:m.mode,request:String(body.request||''),files:Array.isArray(body.files)?body.files.map(String):[]})});
}catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:422});}}
