import { z } from 'zod';
import { getMlHealth, proxyMlOperation } from '@/lib/ml-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  operation: z.enum(['analyze', 'batch', 'embed', 'similarity', 'anomaly', 'evaluate']),
  payload: z.unknown(),
});

export async function GET() {
  const health = await getMlHealth();
  return Response.json(health, { status: health.ok ? 200 : 503 });
}

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'INVALID_ML_REQUEST', issues: parsed.error.issues }, { status: 400 });
  }
  const result = await proxyMlOperation(parsed.data.operation, parsed.data.payload);
  return Response.json(result.data, { status: result.status });
}
