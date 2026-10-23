import { estimateQwenTokens } from './prompt-engine/token-context';
import { maskSecrets } from './security-audit';

export type Msg = { role: 'user' | 'assistant'; content: string };
export type ArchivedMsg = Msg & { at?: string };

/* ---------- token estimation (heuristic, calibrated at runtime) ---------- */

const MESSAGE_OVERHEAD_TOKENS = 6; // pembatas template chat per pesan (perkiraan)
let calibration = 1;

export function getCalibration() { return calibration; }
export function resetCalibration() { calibration = 1; }

/** Perbarui faktor kalibrasi dari jumlah token sebenarnya yang dilaporkan Ollama (prompt_eval_count). */
export function observeUsage(rawEstimatedInput: number, actualInput: number) {
  if (!(rawEstimatedInput > 50) || !(actualInput > 50)) return calibration;
  const ratio = Math.min(2, Math.max(0.6, actualInput / rawEstimatedInput));
  calibration = Math.min(2, Math.max(0.6, calibration * 0.8 + ratio * 0.2));
  return calibration;
}

export const rawTokens = (text: string) => estimateQwenTokens(text);
export const tokensOf = (text: string, safety = 1) => Math.ceil(rawTokens(text) * calibration * safety);
const messageTokens = (m: Msg, safety: number) => tokensOf(m.content, safety) + MESSAGE_OVERHEAD_TOKENS;

/* ---------- text helpers ---------- */

/** Potong bagian tengah teks (pertahankan awal dan akhir) dan tandai pemotongan secara eksplisit. */
export function cutMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const marker = `\n[… ${text.length - maxChars} karakter dipotong …]\n`;
  const avail = Math.max(0, maxChars - marker.length);
  if (avail < 40) return text.slice(0, Math.max(0, maxChars)) + '…';
  const head = Math.ceil(avail * 0.65);
  return text.slice(0, head) + marker + text.slice(text.length - (avail - head));
}

const FENCE = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)(?:```|$)/g;

function sentenceOf(text: string, maxChars: number): string {
  const flat = text
    .replace(FENCE, (_m, lang: string, body: string) => ` [kode ${lang || 'teks'} ${body.split('\n').length} baris] `)
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length <= maxChars) return flat;
  const slice = flat.slice(0, maxChars);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '));
  return (end > maxChars * 0.4 ? slice.slice(0, end + 1) : slice.slice(0, maxChars - 1).trimEnd()) + (end > maxChars * 0.4 ? '' : '…');
}

const FACT_RULES: Array<[RegExp, number]> = [
  [/\b(nama saya|panggil saya|my name is)\b/i, 3],
  [/\b(proyek(?:ku| saya)|deadline|tenggat|target saya|versi\s?\d)\b/i, 3],
  [/\bsaya (?:adalah|seorang|bekerja|kuliah|tinggal|punya|pakai|memakai|menggunakan|lebih suka|suka|tidak suka)\b|\b(?:i am|i use|i prefer)\b/i, 3],
  [/\b(preferensi|selalu|jangan pernah|wajib|always|never)\b/i, 2],
  [/\bharus\b/i, 1],
];

const factScore = (s: string) => FACT_RULES.reduce((sum, [re, w]) => sum + (re.test(s) ? w : 0), 0);

/** Fakta identitas, preferensi, dan batasan dari pesan pengguna; kalimat permintaan biasa tidak dihitung. Diurutkan kronologis. */
export function extractFacts(userMessages: string[], limit: number): string[] {
  const scored: Array<{ text: string; score: number; order: number }> = [];
  const seen = new Set<string>();
  userMessages.forEach((message, order) => {
    for (const raw of message.replace(FENCE, ' ').split(/(?<=[.!?])\s+|\n+/)) {
      const sentence = raw.replace(/\s+/g, ' ').trim();
      if (sentence.length < 12 || sentence.length > 160) continue;
      const score = factScore(sentence);
      if (score < 2) continue;
      const text = maskSecrets(sentence);
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      scored.push({ text, score, order });
    }
  });
  return scored
    .sort((x, y) => y.score - x.score || y.order - x.order)
    .slice(0, limit)
    .sort((x, y) => x.order - y.order)
    .map((f) => f.text);
}

/* ---------- archive recall (BM25 over keywords; no embeddings, no model) ---------- */

const STOP = new Set(('yang dan di ke dari untuk dengan pada ini itu atau juga akan sudah belum tidak bukan bisa dapat saya aku kamu anda kita kami mereka dia ada adalah agar bagaimana kenapa mengapa apa siapa kapan dimana bila jika kalau tolong mohon yg dgn utk dlm tp gak ga nggak the and for with that this from you your have has was were are not but can will would should could what when where how why who which into about please').split(/\s+/));

export function termsOf(text: string): string[] {
  const out: string[] = [];
  for (const t of text.slice(0, 2000).toLowerCase().split(/[^\p{L}\p{N}_]+/u)) {
    if (t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)) out.push(t);
  }
  return out;
}

export type RecallHit = { msg: ArchivedMsg; score: number; matched: number };

export function recallFromCorpus(query: string, corpus: ArchivedMsg[], opts: { k: number; minScore?: number }): RecallHit[] {
  const q = [...new Set(termsOf(query))];
  if (!q.length || !corpus.length) return [];
  const docs = corpus.map((m) => termsOf(m.content));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length || 1;
  const N = docs.length;
  const k1 = 1.2;
  const b = 0.75;
  // Cukup separuh kata kueri cocok (dibulatkan ke atas); peringkat BM25 yang membedakan kecocokan kuat dari lemah.
  const needed = Math.ceil(q.length / 2);
  const hits: RecallHit[] = [];
  docs.forEach((terms, i) => {
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    let matched = 0;
    for (const t of q) {
      const f = tf.get(t);
      if (!f) continue;
      matched += 1;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * terms.length) / avgLen)));
    }
    if (matched >= needed && score >= (opts.minScore ?? 0)) hits.push({ msg: corpus[i], score, matched });
  });
  return hits.sort((a, c) => c.score - a.score).slice(0, opts.k);
}

/* ---------- history compaction ---------- */

export type CompactOptions = {
  historyBudget: number;
  digestTokens: number;
  recallTokens: number;
  perMessageMaxChars: number;
  olderMessageMaxChars: number;
  blockSize: number;
  minVerbatimMessages: number;
  safety: number;
  /** Jumlah pesan yang sudah diarsipkan sebelum jendela ini; menyelaraskan batas blok ke nomor urut absolut. */
  baseIndex?: number;
  query?: string;
  archive?: ArchivedMsg[];
};

export type CompactResult = {
  messages: Msg[];
  /** Ringkasan dan fakta; stabil antar giliran (berubah hanya saat batas blok bergeser) sehingga aman di prompt sistem. */
  note: string;
  /** Ingatan hasil pencarian untuk pertanyaan ini; berubah tiap giliran sehingga ditempatkan setelah riwayat. */
  recallNote: string;
  report: {
    totalMessages: number;
    verbatimMessages: number;
    evictedMessages: number;
    boundaryAbsolute: number;
    digestLines: number;
    facts: number;
    recallHits: number;
    truncatedMessages: number;
    verbatimTokens: number;
    noteTokens: number;
    totalTokens: number;
    fitsBudget: boolean;
  };
};

function clampAll(messages: Msg[], o: CompactOptions): Msg[] {
  const recentFrom = Math.max(0, messages.length - 2);
  return messages.map((m, i) => ({ role: m.role, content: cutMiddle(m.content, i >= recentFrom ? o.perMessageMaxChars : o.olderMessageMaxChars) }));
}

function alignToUser(messages: Msg[], index: number): number {
  let i = index;
  while (i < messages.length && messages[i].role !== 'user') i += 1;
  return i;
}

const sumTokens = (messages: Msg[], safety: number) => messages.reduce((s, m) => s + messageTokens(m, safety), 0);

export function compactHistory(input: Msg[], o: CompactOptions): CompactResult {
  const messages = input.filter((m) => m.content.trim() !== '');
  const clamped = clampAll(messages, o);
  const base = o.baseIndex ?? 0;
  const truncated = clamped.filter((m, i) => m.content !== messages[i].content).length;
  const hasArchive = Boolean(o.archive?.length);

  const result = (kept: Msg[], note: string, recallNote: string, evicted: number, extra: Partial<CompactResult['report']> = {}): CompactResult => {
    const verbatimTokens = sumTokens(kept, o.safety);
    const noteTokens = (note ? tokensOf(note, o.safety) : 0) + (recallNote ? tokensOf(recallNote, o.safety) : 0);
    return {
      messages: kept,
      note,
      recallNote,
      report: {
        totalMessages: messages.length, verbatimMessages: kept.length, evictedMessages: evicted, boundaryAbsolute: base + evicted,
        digestLines: 0, facts: 0, recallHits: 0, truncatedMessages: truncated, verbatimTokens, noteTokens,
        totalTokens: verbatimTokens + noteTokens, fitsBudget: verbatimTokens + noteTokens <= o.historyBudget, ...extra,
      },
    };
  };

  // 1. Semua muat: tidak ada yang perlu dipadatkan.
  if (!hasArchive && sumTokens(clamped, o.safety) <= o.historyBudget) return result(clamped, '', '', 0);

  // 2. Hitung anggaran pesan utuh setelah menyisihkan ringkasan dan ingatan.
  const digestCap = Math.min(o.digestTokens, Math.floor(o.historyBudget * 0.25));
  const recallCap = hasArchive || messages.length > 0 ? Math.min(o.recallTokens, Math.floor(o.historyBudget * 0.2)) : 0;
  const verbatimBudget = Math.max(0, o.historyBudget - digestCap - recallCap);

  // 3. Pesan terbaru yang muat; kedua pesan terakhir selalu dipertahankan.
  const minKeep = Math.min(o.minVerbatimMessages, clamped.length);
  let fit = 0;
  let used = 0;
  for (let i = clamped.length - 1; i >= 0; i -= 1) {
    const t = messageTokens(clamped[i], o.safety);
    if (used + t > verbatimBudget && fit >= minKeep) break;
    used += t;
    fit += 1;
  }
  let evicted = clamped.length - fit;

  // 4. Batas dimajukan per blok pada nomor urut absolut agar awalan prompt stabil antar giliran.
  if (evicted > 0) {
    const abs = base + evicted;
    evicted = Math.min(clamped.length - minKeep, Math.ceil(abs / o.blockSize) * o.blockSize - base);
    evicted = Math.max(0, evicted);
  }
  evicted = Math.min(alignToUser(clamped, evicted), Math.max(0, clamped.length - minKeep));
  if (clamped[evicted] && clamped[evicted].role !== 'user') evicted = Math.max(0, evicted - 1);

  let kept = clamped.slice(evicted);
  // 5. Jaminan akhir: bila masih melebihi anggaran, kurangi lagi sampai muat (sisakan minimal satu giliran).
  while (kept.length > Math.min(2, clamped.length) && sumTokens(kept, o.safety) > verbatimBudget) {
    const next = alignToUser(clamped, evicted + 1);
    if (next >= clamped.length - 1) break;
    evicted = next;
    kept = clamped.slice(evicted);
  }
  if (sumTokens(kept, o.safety) > verbatimBudget && kept.length > 0) {
    const per = Math.max(120, Math.floor((verbatimBudget / Math.max(1, kept.length)) * 3));
    kept = kept.map((m) => ({ role: m.role, content: cutMiddle(m.content, per) }));
  }

  // 6. Ringkasan ekstraktif dan fakta (catatan stabil) serta ingatan arsip (catatan per pertanyaan), masing-masing dengan batasnya sendiri.
  const gone = messages.slice(0, evicted);
  const digest: string[] = [];
  const digested = new Set<Msg>();
  for (let i = gone.length - 1; i >= 0 && digest.length < 40; i -= 1) {
    const m = gone[i];
    const text = maskSecrets(sentenceOf(m.content, m.role === 'user' ? 140 : 110));
    if (!text) continue;
    digest.unshift(`- ${m.role === 'user' ? 'Pengguna' : 'Asisten'}: ${text}`);
    digested.add(m);
  }
  const facts = extractFacts(gone.filter((m) => m.role === 'user').map((m) => m.content), 5);
  const renderNote = (): string => {
    const parts: string[] = [];
    if (gone.length && digest.length) {
      const older = gone.length - digest.length;
      parts.push(`Ringkasan otomatis percakapan sebelumnya (${gone.length} pesan lebih lama dipadatkan):\n${digest.join('\n')}${older > 0 ? `\n(+${older} pesan yang lebih lama tidak dicantumkan; tersimpan di arsip)` : ''}`);
    }
    if (facts.length) parts.push(`Fakta yang disebut pengguna:\n${facts.map((f) => `- ${f}`).join('\n')}`);
    return parts.join('\n\n');
  };
  let note = renderNote();
  while (note && tokensOf(note, o.safety) > digestCap) {
    if (digest.length) digest.shift();
    else if (facts.length) facts.shift();
    else break;
    note = renderNote();
  }
  if (!digest.length && !facts.length) note = '';

  const recall: string[] = [];
  if (o.query && (hasArchive || gone.length)) {
    const corpus: ArchivedMsg[] = [...(o.archive ?? []), ...gone.filter((m) => !digested.has(m))];
    const chosen: RecallHit[] = [];
    for (const h of recallFromCorpus(o.query, corpus, { k: 12 })) {
      const terms = new Set(termsOf(h.msg.content));
      const duplicate = chosen.some((c) => {
        const other = new Set(termsOf(c.msg.content));
        const inter = [...terms].filter((t) => other.has(t)).length;
        return inter / Math.max(1, terms.size + other.size - inter) > 0.7;
      });
      if (!duplicate) chosen.push(h);
      if (chosen.length >= 3) break;
    }
    for (const h of chosen) recall.push(`- (${h.msg.role === 'user' ? 'Pengguna' : 'Asisten'}${h.msg.at ? `, ${h.msg.at.slice(0, 10)}` : ''}) ${maskSecrets(sentenceOf(h.msg.content, 260))}`);
  }
  const renderRecall = () => (recall.length ? `Ingatan relevan dari percakapan lama (pencarian kata kunci; mungkin tidak lengkap):\n${recall.join('\n')}` : '');
  let recallNote = renderRecall();
  while (recallNote && tokensOf(recallNote, o.safety) > recallCap) {
    recall.pop();
    recallNote = renderRecall();
  }
  const digestLines = digest.length;
  const factCount = facts.length;
  const recallCount = recall.length;
  return result(kept, note, recallNote, evicted, { digestLines, facts: factCount, recallHits: recallCount });
}
