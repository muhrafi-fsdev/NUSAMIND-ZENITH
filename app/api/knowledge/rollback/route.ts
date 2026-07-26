import { authorizeKnowledgeWrite, rollbackKnowledgeBatch } from '@/lib/knowledge-center';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  if (!authorizeKnowledgeWrite(req)) return Response.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  const body = await req.json().catch(() => ({})); const result = rollbackKnowledgeBatch(body);
  return Response.json(result, { status: Number((result as { status?: number }).status || 200) });
}
