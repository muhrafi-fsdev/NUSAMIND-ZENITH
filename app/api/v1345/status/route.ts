import { runtimeDiagnosticV1345 } from '@/lib/runtime-diag';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(){return Response.json(await runtimeDiagnosticV1345());}
