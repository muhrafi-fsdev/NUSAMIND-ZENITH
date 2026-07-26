import {RELEASE} from '@/lib/release';import {authorizeCyberAction,assetDiscoveryDecision,cyberCapabilities,evaluateCyberPolicy} from '@/packages/cybersecurity';
export const runtime='nodejs';export const dynamic='force-dynamic';
const edition=RELEASE.edition as 'swift'|'zenith'|'apex';
export async function GET(){return Response.json({ok:true,release:RELEASE.label,capabilities:cyberCapabilities(edition),evaluation:evaluateCyberPolicy(edition)});}
export async function POST(req:Request){const b=await req.json().catch(()=>({}));if(b.type==='asset')return Response.json(assetDiscoveryDecision({category:String(b.category||''),ownedOrAuthorized:Boolean(b.ownedOrAuthorized),active:Boolean(b.active),approved:Boolean(b.approved)}));return Response.json(authorizeCyberAction({edition,mode:b.mode||'LEARN',request:String(b.request||''),ownedOrAuthorized:Boolean(b.ownedOrAuthorized),localLab:Boolean(b.localLab),approved:Boolean(b.approved)}));}
