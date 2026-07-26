import { runtimeManifestV1347 } from '@/lib/runtime-manifest-v1347';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){return Response.json({ok:true,...runtimeManifestV1347(),endpoints:['/api/v7/status','/api/v7/evaluate','/api/v7/retrieval']});}
