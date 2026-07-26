import type { IntelligenceProfile, MemoryRecord, RetrievalHit, SessionState } from './types';
import { createId, clampText, normalizeText, nowIso, tokenize } from './util';
import { formatMemoryForPrompt, loadMemory, loadSession, saveSession } from './memory';
import { buildEditionCommandAnswer } from './edition-profile';
import { RELEASE } from './release';

const CONTINUATION_PATTERNS = [
  /^lanjut/, /^terus/, /^next/, /^yang tadi/, /^yg tadi/, /^itu/, /^file itu/, /^jawaban tadi/,
  /^jadikan/, /^jadiin/, /^buat versi/, /^versi final/, /^ringkas/, /^lebih detail/, /^detailin/,
  /^revisi/, /^perbaiki/, /^upgrade lagi/, /^tambahkan/, /^tambahin/, /^lanjutkan/,
];

const TASK_PATTERNS = /(buatkan|jadikan|generate|upgrade|perbaiki|revisi|analisis|bersihkan|clean|export|ubah|tambahkan|tambahin|lanjutkan|susun|rancang|debug|fix)/i;
const ARTIFACT_PATTERN = /([\w\-.() ]+\.(?:csv|json|txt|md|pdf|docx|xlsx|pptx|zip|png|jpg|jpeg|webp|ts|tsx|js|jsx|py|php|sql|html|css))/gi;

function ensureContinuityFields(session: SessionState): SessionState {
  session.pendingTasks ||= [];
  session.artifacts ||= [];
  session.timeline ||= [];
  session.contextPins ||= [];
  return session;
}

export function looksLikeContinuation(message: string): boolean {
  const text = normalizeText(message);
  return CONTINUATION_PATTERNS.some((pattern) => pattern.test(text));
}

function inferTopic(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Percakapan umum';
  const clipped = clean.length > 96 ? `${clean.slice(0, 93)}...` : clean;
  return clipped;
}

function topicSimilarity(a: string, b: string): number {
  const at = new Set(tokenize(a).filter((token) => token.length >= 4));
  const bt = new Set(tokenize(b).filter((token) => token.length >= 4));
  if (!at.size || !bt.size) return 0;
  let hit = 0;
  for (const token of at) if (bt.has(token)) hit += 1;
  return hit / Math.max(at.size, bt.size);
}

function maybeAddTimeline(session: SessionState, event: string, detail: string) {
  session.timeline ||= [];
  session.timeline.push({ at: nowIso(), event, detail: clampText(detail, 260) });
  session.timeline = session.timeline.slice(-40);
}

function updateSummary(session: SessionState): void {
  const recent = session.messages.slice(-24).map((message) => {
    const role = message.role === 'user' ? 'User' : 'AI';
    return `${role}: ${clampText(message.content, 180)}`;
  });
  const tasks = (session.pendingTasks || [])
    .filter((task) => task.status === 'open' || task.status === 'answered')
    .slice(-5)
    .map((task) => `${task.title} [${task.status}]`);
  const pins = (session.contextPins || []).slice(-5).map((pin) => pin.text);
  session.summary = [
    `Topik aktif: ${session.activeTopic || 'belum ada'}`,
    tasks.length ? `Tugas aktif: ${tasks.join(' | ')}` : '',
    pins.length ? `Pin konteks: ${pins.join(' | ')}` : '',
    `Percakapan terbaru: ${recent.join(' || ')}`,
  ].filter(Boolean).join('\n');
}

function extractArtifacts(text: string) {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = ARTIFACT_PATTERN.exec(text))) {
    const name = match[1].trim();
    if (name.length > 2 && name.length < 140) found.add(name);
  }
  return [...found];
}

export async function updateSessionAfterUser(sessionId: string, userMessage: string): Promise<SessionState> {
  const session = ensureContinuityFields(await loadSession(sessionId));
  const previousTopic = session.activeTopic || '';
  const isContinuation = looksLikeContinuation(userMessage);
  const similarity = previousTopic ? topicSimilarity(previousTopic, userMessage) : 0;
  const topicSwitched = Boolean(previousTopic && !isContinuation && similarity < 0.12 && tokenize(userMessage).length >= 3);

  session.lastUserMessage = userMessage;
  if (!previousTopic || topicSwitched) {
    session.activeTopic = inferTopic(userMessage);
    maybeAddTimeline(session, topicSwitched ? 'topic_switch' : 'topic_start', session.activeTopic);
  } else if (!isContinuation && similarity >= 0.12) {
    session.activeTopic = inferTopic(userMessage);
  }

  if (TASK_PATTERNS.test(userMessage)) {
    const title = inferTopic(userMessage);
    const existing = (session.pendingTasks || []).find((task) => normalizeText(task.title) === normalizeText(title));
    if (!existing) {
      session.pendingTasks!.push({ id: createId('task'), title, status: 'open', createdAt: nowIso(), updatedAt: nowIso() });
      session.pendingTasks = session.pendingTasks!.slice(-30);
      maybeAddTimeline(session, 'task_open', title);
    }
  }

  if (/\b(pin|pinned|ingat di session|simpan konteks)\b/i.test(userMessage)) {
    const pinText = userMessage.replace(/^\/?pin\s*/i, '').trim();
    if (pinText.length > 3) {
      session.contextPins!.push({ id: createId('pin'), text: clampText(pinText, 240), createdAt: nowIso() });
      session.contextPins = session.contextPins!.slice(-20);
      maybeAddTimeline(session, 'context_pin', pinText);
    }
  }

  for (const name of extractArtifacts(userMessage)) {
    if (!session.artifacts!.some((artifact) => artifact.name === name)) {
      session.artifacts!.push({ id: createId('artifact'), name, createdAt: nowIso() });
    }
  }
  session.artifacts = session.artifacts!.slice(-40);

  session.contextHealth = {
    messageCount: session.messages.length,
    summaryAgeMessages: Math.max(0, session.messages.length % 6),
    hasLastOutput: Boolean(session.lastOutput?.content),
    hasActiveTopic: Boolean(session.activeTopic),
    updatedAt: nowIso(),
  };
  updateSummary(session);
  await saveSession(session);
  return session;
}

export async function updateSessionAfterAssistant(sessionId: string, answer: string, sources: RetrievalHit[] = []): Promise<SessionState> {
  const session = ensureContinuityFields(await loadSession(sessionId));
  session.lastOutput = { id: createId('output'), content: clampText(answer, 2200), createdAt: nowIso() };
  for (const name of extractArtifacts(answer)) {
    if (!session.artifacts!.some((artifact) => artifact.name === name)) {
      session.artifacts!.push({ id: createId('artifact'), name, createdAt: nowIso() });
    }
  }
  session.artifacts = session.artifacts!.slice(-40);
  const latestOpen = [...(session.pendingTasks || [])].reverse().find((task) => task.status === 'open');
  if (latestOpen) {
    latestOpen.status = 'answered';
    latestOpen.updatedAt = nowIso();
  }
  maybeAddTimeline(session, 'assistant_answer', `Output disimpan. Sources=${sources.length}.`);
  session.contextHealth = {
    messageCount: session.messages.length,
    summaryAgeMessages: 0,
    hasLastOutput: Boolean(session.lastOutput?.content),
    hasActiveTopic: Boolean(session.activeTopic),
    updatedAt: nowIso(),
  };
  updateSummary(session);
  await saveSession(session);
  return session;
}

export function buildRetrievalQuery(message: string, session: SessionState): string {
  if (!looksLikeContinuation(message)) return message;
  return [
    message,
    session.activeTopic ? `Topik aktif: ${session.activeTopic}` : '',
    session.summary ? `Ringkasan: ${session.summary}` : '',
    session.lastOutput?.content ? `Output terakhir: ${clampText(session.lastOutput.content, 800)}` : '',
  ].filter(Boolean).join('\n');
}

export function getRecentMessagesForPrompt(session: SessionState, profile?: IntelligenceProfile) {
  const limit = profile?.level === 'thinking' ? 30 : profile?.level === 'high' ? 24 : profile?.level === 'instant' ? 10 : 18;
  return session.messages.slice(-limit).map((message) => ({
    role: message.role as 'user' | 'assistant',
    content: clampText(message.content, 1800),
  }));
}

export function buildSessionContextBlock(session: SessionState, memory: MemoryRecord[]): string {
  const s = ensureContinuityFields({ ...session });
  const tasks = (s.pendingTasks || []).filter((task) => task.status !== 'archived').slice(-8);
  const artifacts = (s.artifacts || []).slice(-8);
  const pins = (s.contextPins || []).slice(-8);
  const timeline = (s.timeline || []).slice(-8);
  return [
    `Session ID: ${s.sessionId}`,
    `Private mode: ${s.privateMode ? 'ON - jangan simpan ke memori permanen' : 'OFF'}`,
    `Topik aktif: ${s.activeTopic || 'belum ada'}`,
    `Ringkasan session: ${s.summary || 'belum ada ringkasan'}`,
    `Output terakhir: ${s.lastOutput?.content ? clampText(s.lastOutput.content, 900) : 'belum ada'}`,
    tasks.length ? `Tugas: ${tasks.map((task) => `${task.title} [${task.status}]`).join(' | ')}` : 'Tugas: tidak ada yang aktif',
    artifacts.length ? `Artifact/file: ${artifacts.map((artifact) => artifact.name).join(' | ')}` : 'Artifact/file: belum ada',
    pins.length ? `Pin konteks: ${pins.map((pin) => pin.text).join(' | ')}` : 'Pin konteks: belum ada',
    timeline.length ? `Timeline: ${timeline.map((item) => `${item.event}: ${item.detail}`).join(' | ')}` : 'Timeline: belum ada',
    `Memory penting: ${formatMemoryForPrompt(memory)}`,
  ].join('\n');
}

export type SessionCommandResult = { handled: true; answer: string } | { handled: false };

export async function handleSessionCommand(sessionId: string, rawMessage: string): Promise<SessionCommandResult> {
  const raw = rawMessage.trim();
  if (!raw.startsWith('/')) return { handled: false };
  const [cmdRaw, ...rest] = raw.split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const args = rest.join(' ').trim();
  const session = ensureContinuityFields(await loadSession(sessionId));

  if (cmd === '/version' || cmd === '/profile') {
    return { handled: true, answer: buildEditionCommandAnswer() };
  }


  if (cmd === '/answer') {
    const mode = args || 'status';
    return { handled: true, answer: `Answer mode ${RELEASE.label}: ${mode}. Default aktif: direct-first, short budget, single accuracy line.` };
  }

  if (cmd === '/accuracy') {
    return { handled: true, answer: `Accuracy ${RELEASE.label} aktif: satu baris akurasi saja. Detail breakdown hanya bila user meminta /accuracy detail.` };
  }

  if (cmd === '/cache') {
    return { handled: true, answer: `Cache ${RELEASE.label} aktif secara ringan: hot answer cache, session cache, dan retrieval cache. /cache clear dapat dipakai sebagai instruksi reset manual.` };
  }

  if (cmd === '/rag' || cmd === '/router' || cmd === '/kb') {
    return { handled: true, answer: `Router/RAG ${RELEASE.label} aktif: per-domain retrieval, fast source retrieval, dan knowledge slimming. Pertanyaan math/agama dasar dapat dijawab direct tanpa retrieval berat.` };
  }

  if (cmd === '/apex' || cmd === '/max') {
    return { handled: true, answer: `Command ${RELEASE.name} diterima: ${args || 'auto'}. Mode aktif direct-first; deep thinking hanya saat perlu atau saat user meminta /deep.` };
  }

  if (cmd === '/expand' || cmd === '/deep' || cmd === '/evidence') {
    return { handled: true, answer: 'Mode detail diminta. Kirim pertanyaan setelah command ini atau tulis ulang pertanyaan dengan kata “jelaskan detail/step by step”.' };
  }

  if (cmd === '/benchmark') {
    return { handled: true, answer: `Benchmark ${RELEASE.label}: uji first_response_latency, direct_answer_score, retrieval_precision, single_accuracy_rate, dan unnecessary_content_rate.` };
  }

  if (cmd === '/safety') {
    return { handled: true, answer: `Safety ${RELEASE.label} aktif: guardrail tetap menyala untuk agama rinci, hukum, medis, keuangan, cyber berisiko, dan keselamatan.` };
  }

  if (cmd === '/prompt') {
    return { handled: true, answer: `Prompt profile ${RELEASE.label} aktif: prompt slimming, Indonesian language lock, direct math, Quran basic direct, dan no internal process output.` };
  }

  if (cmd === '/help') {
    return { handled: true, answer: [
      `Command CLI ${RELEASE.name} ${RELEASE.label}:`,
      '/session — lihat status session aktif',
      '/summary — lihat ringkasan session',
      '/last — tampilkan output terakhir',
      '/tasks — lihat tugas yang masih nyangkut',
      '/pin <teks> — pin konteks penting di session',
      '/artifacts — lihat file/artifact yang terdeteksi',
      '/health — cek kesehatan konteks',
      '/private on|off — mode session sementara',
      '/version atau /profile — lihat profil Swift/Zenith/Apex aktif',
      '/answer short|normal|deep — atur gaya jawaban',
      '/accuracy — status akurasi single-line',
      '/rag fast|domain — status retrieval cepat',
      '/cache status|clear — status cache ringan',
      '/apex auto|direct|deep — routing Apex direct/deep (/max alias)',
      '/upload <path> — baca file lokal dari CLI lalu kirim sebagai konteks',
      '/uploadfolder <path> — baca ringkasan folder lokal dari CLI',
      '/rename <judul> — ubah judul session',
      '',
      `Topik aktif sekarang: ${session.activeTopic || 'belum ada'}`,
    ].join('\n') };
  }

  if (cmd === '/session') {
    return { handled: true, answer: [
      `Session: ${session.sessionId}`,
      `Judul: ${session.title || '-'}`,
      `Topik aktif: ${session.activeTopic || '-'}`,
      `Pinned: ${session.pinned ? 'ya' : 'tidak'}`,
      `Private: ${session.privateMode ? 'ON' : 'OFF'}`,
      `Pesan tersimpan: ${session.messages.length}`,
      `Task aktif: ${(session.pendingTasks || []).filter((task) => task.status !== 'archived').length}`,
      `Artifact: ${(session.artifacts || []).length}`,
    ].join('\n') };
  }

  if (cmd === '/summary') {
    return { handled: true, answer: session.summary || 'Belum ada ringkasan session. Mulai chat dulu, nanti ringkasannya otomatis dibuat.' };
  }

  if (cmd === '/last') {
    return { handled: true, answer: session.lastOutput?.content || 'Belum ada output terakhir di session ini.' };
  }

  if (cmd === '/tasks') {
    const tasks = (session.pendingTasks || []).filter((task) => task.status !== 'archived');
    return { handled: true, answer: tasks.length ? tasks.map((task, i) => `${i + 1}. [${task.status}] ${task.title}`).join('\n') : 'Tidak ada task aktif.' };
  }

  if (cmd === '/artifacts') {
    const artifacts = session.artifacts || [];
    return { handled: true, answer: artifacts.length ? artifacts.map((artifact, i) => `${i + 1}. ${artifact.name}`).join('\n') : 'Belum ada artifact/file yang terdeteksi.' };
  }

  if (cmd === '/pin') {
    if (!args) return { handled: true, answer: 'Tulis teksnya: /pin informasi penting yang mau diingat selama session.' };
    session.contextPins!.push({ id: createId('pin'), text: clampText(args, 240), createdAt: nowIso() });
    session.contextPins = session.contextPins!.slice(-20);
    maybeAddTimeline(session, 'context_pin_command', args);
    updateSummary(session);
    await saveSession(session);
    return { handled: true, answer: `Sudah dipin di session ini: ${args}` };
  }

  if (cmd === '/private') {
    const on = /^(on|true|1|aktif)$/i.test(args);
    const off = /^(off|false|0|mati)$/i.test(args);
    if (!on && !off) return { handled: true, answer: `Private mode sekarang: ${session.privateMode ? 'ON' : 'OFF'}. Pakai /private on atau /private off.` };
    session.privateMode = on;
    maybeAddTimeline(session, 'private_mode', on ? 'ON' : 'OFF');
    await saveSession(session);
    return { handled: true, answer: `Private mode: ${on ? 'ON' : 'OFF'}` };
  }

  if (cmd === '/rename') {
    if (!args) return { handled: true, answer: 'Tulis judulnya: /rename Judul Session Baru' };
    session.title = clampText(args, 80);
    maybeAddTimeline(session, 'rename_session', session.title);
    await saveSession(session);
    return { handled: true, answer: `Judul session diganti: ${session.title}` };
  }

  if (cmd === '/health') {
    const memory = await loadMemory(sessionId);
    return { handled: true, answer: [
      'Context Health V13.21:',
      `- Active topic: ${session.activeTopic ? 'OK' : 'belum ada'}`,
      `- Summary: ${session.summary ? 'OK' : 'belum ada'}`,
      `- Last output: ${session.lastOutput ? 'OK' : 'belum ada'}`,
      `- Message window: ${session.messages.length}/160 tersimpan`,
      `- Pins: ${(session.contextPins || []).length}`,
      `- Tasks: ${(session.pendingTasks || []).length}`,
      `- Artifacts: ${(session.artifacts || []).length}`,
      `- Memory records: ${memory.length}`,
    ].join('\n') };
  }

  return { handled: true, answer: `Command tidak dikenal: ${cmd}. Ketik /help untuk daftar command CLI.` };
}
