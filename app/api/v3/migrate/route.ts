import { spawnSync } from 'node:child_process';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  const host = new URL(req.url).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) return Response.json({ ok: false, error: 'Localhost only' }, { status: 403 });
  const result = spawnSync(process.execPath, ['scripts/migrate-legacy-storage.mjs'], { encoding: 'utf8', timeout: 120_000 });
  if (result.status !== 0) return Response.json({ ok: false, error: (result.stderr || result.stdout || 'Migration failed').trim() }, { status: 500 });
  try { return Response.json({ ok: true, report: JSON.parse(result.stdout) }); }
  catch { return Response.json({ ok: false, error: 'Invalid migration report' }, { status: 500 }); }
}
