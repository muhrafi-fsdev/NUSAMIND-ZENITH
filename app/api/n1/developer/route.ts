import { editionProfile, permissionFor, planTask, resolveMode, scanProject, toolRegistry, verifyResult } from '@/packages/developer-intelligence';
import { authenticateRequest, authDenied } from '@/lib/api-auth';
import { assertAllowedPath } from '@/lib/path-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ ok: true, release: 'N1.1', profile: editionProfile(), tools: toolRegistry }); }
export async function POST(req: Request) {
  if (!authenticateRequest(req, 'coding')) return authDenied();
  try {
    const body = await req.json();
    const action = String(body.action || 'plan');
    if (action === 'scan') return Response.json({ ok: true, project: await scanProject(assertAllowedPath(String(body.workspace || process.cwd()), { roots: [process.cwd()], allowMissing: false })) });
    if (action === 'verify') return Response.json({ ok: true, result: verifyResult(body), scope: 'CALLER_REPORTED_NOT_EXECUTION_EVIDENCE' });
    const m = resolveMode(String(body.mode || 'PLAN'));
    if (!m.ok) return Response.json(m, { status: 400 });
    if (action === 'permission') return Response.json({ ok: true, permission: permissionFor({ mode: m.mode, tool: String(body.tool || 'read-file') as never, target: String(body.target || ''), command: String(body.command || ''), approved: false }) });
    if (action !== 'plan') return Response.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
    return Response.json({ ok: true, plan: planTask({ mode: m.mode, request: String(body.request || ''), files: Array.isArray(body.files) ? body.files.map(String) : [] }) });
  } catch (e) { return Response.json({ ok: false, error: e instanceof Error ? e.message : 'INVALID_REQUEST' }, { status: 422 }); }
}
