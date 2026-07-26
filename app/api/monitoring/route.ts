import { getMonitoringSummary } from '@/lib/monitoring';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const summary = await getMonitoringSummary();
  return Response.json({ ok: true, summary });
}
