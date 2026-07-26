import path from 'node:path';
import { DATA_DIR } from './config';
import { safeJson } from './util';

export type AyahRow = {
  suraId: number;
  verseID: number;
  ayahText: string;
  indoText: string;
  readText: string;
};

export type QuranDataSource = {
  rows: AyahRow[];
  source: string;
  warning?: string;
};

let cache: QuranDataSource | null = null;

function normalizeRow(row: Record<string, unknown>): AyahRow | null {
  const suraId = Number(row.suraId ?? row.surahId ?? row.surah_id ?? row.sura_id ?? row.surat_id ?? row.suratId);
  const verseID = Number(row.verseID ?? row.ayahId ?? row.ayah_id ?? row.ayat_id ?? row.verse_id ?? row.ayat);
  const ayahText = String(row.ayahText ?? row.arabic ?? row.arab ?? row.text_arab ?? row.teks_arab ?? row.ayah_text ?? '').trim();
  const indoText = String(row.indoText ?? row.translation ?? row.terjemah ?? row.terjemahan ?? row.text_id ?? row.arti ?? '').trim();
  const readText = String(row.readText ?? row.latin ?? row.transliteration ?? row.bacaan ?? row.text_latin ?? '').trim();
  if (!Number.isFinite(suraId) || !Number.isFinite(verseID) || !ayahText) return null;
  return { suraId, verseID, ayahText, indoText, readText };
}

async function loadFromStaticJson(warning?: string): Promise<QuranDataSource> {
  const rows = await safeJson<AyahRow[]>(path.join(DATA_DIR, 'quran/ayah-idx.json'), []);
  return {
    rows: rows.map((row) => normalizeRow(row as unknown as Record<string, unknown>)).filter(Boolean) as AyahRow[],
    source: 'quran/ayah-idx.json',
    warning,
  };
}

async function loadFromMysql(): Promise<QuranDataSource | null> {
  const enabled = (process.env.QURAN_DB_ENABLED || '').toLowerCase() === 'true' || (process.env.QURAN_SOURCE || '').toLowerCase() === 'database';
  if (!enabled) return null;

  try {
    const mysql = await import('mysql2/promise');
    const table = process.env.QURAN_DB_TABLE || 'quran_ayahs';
    const surahColumn = process.env.QURAN_DB_SURAH_COLUMN || 'suraId';
    const ayahColumn = process.env.QURAN_DB_AYAH_COLUMN || 'verseID';
    const arabicColumn = process.env.QURAN_DB_ARABIC_COLUMN || 'ayahText';
    const latinColumn = process.env.QURAN_DB_LATIN_COLUMN || 'readText';
    const translationColumn = process.env.QURAN_DB_TRANSLATION_COLUMN || 'indoText';

    const connection = await mysql.createConnection({
      host: process.env.QURAN_DB_HOST || '127.0.0.1',
      port: Number(process.env.QURAN_DB_PORT || 3306),
      user: process.env.QURAN_DB_USER || 'root',
      password: process.env.QURAN_DB_PASSWORD || '',
      database: process.env.QURAN_DB_NAME || 'nusamind_ai',
      charset: 'utf8mb4',
    });

    const [result] = await connection.execute(
      `SELECT \`${surahColumn}\` AS suraId, \`${ayahColumn}\` AS verseID, \`${arabicColumn}\` AS ayahText, \`${translationColumn}\` AS indoText, \`${latinColumn}\` AS readText FROM \`${table}\` ORDER BY \`${surahColumn}\`, \`${ayahColumn}\``
    );
    await connection.end();

    const rows = (result as Record<string, unknown>[])
      .map(normalizeRow)
      .filter(Boolean) as AyahRow[];

    if (!rows.length) {
      return {
        rows: [],
        source: `mysql:${process.env.QURAN_DB_NAME || 'nusamind_ai'}.${table}`,
        warning: 'Database Al-Qur\'an aktif, tetapi query tidak menghasilkan ayat. Fallback perlu digunakan.',
      };
    }

    return {
      rows,
      source: `mysql:${process.env.QURAN_DB_NAME || 'nusamind_ai'}.${table}`,
    };
  } catch (error) {
    return {
      rows: [],
      source: 'mysql:quran-db',
      warning: `Gagal membaca database Al-Qur'an Laragon/MySQL: ${error instanceof Error ? error.message : String(error)}. Fallback ke quran/ayah-idx.json.`,
    };
  }
}

export async function loadQuranRows(): Promise<QuranDataSource> {
  if (cache) return cache;
  const mysqlData = await loadFromMysql();
  if (mysqlData?.rows.length) {
    cache = mysqlData;
    return cache;
  }
  cache = await loadFromStaticJson(mysqlData?.warning);
  return cache;
}

export function resetQuranRowsCache() {
  cache = null;
}
