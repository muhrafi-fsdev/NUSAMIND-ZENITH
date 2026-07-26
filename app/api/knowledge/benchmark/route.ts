import { loadKnowledgeBenchmark, runKnowledgeBenchmark } from '@/lib/knowledge-center';
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ ok: true, cases: loadKnowledgeBenchmark() }); }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = runKnowledgeBenchmark(body);
  return Response.json(result, { status: Number((result as { status?: number }).status || 200) });
}
