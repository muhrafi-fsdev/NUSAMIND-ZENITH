import { executeTypedTool, toolDefinition, toolIds, type ToolId } from '@/lib/tool-registry';
import { editionProfile } from '@/lib/edition-profile';
import { masterTokenValid, verifyPermissionToken } from '@/lib/perm-token';
import { recordSecurityEvent } from '@/lib/security-center';
import { saveReplay } from '@/lib/replay';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (String(editionProfile.edition) !== 'apex') return Response.json({ ok: false, error: 'Typed multi-tool runtime hanya tersedia pada Apex.' }, { status: 403 });
  return Response.json({ ok: true, tools: toolIds.map((id) => ({ id, risk: toolDefinition(id).risk })) });
}

export async function POST(request: Request) {
  if (String(editionProfile.edition) !== 'apex') return Response.json({ ok: false, error: 'Typed multi-tool runtime hanya tersedia pada Apex.' }, { status: 403 });
  const body = await request.json() as { toolId?: ToolId; args?: unknown };
  if (!body.toolId || !toolIds.includes(body.toolId)) return Response.json({ ok: false, error: 'toolId tidak dikenal.' }, { status: 400 });
  const entry = toolDefinition(body.toolId);
  const master = masterTokenValid(request.headers.get('x-desktop-token') || undefined);
  const scoped = verifyPermissionToken(request.headers.get('x-nusamind-permission') || undefined, 'tool.execute').ok;
  if (!master && !scoped) return Response.json({ ok: false, error: 'Token tool.execute wajib.' }, { status: 403 });
  if (entry.risk === 'high' && !master) return Response.json({ ok: false, error: 'Tool berisiko tinggi memerlukan master token.' }, { status: 403 });
  try {
    const output = await executeTypedTool(body.toolId, body.args || {});
    const replay = saveReplay({ route: '/api/workflow/tool', toolId: body.toolId, args: body.args }, output);
    recordSecurityEvent('tool.execute', 'ok', { toolId: body.toolId, risk: entry.risk, replayId: replay.id });
    return Response.json({ ok: true, checkpoint: replay.checksum, replayId: replay.id, ...output });
  } catch (error) {
    recordSecurityEvent('tool.execute', 'error', { toolId: body.toolId, message: error instanceof Error ? error.message : String(error) });
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
