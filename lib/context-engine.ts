import { compactHistory, cutMiddle, rawTokens, tokensOf } from './context-compactor';
import type { ArchivedMsg, CompactResult, Msg } from './context-compactor';
import type { HardwareProfile } from './context-budget';
import type { RetrievalHit } from './types';

export type BuildOptions = { sources: RetrievalHit[]; memoryItems: number; sessionBlockChars: number; compact: boolean };

export type PrepareInput = {
  profile: HardwareProfile;
  /** num_ctx efektif untuk permintaan ini (model coding dapat berbeda). */
  contextTokens: number;
  requestedMaxOutputTokens: number;
  build: (o: BuildOptions) => { system: string; user: string };
  /** Diurutkan dari paling relevan; yang paling akhir dibuang lebih dulu. */
  sources: RetrievalHit[];
  history: Msg[];
  archive?: { messages: ArchivedMsg[]; total: number };
  query: string;
};

export type PreparedContext = {
  system: string;
  user: string;
  messages: Msg[];
  maxOutputTokens: number;
  report: {
    contextTokens: number;
    inputBudget: number;
    compactPrompt: boolean;
    trimmed: string[];
    sources: { given: number; used: number };
    userTruncated: boolean;
    tokens: { system: number; user: number; history: number; note: number; total: number };
    history: CompactResult['report'];
    fits: boolean;
  };
};

const CHARS_PER_TOKEN = 3;
const MAX_FIT_ATTEMPTS = 24;

/** Pertahankan sumber paling relevan selama muat dalam anggaran token; setiap sumber dibatasi panjangnya. */
export function fitSources(sources: RetrievalHit[], maxTokens: number, maxCharsEach: number, safety: number): RetrievalHit[] {
  const out: RetrievalHit[] = [];
  let used = 0;
  for (const s of sources) {
    const text = cutMiddle(String(s.text || ''), maxCharsEach);
    const t = tokensOf(`${s.title} ${text}`, safety) + 4;
    if (used + t > maxTokens) break;
    used += t;
    out.push({ ...s, text });
  }
  return out;
}

export function prepareContext(input: PrepareInput): PreparedContext {
  const { profile, contextTokens } = input;
  const b = profile.budgets;
  const safety = profile.tokenSafetyFactor;
  const inputBudget = Math.max(256, contextTokens - profile.reserveOutputTokens);
  const trimmed: string[] = [];
  const sourceChars = profile.compactPrompt ? 700 : 1600;

  let compact = profile.compactPrompt;
  let memoryItems = b.memoryItems;
  let sessionChars = b.sessionBlockChars;
  let sources = fitSources(input.sources, b.sourcesTokens, sourceChars, safety);
  if (sources.length < input.sources.length) trimmed.push('sources');

  let built = input.build({ sources, memoryItems, sessionBlockChars: sessionChars, compact });
  const userTokens0 = tokensOf(built.user, safety);
  const systemCap = Math.max(300, Math.min(b.systemTokens, inputBudget - b.minHistoryTokens - Math.min(userTokens0, Math.floor(inputBudget * 0.35))));
  // Prompt sistem dan pesan pengguna (termasuk blok evidence) bersama-sama tidak boleh menghabiskan ruang riwayat minimum.
  const fixedCap = Math.max(systemCap, inputBudget - b.minHistoryTokens);
  const over = () => tokensOf(built.system, safety) > systemCap || tokensOf(built.system, safety) + tokensOf(built.user, safety) > fixedCap;

  for (let attempt = 0; attempt < MAX_FIT_ATTEMPTS && over(); attempt += 1) {
    if (sources.length) { sources = sources.slice(0, -1); if (!trimmed.includes('sources')) trimmed.push('sources'); }
    else if (!compact) { compact = true; trimmed.push('compact-prompt'); }
    else if (memoryItems > 2) { memoryItems = Math.max(2, memoryItems - 2); if (!trimmed.includes('memory')) trimmed.push('memory'); }
    else if (sessionChars > 200) { sessionChars = Math.floor(sessionChars / 2); if (!trimmed.includes('session')) trimmed.push('session'); }
    else break;
    built = input.build({ sources, memoryItems, sessionBlockChars: sessionChars, compact });
  }
  let system = built.system;
  if (tokensOf(system, safety) > systemCap) {
    system = cutMiddle(system, systemCap * CHARS_PER_TOKEN);
    trimmed.push('system-hardcut');
  }

  // Pesan pengguna saat ini tidak boleh membuat sisa anggaran habis: potong bagian tengahnya dan tandai.
  let user = built.user;
  const systemTokens = tokensOf(system, safety);
  const userCap = Math.max(200, inputBudget - systemTokens - Math.min(b.minHistoryTokens, 200));
  let userTruncated = false;
  if (tokensOf(user, safety) > userCap) {
    user = cutMiddle(user, userCap * CHARS_PER_TOKEN);
    userTruncated = true;
    trimmed.push('user-truncated');
  }
  const userTokens = tokensOf(user, safety) + 6;

  const historyBudget = Math.max(0, inputBudget - systemTokens - userTokens - 12);
  const compacted = compactHistory(input.history, {
    historyBudget,
    digestTokens: b.digestTokens,
    recallTokens: b.recallTokens,
    perMessageMaxChars: b.perMessageMaxChars,
    olderMessageMaxChars: b.olderMessageMaxChars,
    blockSize: b.blockSize,
    minVerbatimMessages: b.minVerbatimMessages,
    safety,
    baseIndex: input.archive?.total ?? 0,
    query: input.query,
    archive: input.archive?.messages,
  });
  const note = compacted.note ? `\n\n${compacted.note}` : '';
  const finalSystem = `${system}${note}`;
  const finalUser = compacted.recallNote ? `${compacted.recallNote}\n\n${user}` : user;
  const total = systemTokens + compacted.report.noteTokens + userTokens + compacted.report.verbatimTokens + 12;

  const room = Math.max(0, contextTokens - total);
  const wanted = profile.enforceOutputCap ? Math.min(profile.maxOutputTokens, input.requestedMaxOutputTokens) : input.requestedMaxOutputTokens;
  const maxOutputTokens = Math.max(128, Math.min(wanted, Math.max(128, room - 32)));

  return {
    system: finalSystem,
    user: finalUser,
    messages: [...compacted.messages, { role: 'user', content: finalUser }],
    maxOutputTokens,
    report: {
      contextTokens,
      inputBudget,
      compactPrompt: compact,
      trimmed,
      sources: { given: input.sources.length, used: sources.length },
      userTruncated,
      tokens: { system: systemTokens, user: userTokens, history: compacted.report.verbatimTokens, note: compacted.report.noteTokens, total },
      history: compacted.report,
      fits: total <= inputBudget,
    },
  };
}

/** Estimasi mentah (tanpa kalibrasi atau faktor aman) dari seluruh teks yang dikirim; dipakai untuk kalibrasi dengan prompt_eval_count. */
export function rawInputEstimate(p: PreparedContext): number {
  return rawTokens(p.system) + p.messages.reduce((s, m) => s + rawTokens(m.content) + 6, 0) + 12;
}
