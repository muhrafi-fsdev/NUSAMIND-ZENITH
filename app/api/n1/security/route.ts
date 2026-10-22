import fs from 'node:fs';
import path from 'node:path';
import { AUDIT_VERSION, LIMITATIONS, auditDirectory, renderMarkdown, toSarif } from '@/lib/security-audit';
import { LINE_RULES } from '@/lib/security-audit-rules';
import { masterTokenValid, verifyPermissionToken } from '@/lib/perm-token';
import { recordSecurityEvent } from '@/lib/security-center';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveTrustedTarget } from '@/packages/autonomy-engine/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS = new Set(['json', 'markdown', 'sarif']);

export async function GET() {
  return Response.json({
    ok: true,
    tool: 'nusamind-security-audit',
    version: AUDIT_VERSION,
    mode: 'DEFENSIVE_ANALYSIS',
    passive: true,
    rules: LINE_RULES.length,
    formats: [...FORMATS],
    authorization: 'POST wajib header x-desktop-token (master) atau x-nusamind-permission dengan scope repo.scan; path harus di dalam proyek atau workspace tepercaya.',
    limits: { maxFiles: 3000, maxFileBytes: 1_000_000 },
    limitations: LIMITATIONS,
  });
}

export async function POST(request: Request) {
  const master = masterTokenValid(request.headers.get('x-desktop-token') || undefined);
  const scoped = verifyPermissionToken(request.headers.get('x-nusamind-permission') || undefined, 'repo.scan').ok;
  if (!master && !scoped) return Response.json({ ok: false, error: 'Token repo.scan wajib.' }, { status: 403 });

  const rate = checkRateLimit('security-audit', 6, 60_000);
  if (!rate.ok) return Response.json({ ok: false, error: 'RATE_LIMITED', resetAt: rate.resetAt }, { status: 429 });

  try {
    const body = (await request.json().catch(() => ({}))) as { path?: string; format?: string };
    const format = FORMATS.has(String(body.format)) ? String(body.format) : 'json';
    const home = fs.realpathSync(process.cwd());
    const target = fs.realpathSync(path.resolve(home, body.path || '.'));
    if (!fs.statSync(target).isDirectory()) return Response.json({ ok: false, error: 'PATH_MUST_BE_DIRECTORY' }, { status: 400 });
    await resolveTrustedTarget(home, target);

    const report = auditDirectory(target);
    recordSecurityEvent('security.audit', 'ok', {
      target: report.target,
      files: report.coverage.filesScanned,
      findings: report.summary.total,
      risk: report.summary.riskLevel,
    });
    if (format === 'sarif') return Response.json(toSarif(report));
    if (format === 'markdown') return Response.json({ ok: true, markdown: renderMarkdown(report), summary: report.summary });
    return Response.json({ ok: true, ...report, findings: report.findings.slice(0, 500) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const denied = message === 'UNTRUSTED_EXTERNAL_WORKSPACE' || message === 'CRITICAL_PATH_DENIED';
    try { recordSecurityEvent('security.audit', denied ? 'denied' : 'error', { reason: message.slice(0, 120) }); } catch { /* audit trail best-effort */ }
    return Response.json({ ok: false, error: denied ? message : 'AUDIT_FAILED' }, { status: denied ? 403 : 400 });
  }
}
