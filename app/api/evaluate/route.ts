import path from 'node:path';
import { DATA_DIR } from '@/lib/config';
import { safeJson } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checklist = await safeJson<any>(path.join(DATA_DIR, 'evaluations/checklist.json'), {});
  return Response.json({
    ok: true,
    summary: 'Evaluasi AI harus mencakup test umum, test dataset, paraphrase, pertanyaan di luar data, dan pertanyaan sensitif.',
    checklist,
  });
}
