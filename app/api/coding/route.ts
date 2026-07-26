import {
  applyCodingPlan,
  buildCodingProject,
  codingStatus,
  createCodingProject,
  loadCodingJob,
  planCodingProject,
  readCodingLogs,
  rollbackCodingProject,
  startCodingProject,
  stopCodingProject,
  type CodingFramework,
} from '@/lib/coding-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request: Request) {
  const expected = process.env.CODING_AGENT_TOKEN || process.env.DESKTOP_CONTROL_TOKEN;
  if (expected) return request.headers.get('x-coding-token') === expected || request.headers.get('x-desktop-token') === expected;
  const host = request.headers.get('host') || '';
  return host.startsWith('localhost') || host.startsWith('127.0.0.1');
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  return Response.json({ ok: true, ...(await codingStatus()) });
}

export async function POST(request: Request) {
  let action = 'status';
  try {
    const body = await request.json() as Record<string, unknown>;
    action = text(body.action) || 'status';
    const protectedActions = ['create', 'apply', 'build', 'start', 'stop', 'rollback', 'logs'];
    if (protectedActions.includes(action) && !authorized(request)) {
      return Response.json({ ok: false, action, error: 'Coding endpoint hanya untuk localhost atau token yang valid.' }, { status: 403 });
    }
    if (action === 'status') return Response.json({ ok: true, ...(await codingStatus()) });
    if (action === 'plan') return Response.json({ ok: true, job: await planCodingProject({ prompt: text(body.prompt), targetPath: text(body.targetPath) || undefined, projectName: text(body.projectName) || undefined, framework: body.framework as CodingFramework | undefined }) });
    if (action === 'create') return Response.json({ ok: true, ...(await createCodingProject({ prompt: text(body.prompt), targetPath: text(body.targetPath) || undefined, projectName: text(body.projectName) || undefined, framework: body.framework as CodingFramework | undefined, confirmed: body.confirmed === true, install: body.install !== false, build: body.build !== false, start: body.start === true, port: Number(body.port || 3100) })) });
    if (action === 'apply') return Response.json({ ok: true, job: await applyCodingPlan(text(body.jobId), body.confirmed === true) });
    if (action === 'build') return Response.json({ ok: true, ...(await buildCodingProject(text(body.jobId), body.confirmed === true, { install: body.install !== false, autoRepair: body.autoRepair !== false })) });
    if (action === 'start') return Response.json({ ok: true, ...(await startCodingProject(text(body.jobId), body.confirmed === true, Number(body.port || 3100))) });
    if (action === 'stop') return Response.json({ ok: true, stopped: await stopCodingProject(text(body.jobId), body.confirmed === true) });
    if (action === 'rollback') return Response.json({ ok: true, job: await rollbackCodingProject(text(body.jobId), body.confirmed === true) });
    if (action === 'job') return Response.json({ ok: true, job: await loadCodingJob(text(body.jobId)) });
    if (action === 'logs') return Response.json({ ok: true, logs: await readCodingLogs(Number(body.limit || 50)) });
    return Response.json({ ok: false, action, error: 'Action coding tidak dikenal.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, action, error: message, hint: 'Periksa target workspace, folder yang sudah ada, konfigurasi .env, atau log job.' }, { status: 422 });
  }
}
