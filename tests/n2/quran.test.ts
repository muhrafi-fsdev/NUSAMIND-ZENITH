import test from 'node:test';
import assert from 'node:assert/strict';
import { loadQuranRows } from '../../lib/quran-database';
import { buildExactQuranAnswer } from '../../lib/quran-exact';
process.env.QURAN_DB_ENABLED = 'false';
process.env.QURAN_SOURCE = 'static';
test('shipped canonical Quran files support exact surah and topic lookup', async () => {
  const data = await loadQuranRows();
  assert.equal(data.rows.length, 6236);
  assert.equal(data.source, 'quran/ayah-index.json');
  const surah = await buildExactQuranAnswer('Tampilkan Surah Al-Fatihah lengkap dengan latin dan terjemah');
  assert.equal(surah?.surahId, 1); assert.equal(surah?.guardType, 'surah'); assert.match(surah!.answer, /bismillāhir/);
  const topic = await buildExactQuranAnswer('kasih saya ayat tentang sabar beserta ayatnya');
  assert.equal(topic?.guardType, 'topic'); assert.ok(topic!.sources.length > 0);
});
