import { z } from 'zod';
import { buildExactQuranAnswer } from '@/lib/quran-exact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  message: z.string().optional(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const message = url.searchParams.get('q') || 'Tampilkan Surah Al-Fatihah lengkap dengan latin dan terjemah';
  const exact = await buildExactQuranAnswer(message);
  if (!exact) return Response.json({ ok: false, error: 'NO_EXACT_QURAN_MATCH', message }, { status: 404 });
  return Response.json({ ok: true, message, ...exact });
}

export async function POST(req: Request) {
  const body = schema.parse(await req.json());
  const message = body.message || 'Tampilkan Surah Al-Fatihah lengkap dengan latin dan terjemah';
  const exact = await buildExactQuranAnswer(message);
  if (!exact) return Response.json({ ok: false, error: 'NO_EXACT_QURAN_MATCH', message }, { status: 404 });
  return Response.json({ ok: true, message, ...exact });
}
