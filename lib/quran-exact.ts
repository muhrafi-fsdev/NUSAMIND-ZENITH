import path from 'node:path';
import { DATA_DIR } from './config';
import type { RetrievalHit } from './types';
import { normalizeText, safeJson } from './util';
import { loadQuranRows, type AyahRow } from './quran-database';

export type ExactQuranAnswer = {
  answer: string;
  sources: RetrievalHit[];
  surahId: number;
  surahName: string;
  guardType: 'surah' | 'ayah_ref' | 'topic';
  dataSource: string;
};

type SurahMeta = {
  id?: string;
  surahId: number;
  name: string;
  aliases: string[];
  ayahCount?: number;
};

type TopicMapItem = {
  id: string;
  label: string;
  aliases: string[];
  refs: string[];
  note: string;
};

let surahMetaCache: SurahMeta[] | null = null;
let topicMapCache: TopicMapItem[] | null = null;

const STOP_WORDS = new Set([
  'kasih','saya','aku','tolong','minta','carikan','cari','surah','surat','ayat','ayatnya','quran','alquran','al-quran','tentang','mengenai','soal','beserta','dengan','latin','terjemah','arti','arab','bacaan','full','lengkap','yang','dan','di','ke','dari','untuk','ada','apa','itu','ini','dong','ya','nih','sih'
]);

async function loadSurahMeta(): Promise<SurahMeta[]> {
  if (surahMetaCache) return surahMetaCache;
  const rows = await safeJson<SurahMeta[]>(path.join(DATA_DIR, 'quran/surahs.json'), []);
  surahMetaCache = rows
    .map((row) => ({
      surahId: Number(row.surahId),
      name: String(row.name || '').trim(),
      aliases: Array.isArray(row.aliases) ? row.aliases.map((alias) => String(alias)) : [],
      ayahCount: Number(row.ayahCount || 0),
    }))
    .filter((row) => row.surahId && row.name);
  return surahMetaCache;
}

async function loadTopicMap(): Promise<TopicMapItem[]> {
  if (topicMapCache) return topicMapCache;
  topicMapCache = await safeJson<TopicMapItem[]>(path.join(DATA_DIR, 'quran/topic-index.json'), []);
  return topicMapCache;
}

function normalizeAlias(input: string) {
  return normalizeText(input).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function textHasExactAlias(text: string, alias: string): boolean {
  const normalizedText = ` ${normalizeAlias(text)} `;
  const normalizedAlias = normalizeAlias(alias);
  if (!normalizedAlias || normalizedAlias.length < 2) return false;
  return normalizedText.includes(` ${normalizedAlias} `);
}

async function findSurahFromQuery(message: string): Promise<SurahMeta | null> {
  const text = normalizeText(message);
  const metas = await loadSurahMeta();

  const numericRef = text.match(/(?:qs|q\.s\.|surah|surat)?\s*(\d{1,3})\s*[:.]\s*\d{1,3}/i);
  if (numericRef) {
    const surahId = Number(numericRef[1]);
    const meta = metas.find((surah) => surah.surahId === surahId);
    if (meta) return meta;
  }

  return metas.find((surah) => {
    const names = [surah.name, ...surah.aliases];
    return names.some((alias) => textHasExactAlias(text, alias));
  }) || null;
}

function isFullSurahRequest(message: string): boolean {
  const text = normalizeText(message);
  return /(full|lengkap|selengkapnya|semua|utuh|seutuhnya|seluruh|bacakan|tampilkan|surah lengkap|surat lengkap)/.test(text);
}

function includeOptions(message: string, defaultAll = true) {
  const text = normalizeText(message);
  const wantsOnlyLatin = /hanya latin|latin saja|cuma latin/.test(text);
  const wantsOnlyTranslate = /hanya terjemah|terjemah saja|arti saja|cuma arti/.test(text);
  return {
    includeArabic: !wantsOnlyLatin && !wantsOnlyTranslate && (defaultAll || /arab|arabic|ayat|teks|bacaan/.test(text)),
    includeLatin: !wantsOnlyTranslate && (defaultAll || /latin|read|bacaan/.test(text)),
    includeTranslation: !wantsOnlyLatin && (defaultAll || /terjemah|arti|makna|indo|indonesia/.test(text)),
  };
}

function formatAyah(ayah: AyahRow, includeArabic: boolean, includeLatin: boolean, includeTranslation: boolean): string {
  const lines = [`QS ${ayah.suraId}:${ayah.verseID}`];
  if (includeArabic) lines.push(ayah.ayahText || '[teks Arab belum tersedia]');
  if (includeLatin) lines.push(`Latin: ${ayah.readText || '[latin belum tersedia]'}`);
  if (includeTranslation) lines.push(`Terjemah: ${ayah.indoText || '[terjemah belum tersedia]'}`);
  return lines.join('\n');
}

function parseRef(ref: string): { surahId: number; start: number; end: number } | null {
  const match = normalizeText(ref).match(/(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/);
  if (!match) return null;
  const surahId = Number(match[1]);
  const start = Number(match[2]);
  const end = Number(match[3] || match[2]);
  if (!surahId || !start || end < start) return null;
  return { surahId, start, end };
}

async function parseExactAyahRequest(message: string): Promise<{ surah: SurahMeta; start: number; end: number } | null> {
  const text = normalizeText(message);
  const metas = await loadSurahMeta();

  const numeric = text.match(/(?:qs|q\.s\.|quran|al quran|alquran|surah|surat)?\s*(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i);
  if (numeric) {
    const surah = metas.find((meta) => meta.surahId === Number(numeric[1]));
    if (surah) return { surah, start: Number(numeric[2]), end: Number(numeric[3] || numeric[2]) };
  }

  const surah = await findSurahFromQuery(message);
  const ayahMatch = text.match(/ayat\s+(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?/i);
  if (surah && ayahMatch) {
    return { surah, start: Number(ayahMatch[1]), end: Number(ayahMatch[2] || ayahMatch[1]) };
  }

  return null;
}

function isQuranTopicRequest(message: string): boolean {
  const text = normalizeText(message);
  const quranSignal = /(quran|al quran|alquran|ayat|surah|surat|qs|dalil|firman|allah|islam)/.test(text);
  const topicSignal = /(tentang|mengenai|soal|tema|topik|berkaitan|sabar|syukur|taubat|rezeki|sholat|shalat|salat|sedekah|orang tua|ilmu|ikhlas|ujian|musibah|doa|adil|jujur|amanah|nikah)/.test(text);
  return quranSignal && topicSignal;
}

function extractKeywords(message: string): string[] {
  return normalizeAlias(message)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 12);
}

async function findTopicFromQuery(message: string): Promise<TopicMapItem | null> {
  const text = normalizeAlias(message);
  const topics = await loadTopicMap();
  return topics.find((topic) => [topic.label, ...topic.aliases].some((alias) => textHasExactAlias(text, alias))) || null;
}

function rowsByRefs(rows: AyahRow[], refs: string[]): AyahRow[] {
  const picked: AyahRow[] = [];
  for (const ref of refs) {
    const parsed = parseRef(ref);
    if (!parsed) continue;
    const matches = rows
      .filter((ayah) => Number(ayah.suraId) === parsed.surahId && Number(ayah.verseID) >= parsed.start && Number(ayah.verseID) <= parsed.end)
      .sort((a, b) => Number(a.verseID) - Number(b.verseID));
    for (const row of matches) {
      if (!picked.some((item) => item.suraId === row.suraId && item.verseID === row.verseID)) picked.push(row);
    }
  }
  return picked;
}

function searchRowsByKeywords(rows: AyahRow[], keywords: string[], limit = 8): AyahRow[] {
  const scored = rows.map((row) => {
    const haystack = normalizeAlias(`${row.indoText} ${row.readText}`);
    let score = 0;
    for (const keyword of keywords) {
      if (haystack.includes(keyword)) score += keyword.length + 2;
      if (keyword === 'sabar' && /(sabar|bersabar|kesabaran|penyabar)/.test(haystack)) score += 20;
      if (keyword === 'syukur' && /(syukur|bersyukur)/.test(haystack)) score += 20;
    }
    return { row, score };
  }).filter((item) => item.score > 0);

  return scored
    .sort((a, b) => b.score - a.score || a.row.suraId - b.row.suraId || a.row.verseID - b.row.verseID)
    .slice(0, limit)
    .map((item) => item.row);
}

async function buildExactAyahAnswer(message: string): Promise<ExactQuranAnswer | null> {
  const ref = await parseExactAyahRequest(message);
  if (!ref) return null;
  const quran = await loadQuranRows();
  const rows = quran.rows
    .filter((ayah) => Number(ayah.suraId) === ref.surah.surahId && Number(ayah.verseID) >= ref.start && Number(ayah.verseID) <= ref.end)
    .sort((a, b) => Number(a.verseID) - Number(b.verseID));
  if (!rows.length) return null;

  const { includeArabic, includeLatin, includeTranslation } = includeOptions(message, true);
  const body = rows.map((ayah) => formatAyah(ayah, includeArabic, includeLatin, includeTranslation)).join('\n\n');
  const warning = quran.warning ? `\n\nCatatan sumber: ${quran.warning}` : '';
  const answer = `Berikut ayat yang kamu minta dari database lokal Al-Qur'an:\n\n${body}\n\nSumber lokal: ${quran.source}.${warning}`;
  return {
    answer,
    surahId: ref.surah.surahId,
    surahName: ref.surah.name,
    guardType: 'ayah_ref',
    dataSource: quran.source,
    sources: [{
      id: `exact_ayah_${ref.surah.surahId}_${ref.start}_${ref.end}`,
      title: `QS ${ref.surah.surahId}:${ref.start}${ref.end > ref.start ? `-${ref.end}` : ''} ${ref.surah.name}`,
      category: 'Exact Quran Database Guard',
      text: rows.map((ayah) => `${ayah.suraId}:${ayah.verseID} ${ayah.ayahText}\nLatin: ${ayah.readText}\nTerjemah: ${ayah.indoText}`).join('\n\n'),
      score: 1000,
      source: quran.source,
      tags: ['quran', 'exact', 'ayah', ref.surah.name],
    }],
  };
}

async function buildTopicQuranAnswer(message: string): Promise<ExactQuranAnswer | null> {
  if (!isQuranTopicRequest(message)) return null;
  const quran = await loadQuranRows();
  const topic = await findTopicFromQuery(message);
  const keywords = extractKeywords(message);
  let rows = topic ? rowsByRefs(quran.rows, topic.refs) : [];
  if (!rows.length) rows = searchRowsByKeywords(quran.rows, keywords, 8);
  if (!rows.length) return null;

  const limitedRows = rows.slice(0, 8);
  const { includeArabic, includeLatin, includeTranslation } = includeOptions(message, true);
  const label = topic?.label || keywords.slice(0, 3).join(', ') || 'tema yang kamu minta';
  const intro = topic
    ? `Berikut beberapa ayat Al-Qur'an tentang ${topic.label}. Aku ambil langsung dari database lokal Al-Qur'an, bukan dari karangan model.`
    : `Berikut beberapa ayat Al-Qur'an yang paling relevan dengan tema "${label}" berdasarkan pencarian di database lokal Al-Qur'an.`;
  const note = topic?.note ? `\n\nCatatan: ${topic.note}` : '';
  const body = limitedRows.map((ayah) => formatAyah(ayah, includeArabic, includeLatin, includeTranslation)).join('\n\n');
  const warning = quran.warning ? `\n\nCatatan sumber: ${quran.warning}` : '';
  const answer = `${intro}\n\n${body}${note}\n\nSumber lokal: ${quran.source}.${warning}`;

  return {
    answer,
    surahId: limitedRows[0]?.suraId || 0,
    surahName: topic?.label || 'Topik Al-Qur\'an',
    guardType: 'topic',
    dataSource: quran.source,
    sources: [{
      id: `quran_topic_${topic?.id || keywords.join('_')}`,
      title: `Ayat Al-Qur'an tentang ${label}`,
      category: 'Quran Topic Database Guard',
      text: limitedRows.map((ayah) => `${ayah.suraId}:${ayah.verseID} ${ayah.ayahText}\nLatin: ${ayah.readText}\nTerjemah: ${ayah.indoText}`).join('\n\n'),
      score: 1000,
      source: quran.source,
      tags: ['quran', 'topic', label, ...keywords],
    }],
  };
}

async function buildFullSurahAnswer(message: string): Promise<ExactQuranAnswer | null> {
  const surah = await findSurahFromQuery(message);
  if (!surah || !isFullSurahRequest(message)) return null;

  const quran = await loadQuranRows();
  const rows = quran.rows
    .filter((ayah) => Number(ayah.suraId) === surah.surahId)
    .sort((a, b) => Number(a.verseID) - Number(b.verseID));

  if (!rows.length) return null;

  const { includeArabic, includeLatin, includeTranslation } = includeOptions(message, true);

  if (rows.length > 60) {
    const answer = `Surah ${surah.name} (QS ${surah.surahId}) berisi ${rows.length} ayat, jadi terlalu panjang kalau ditampilkan full dalam satu jawaban.\n\nMinta rentang tertentu saja, misalnya:\n- "Tampilkan QS ${surah.surahId}:1-10 dengan latin dan terjemah"\n- "Ringkas isi Surah ${surah.name}"\n\nSumber lokal: ${quran.source}.`;
    return {
      answer,
      surahId: surah.surahId,
      surahName: surah.name,
      guardType: 'surah',
      dataSource: quran.source,
      sources: [{
        id: `exact_surah_${surah.surahId}`,
        title: `QS ${surah.surahId} ${surah.name}`,
        category: 'Exact Quran Database Guard',
        text: answer,
        score: 999,
        source: quran.source,
        tags: ['quran', 'exact', 'surah', String(surah.surahId), surah.name],
      }],
    };
  }

  const body = rows.map((ayah) => formatAyah(ayah, includeArabic, includeLatin, includeTranslation)).join('\n\n');
  const warning = quran.warning ? `\n\nCatatan sumber: ${quran.warning}` : '';
  const answer = `Berikut Surah ${surah.name} lengkap (QS ${surah.surahId}) dari database lokal Al-Qur'an:\n\n${body}\n\nSumber lokal: ${quran.source}.${warning}`;

  return {
    answer,
    surahId: surah.surahId,
    surahName: surah.name,
    guardType: 'surah',
    dataSource: quran.source,
    sources: [{
      id: `exact_surah_${surah.surahId}`,
      title: `FULL SURAH ${surah.name} QS ${surah.surahId}`,
      category: 'Exact Quran Database Guard',
      text: rows.map((ayah) => `${ayah.verseID}. ${ayah.ayahText}\nLatin: ${ayah.readText}\nTerjemah: ${ayah.indoText}`).join('\n\n'),
      score: 999,
      source: quran.source,
      tags: ['quran', 'exact', 'surah', String(surah.surahId), surah.name, ...surah.aliases],
    }],
  };
}

export async function buildExactQuranAnswer(message: string): Promise<ExactQuranAnswer | null> {
  return await buildExactAyahAnswer(message)
    || await buildTopicQuranAnswer(message)
    || await buildFullSurahAnswer(message);
}

export async function buildFullSurahRetrievalHits(): Promise<RetrievalHit[]> {
  const quran = await loadQuranRows();
  const metas = await loadSurahMeta();
  return metas.map((surah) => {
    const ayahs = quran.rows
      .filter((ayah) => Number(ayah.suraId) === surah.surahId)
      .sort((a, b) => Number(a.verseID) - Number(b.verseID));
    const text = ayahs
      .map((ayah) => `${ayah.verseID}. ${ayah.ayahText}\nLatin: ${ayah.readText}\nTerjemah: ${ayah.indoText}`)
      .join('\n\n');
    return {
      id: `full_surah_${surah.surahId}`,
      title: `FULL SURAH ${surah.name} QS ${surah.surahId}`,
      category: 'Full Quran Surah',
      text,
      score: 0,
      source: quran.source,
      tags: ['quran', 'surah', 'full', String(surah.surahId), surah.name, ...surah.aliases],
      metadata: { surahId: surah.surahId, ayahCount: ayahs.length, dataSource: quran.source },
    };
  }).filter((hit) => hit.text.length > 10);
}
