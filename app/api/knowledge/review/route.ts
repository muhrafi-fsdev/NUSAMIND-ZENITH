import { authorizeKnowledgeWrite, listPendingReview, reviewKnowledge } from '@/lib/knowledge-center';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  const url = new URL(req.url); const result = listPendingReview(Number(url.searchParams.get('limit') || 50));
  return Response.json(result, { status: Number((result as { status?: number }).status || 200) });
}
export async function POST(req: Request) {
  if (!authorizeKnowledgeWrite(req)) return Response.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  const body = await req.json().catch(() => ({})); const result = reviewKnowledge(body);
  return Response.json(result, { status: Number((result as { status?: number }).status || 200) });
}
