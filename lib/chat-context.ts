import { appConfig } from './config';
import { RELEASE } from './release';
import { buildStructuredPrompt, buildSystemPrompt } from './prompts';
import { buildCompactSystemPrompt, buildCompactUserPrompt, evidenceLines } from './compact-prompt';
import { compilePrompt } from './prompt-engine/registry';
import { prepareContext, rawInputEstimate } from './context-engine';
import type { PreparedContext } from './context-engine';
import { cutMiddle, observeUsage } from './context-compactor';
import type { Msg } from './context-compactor';
import { recallCandidates } from './memory';
import type { IntelligenceProfile, IntentResult, MemoryRecord, RetrievalHit, SessionState } from './types';

export type ChatContextArgs = {
  sessionId: string;
  /** Sesi yang dimuat sebagai jendela terbaru (loadSession dengan limit); pesan pengguna saat ini sudah ada di dalamnya. */
  session: SessionState;
  userMessage: string;
  recallQuery?: string;
  intent: IntentResult;
  intelligenceProfile: IntelligenceProfile;
  memory: MemoryRecord[];
  sources: RetrievalHit[];
  sessionContextBlock: string;
  chatMode: string;
  domainContext: string;
  taskType: string;
  strategy: string;
  requestedMaxOutputTokens: number;
};

export type PreparedChat = PreparedContext & { profile: string; rawInputEstimate: number; promptHash: string };

/** Menyusun system, messages, dan batas keluaran yang dijamin muat dalam jendela konteks profil perangkat keras aktif. */
export function prepareChatContext(a: ChatContextArgs): PreparedChat {
  const hw = appConfig.hardware.profile;
  const contextTokens = a.intent.mode === 'coding' ? appConfig.ollamaCoderContextWindow : appConfig.ollamaContextWindow;
  const edition = String(RELEASE.edition);

  const window = a.session.messages;
  const last = window[window.length - 1];
  // Pesan pengguna saat ini sudah tersimpan di sesi; versi terstrukturnya dikirim terpisah, jadi jangan dikirim dua kali.
  const earlier = last && last.role === 'user' && last.content === a.userMessage ? window.slice(0, -1) : window;
  const history: Msg[] = earlier.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const total = a.session.totalMessages ?? window.length;
  const olderCount = Math.max(0, total - window.length);
  const archive = olderCount > 0 ? { messages: recallCandidates(a.sessionId, a.recallQuery || a.userMessage, window.length), total: olderCount } : { messages: [], total: 0 };

  let promptHash = '';
  const prepared = prepareContext({
    profile: hw,
    contextTokens,
    requestedMaxOutputTokens: a.requestedMaxOutputTokens,
    sources: a.sources,
    history,
    archive,
    query: a.recallQuery || a.userMessage,
    build: ({ sources, memoryItems, sessionBlockChars, compact }) => {
      const system = compact
        ? buildCompactSystemPrompt({ intent: a.intent, memory: a.memory, memoryItems, intelligenceProfile: a.intelligenceProfile, sessionBlock: a.sessionContextBlock, sessionBlockChars, chatMode: a.chatMode, domainContext: a.domainContext })
        : buildSystemPrompt(a.intent, sources, a.memory.slice(0, memoryItems), a.intelligenceProfile, cutMiddle(a.sessionContextBlock, sessionBlockChars), a.chatMode, a.domainContext);
      const user = compact ? buildCompactUserPrompt(a.userMessage, a.intelligenceProfile) : buildStructuredPrompt(a.userMessage, a.intelligenceProfile, a.chatMode, a.domainContext);
      const evidence = compact ? evidenceLines(sources, 700) : sources.map((s) => `${s.title}: ${s.text || ''}`);
      const compiled = compilePrompt({ edition, taskType: a.taskType, baseSystem: system, baseUser: user, strategy: a.strategy, evidence });
      promptHash = compiled.hash;
      return { system: compiled.system, user: compiled.user };
    },
  });
  return { ...prepared, profile: appConfig.hardware.name, rawInputEstimate: rawInputEstimate(prepared), promptHash };
}

/** Kalibrasi penaksir token dari jumlah token masukan sebenarnya yang dilaporkan model (Ollama: prompt_eval_count). */
export function recordUsage(prepared: PreparedChat, usage: unknown) {
  const u = (usage || {}) as { inputTokens?: number; promptTokens?: number };
  const actual = Number(u.inputTokens ?? u.promptTokens ?? 0);
  if (actual > 0) observeUsage(prepared.rawInputEstimate, actual);
}
