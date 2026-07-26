import { z } from 'zod';
import { listSessions, loadSession, normalizeSessionId, updateSessionMeta } from '@/lib/memory';
import { normalizeIntelligenceLevel } from '@/lib/intelligence-level';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  sessionId: z.string().optional(),
  title: z.string().optional(),
  pinned: z.boolean().optional(),
  pinnedNote: z.string().optional(),
  defaultIntelligenceLevel: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (sessionId) return Response.json({ ok: true, session: await loadSession(normalizeSessionId(sessionId)) });
  return Response.json({ ok: true, sessions: await listSessions() });
}

export async function POST(req: Request) {
  const body = patchSchema.parse(await req.json());
  const sessionId = normalizeSessionId(body.sessionId);
  const session = await updateSessionMeta(sessionId, {
    title: body.title,
    pinned: body.pinned,
    pinnedNote: body.pinnedNote,
    defaultIntelligenceLevel: body.defaultIntelligenceLevel ? normalizeIntelligenceLevel(body.defaultIntelligenceLevel) : undefined,
  });
  return Response.json({ ok: true, session });
}
