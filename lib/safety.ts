import type { IntentResult } from './types';

export function getSafetyInstruction(intent: IntentResult): string {
  if (intent.mode === 'quran') {
    return `
Aturan Quran/Islamic Guard:
- Jangan mengarang ayat, hadis, sanad, nomor surah, latin, terjemah, atau sumber tafsir.
- Jika user meminta teks surah/ayat lengkap, gunakan hanya data quran/ayah-idx.json atau Exact Quran Guard. Jika konteks tidak cukup kuat, jangan menebak.
- Untuk hukum fikih/fatwa, jangan mutlak; sarankan cek ustadz/ulama/tafsir terpercaya.
- Bedakan terjemah ayat, tafsir, nasihat umum, dan opini.`;
  }
  if (intent.safety === 'sensitive_general') {
    return `
Aturan topik sensitif umum:
- Untuk medis, hukum, finansial, dan keamanan, beri informasi umum dan arahkan ke profesional terkait.
- Jangan mengklaim kepastian jika butuh pemeriksaan ahli atau sumber terbaru.`;
  }
  return `
Aturan umum:
- Jawab santai, jelas, langsung ke inti, dan tetap jujur kalau tidak yakin.
- Jangan memaksa dataset Al-Qur'an untuk pertanyaan non-agama.`;
}

export function cleanAnswer(text: string): string {
  return text
    .replace(/^\s*(dari data yang tersedia|berdasarkan dataset|berdasarkan data yang ada|menurut data yang tersedia)[,\s]*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
