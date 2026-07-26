import {runtimeManifestV13491} from '@/lib/runtime-manifest-v13491';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return Response.json({ok:true,...runtimeManifestV13491(),endpoints:['/api/v10/status','/api/v10/cyber','/api/v10/evaluate']});}
