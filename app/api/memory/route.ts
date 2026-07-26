import { z } from 'zod';
import { loadMemory, loadSession, normalizeSessionId } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ sessionId: z.string().optional() });

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const sessionId = normalizeSessionId(body.sessionId);
  const [memory, session] = await Promise.all([loadMemory(sessionId), loadSession(sessionId)]);
  return Response.json({ ok: true, sessionId, memory, messages: session.messages.slice(-30) });
}
