import path from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import { DATA_DIR } from '@/lib/config';
import { buildVectorLiteDoc, saveVectorLiteIndex } from '@/lib/vector-lite';
import { safeJson } from '@/lib/util';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function collectDocs() {
  const [quranChunks, fullSurah, universal, workflow, site, ayah] = await Promise.all([
    safeJson<any[]>(path.join(DATA_DIR, 'quran/chunks.json'), []),
    safeJson<any[]>(path.join(DATA_DIR, 'quran/surahs.json'), []),
    safeJson<any[]>(path.join(DATA_DIR, 'core/universal.json'), []),
    safeJson<any[]>(path.join(DATA_DIR, 'runtime/blueprint.json'), []),
    safeJson<any[]>(path.join(DATA_DIR, 'core/site.json'), []),
    safeJson<any[]>(path.join(DATA_DIR, 'quran/ayah-idx.json'), []),
  ]);

  const docs = [
    ...quranChunks.map((item, index) => ({ id: String(item.id || `quran_${index}`), title: String(item.title || item.category || 'Quran Knowledge'), category: String(item.category || 'Quran'), text: String(item.text || item.excerpt || ''), source: String(item.source_label || 'quran/chunks.json') })),
    ...fullSurah.map((item, index) => ({ id: String(item.id || `full_surah_${index}`), title: `FULL SURAH ${item.name || item.surahId}`, category: 'Full Quran Surah', text: String(item.text || ''), source: String(item.source || 'quran/surahs.json') })),
    ...universal.map((item, index) => ({ id: String(item.id || `universal_${index}`), title: String(item.title || 'Universal'), category: String(item.category || 'Universal'), text: String(item.text || ''), source: String(item.source || 'core/universal.json') })),
    ...workflow.map((item, index) => ({ id: String(item.id || `workflow_${index}`), title: String(item.title || 'Workflow'), category: 'Workflow', text: [item.objective, ...(item.checklist || []), ...(item.outputs || [])].join('\n'), source: 'runtime/blueprint.json' })),
    ...site.map((item, index) => ({ id: String(item.id || `site_${index}`), title: String(item.title || 'Site'), category: String(item.category || 'Site'), text: [item.context, item.translation, item.details].filter(Boolean).join('\n'), source: 'core/site.json' })),
    ...ayah.slice(0, 6236).map((item, index) => ({ id: `ayah_${item.suraId || index}_${item.verseID || index}`, title: `QS ${item.suraId || '?'}:${item.verseID || '?'}`, category: 'Ayat Al-Quran', text: [item.ayahText, item.readText, item.indoText].filter(Boolean).join('\n'), source: 'quran/ayah-idx.json' })),
  ].filter((doc) => doc.text && doc.text.length > 10);

  return docs.map(buildVectorLiteDoc);
}

// Nilai contoh dari .env.example dan docker-compose.yml; diketahui publik sehingga tidak boleh melindungi produksi.
const PUBLIC_PLACEHOLDER_TOKENS = new Set(['change-this-local-admin-token']);

function checkAdminToken(req: Request): { ok: true } | { ok: false; status: number; error: string } {
  const expected = process.env.ADMIN_TOKEN || '';
  const production = process.env.NODE_ENV === 'production';
  // Produksi gagal tertutup: tanpa token sungguhan endpoint ini tidak boleh dapat dipanggil siapa pun.
  if (production && (expected === '' || PUBLIC_PLACEHOLDER_TOKENS.has(expected))) {
    return { ok: false, status: 503, error: 'ADMIN_TOKEN_NOT_CONFIGURED' };
  }
  if (expected === '') return { ok: true };
  const provided = Buffer.from(req.headers.get('x-admin-token') || '');
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) return { ok: false, status: 401, error: 'UNAUTHORIZED' };
  return { ok: true };
}

export async function POST(req: Request) {
  const auth = checkAdminToken(req);
  if (!auth.ok) return Response.json({ ok: false, error: auth.error }, { status: auth.status });
  const docs = await collectDocs();
  await saveVectorLiteIndex(docs);
  return Response.json({ ok: true, indexedDocs: docs.length, index: 'storage/index/hybrid-vector-lite-index.json' });
}
