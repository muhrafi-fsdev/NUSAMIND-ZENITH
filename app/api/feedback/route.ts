import { z } from 'zod';
import { appendFeedback, getFeedbackSummary } from '@/lib/feedback';
import { upsertMemory } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().optional(),
  rating: z.number().min(1).max(5),
  label: z.string().min(1),
  note: z.string().optional(),
  mode: z.string().optional(),
});

export async function GET() {
  const summary = await getFeedbackSummary();
  return Response.json({ ok: true, summary });
}

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const record = await appendFeedback(body);
  if (body.rating <= 2 || ['wrong_context', 'hallucination', 'unsafe'].includes(body.label)) {
    await upsertMemory(body.sessionId, `feedback_${record.id}`, `Feedback user: ${body.label}; catatan: ${body.note || '-'}; mode=${body.mode || '-'}`, 4);
  }
  return Response.json({ ok: true, record });
}
