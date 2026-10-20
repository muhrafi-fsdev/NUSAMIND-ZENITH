import { autonomyProfile, approvalPhrase, listCredentials, listDeployments, listMcp, listWorkspaces, planDeployment, planDestructive, planGitPush } from '@/packages/autonomy-engine';
import { authenticateRequest, authDenied } from '@/lib/api-auth';
import { assertAllowedPath } from '@/lib/path-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const blocked = new Set(['git-push', 'destructive-run', 'credential-set', 'credential-delete', 'workspace-register', 'workspace-edit', 'mcp-register', 'mcp-inspect', 'mcp-call', 'loop-run', 'deployment-register', 'deployment-run']);
export async function GET() {
  return Response.json({ ok: true, release: 'N1.2', profile: autonomyProfile(), security: { rawShell: false, secretsReturned: false, unverifiedMcp: 'DISABLED', legacyExecution: 'BLOCKED' } });
}
export async function POST(req: Request) {
  if (!authenticateRequest(req, 'autonomy')) return authDenied();
  try {
    const b = await req.json();
    const action = String(b.action || 'status');
    const home = process.cwd();
    if (b.workspace && assertAllowedPath(String(b.workspace), { roots: [home], allowMissing: false }) !== assertAllowedPath(home)) throw new Error('OWNER_WORKSPACE_REQUIRED');
    if (blocked.has(action)) return Response.json({ ok: false, error: 'LEGACY_EXECUTION_BLOCKED', action, hint: 'Jalur ini menunggu sandbox, approval terikat payload, dan verifikasi server.' }, { status: 423 });
    if (action === 'approval-phrase') return Response.json({ ok: true, phrase: approvalPhrase(b.context || {}), executable: false });
    if (action === 'git-plan') return Response.json({ ok: true, plan: await planGitPush(home, b) });
    if (action === 'destructive-plan') return Response.json({ ok: true, plan: await planDestructive(home, b.request) });
    if (action === 'credential-list') return Response.json({ ok: true, credentials: await listCredentials(home) });
    if (action === 'workspace-list') return Response.json({ ok: true, workspaces: await listWorkspaces(home) });
    if (action === 'mcp-list') return Response.json({ ok: true, servers: (await listMcp(home)).map(s => ({ id: s.id, name: s.name, trust: s.trust, enabled: false })) });
    if (action === 'deployment-list') return Response.json({ ok: true, targets: await listDeployments(home) });
    if (action === 'deployment-plan') return Response.json({ ok: true, plan: await planDeployment(home, String(b.id)) });
    if (action === 'status') return Response.json({ ok: true, release: 'N1.2', profile: autonomyProfile() });
    return Response.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch (e) { return Response.json({ ok: false, error: e instanceof Error ? e.message : 'INVALID_REQUEST' }, { status: 422 }); }
}
