import { evaluateText, loadGoldenSet } from '@/lib/evaluator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const cases = await loadGoldenSet();
  return Response.json({
    ok: true,
    note: 'Endpoint ini menyediakan golden set. Untuk evaluasi jawaban aktual, kirim POST dengan { testId, answer } atau jalankan script evaluate:mock.',
    totalCases: cases.length,
    cases,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const cases = await loadGoldenSet();
  const test = cases.find((item) => item.id === body.testId) || cases[0];
  if (!test) return Response.json({ ok: false, error: 'NO_TEST_CASES' }, { status: 404 });
  const result = evaluateText(String(body.answer || ''), test);
  return Response.json({ ok: true, result, test });
}
