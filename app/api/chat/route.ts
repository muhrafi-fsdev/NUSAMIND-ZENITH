import { streamText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { appConfig } from '@/lib/config';
import { detectIntent } from '@/lib/intent-router';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { appendMessage, autoExtractMemory, loadMemory, loadSession, normalizeSessionId, upsertMemory } from '@/lib/memory';
import { appendInteractionLog } from '@/lib/monitoring';
import { getModel } from '@/lib/model';
import { buildStructuredPrompt, buildSystemPrompt } from '@/lib/prompts';
import { compilePrompt } from '@/lib/prompt-engine/registry';
import { routePromptStrategy } from '@/lib/prompt-engine/strategy';
import { cleanAnswer } from '@/lib/safety';
import { buildExactQuranAnswer } from '@/lib/quran-exact';
import { getIntelligenceProfile, normalizeIntelligenceLevel } from '@/lib/intelligence-level';
import { buildRetrievalQuery, buildSessionContextBlock, getRecentMessagesForPrompt, handleSessionCommand, updateSessionAfterAssistant, updateSessionAfterUser } from '@/lib/session-continuity';
import type { AssistantMode, IntelligenceProfile } from '@/lib/types';
import { normalizeChatMode } from '@/lib/customer-service';
import { analyzeReligionRequest, buildReligionPrompt } from '@/lib/religion';
import { planAgentGoal } from '@/lib/agent-v3';
import { retrieveKnowledgeV6 } from '@/lib/retrieval-v6';
import { formatFinalAnswer, formatTextResponse } from '@/lib/answer-format';
import { RELEASE } from '@/lib/release';
import { tryBuildCalculationAnswer } from '@/lib/calc-engine';
import { analyzeTextWithMl, buildMlContext, evaluateAnswerWithMl, refineIntentWithMl } from '@/lib/ml-client';
import { analyzeHealthRequest, buildEmergencyHealthAnswer, buildHealthContext } from '@/lib/health-intel';
import { createPrivateHealthSession } from '@/lib/health/private-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  mode: z.enum(['auto', 'quran', 'universal', 'coding', 'companion', 'workflow']).optional().default('auto'),
  intelligenceLevel: z.string().optional().default(appConfig.defaultIntelligenceLevel),
  sessionMode: z.string().optional().default('general_chat'),
  answerMode: z.string().optional().default('auto'),
});

function textResponse(text: string, headers?: Record<string, string>) {
  const response = new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', ...(headers || {}) } });
  return response;
}

async function selectSources(mode: AssistantMode, message: string, profile: IntelligenceProfile) {
  return retrieveKnowledgeV6(message, mode, String(RELEASE.edition), profile.retrievalTopK);
}

export async function POST(req: Request) {
  const body = requestSchema.parse(await req.json());
  const sessionId = normalizeSessionId(body.sessionId);
  const intelligenceLevel = normalizeIntelligenceLevel(body.intelligenceLevel);
  const sessionMode = normalizeChatMode(body.sessionMode);
  const religion = analyzeReligionRequest(body.message, sessionMode);
  const religionContext = buildReligionPrompt(religion);
  const mlAnalysis = await analyzeTextWithMl(body.message);
  const mlContext = buildMlContext(mlAnalysis);
  const healthAnalysis = analyzeHealthRequest(body.message);
  const healthContext = buildHealthContext(healthAnalysis);
  const combinedDomainContext = [religionContext, mlContext, healthContext].filter(Boolean).join('\n\n');
  const emergencyHealthAnswer = buildEmergencyHealthAnswer(healthAnalysis);
  if (emergencyHealthAnswer) {
    const answer = formatFinalAnswer(emergencyHealthAnswer, body.message, String(RELEASE.edition), body.answerMode);
    return textResponse(answer, { 'x-nusamind-health-gate': healthAnalysis.gate, 'x-nusamind-health-severity': healthAnalysis.severity });
  }
  const intelligenceProfile = getIntelligenceProfile(intelligenceLevel);
  const rate = checkRateLimit(getRateLimitKey(req, sessionId), 60, 60_000);
  if (!rate.ok) {
    return Response.json({ ok: false, error: 'RATE_LIMITED', message: 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.', resetAt: rate.resetAt }, { status: 429 });
  }

  const baseIntent = detectIntent(body.message, religion.active ? 'quran' : body.mode as AssistantMode);
  const intent = refineIntentWithMl(baseIntent, mlAnalysis);
  const startedAt = Date.now();

  const command = await handleSessionCommand(sessionId, body.message);
  if (command.handled) {
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: formatFinalAnswer(command.answer, body.message, String(RELEASE.edition), body.answerMode), mode: body.mode, intelligenceLevel, intent, sources: [] });
    await updateSessionAfterAssistant(sessionId, command.answer, []);
    await appendInteractionLog({ sessionId, route: '/api/chat', mode: 'workflow', messageLength: body.message.length, sources: 0, finishReason: 'session_command', steps: 0, latencyMs: Date.now() - startedAt });
    return textResponse(formatFinalAnswer(command.answer, body.message, String(RELEASE.edition), body.answerMode), { 'x-quran-ai-session-id': sessionId, 'x-quran-ai-mode': 'workflow', 'x-nusamind-intelligence-level': intelligenceLevel, 'x-nusamind-session-command': 'true' });
  }

  const calculationLocal = tryBuildCalculationAnswer(body.message, String(RELEASE.edition), body.answerMode);
  if (calculationLocal && !religion.active) {
    const answer = formatFinalAnswer(calculationLocal.answer, body.message, String(RELEASE.edition), body.answerMode);
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await updateSessionAfterAssistant(sessionId, answer, []);
    await appendInteractionLog({
      sessionId,
      route: '/api/chat',
      mode: `calculation-${calculationLocal.domain}`,
      messageLength: body.message.length,
      sources: 0,
      finishReason: 'deterministic_calculation',
      steps: 0,
      latencyMs: Date.now() - startedAt,
    });
    return textResponse(answer, {
      'x-quran-ai-session-id': sessionId,
      'x-quran-ai-mode': 'calculation',
      'x-nusamind-intelligence-level': intelligenceLevel,
      'x-nusamind-formula-id': calculationLocal.formulaId,
      'x-nusamind-calculation-status': calculationLocal.status,
    });
  }

  const preSession = await loadSession(sessionId);
  const retrievalQuery = buildRetrievalQuery(body.message, preSession);
  const exactQuran = await buildExactQuranAnswer(body.message);
  const exactAllowed = Boolean(exactQuran && (!religion.active || religion.allowExactLookup));
  const selectedSources = await selectSources(religion.active ? 'quran' : intent.mode, retrievalQuery, intelligenceProfile);
  const sources = [...(exactQuran?.sources || []), ...selectedSources].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).slice(0, Math.max(12, intelligenceProfile.retrievalTopK));

  if (!healthAnalysis.privacySensitive) await autoExtractMemory(sessionId, body.message);
  else createPrivateHealthSession(sessionId, body.message);
  await appendMessage(sessionId, {
    role: 'user',
    content: body.message,
    mode: body.mode,
    intelligenceLevel,
    intent,
    sources,
  });
  await updateSessionAfterUser(sessionId, body.message);
  const memory = await loadMemory(sessionId);

  if (exactQuran && exactAllowed) {
    const answer = formatFinalAnswer(exactQuran.answer, body.message, String(RELEASE.edition), body.answerMode);
    await appendMessage(sessionId, {
      role: 'assistant',
      content: answer,
      mode: body.mode,
      intelligenceLevel,
      intent,
      sources,
    });
    await updateSessionAfterAssistant(sessionId, answer, sources);
    await upsertMemory(sessionId, 'last_exact_quran_answer', `Guard=${exactQuran.guardType}; TopicOrSurah=${exactQuran.surahName}; QS=${exactQuran.surahId}; Source=${exactQuran.dataSource}`, 2);
    await appendInteractionLog({
      sessionId,
      route: '/api/chat',
      mode: `quran-${exactQuran.guardType}`,
      messageLength: body.message.length,
      sources: sources.length,
      finishReason: `exact_quran_${exactQuran.guardType}_guard`,
      steps: 0,
      latencyMs: Date.now() - startedAt,
    });
    return textResponse(answer, { 'x-quran-ai-session-id': sessionId, 'x-quran-ai-mode': 'quran', 'x-quran-ai-confidence': '1', 'x-nusamind-intelligence-level': intelligenceLevel });
  }

  const session = await loadSession(sessionId);
  const recentMessages = getRecentMessagesForPrompt(session, intelligenceProfile);
  const sessionContextBlock = buildSessionContextBlock(session, memory);

  const promptStrategy = routePromptStrategy({
    message: body.message,
    edition: String(RELEASE.edition),
    hasEvidence: sources.length > 0,
    deterministic: Boolean(tryBuildCalculationAnswer(body.message, String(RELEASE.edition), body.answerMode)),
    toolTask: /jalankan|eksekusi|buat file|ubah file|deploy|install|agent/i.test(body.message),
    deepResearch: /riset mendalam|deep research|multi-source|lintas sumber/i.test(body.message),
  });
  const compiledPrompt = compilePrompt({
    edition: String(RELEASE.edition),
    taskType: promptStrategy.id === 'PS-RAG' ? 'rag' : promptStrategy.id === 'PS-REACT' ? 'agent' : promptStrategy.id === 'PS-CHAIN' ? 'workflow' : 'direct',
    baseSystem: buildSystemPrompt(intent, sources, memory, intelligenceProfile, sessionContextBlock, sessionMode, combinedDomainContext),
    baseUser: buildStructuredPrompt(body.message, intelligenceProfile, sessionMode, combinedDomainContext),
    strategy: promptStrategy.id,
    evidence: sources.map((source) => `${source.title}: ${source.text || ''}`),
  });

  const tools = {
    searchQuranKnowledge: tool({
      description: 'Cari konteks lokal Al-Qur\'an, ayat, doa, dzikir, tafsir ringan, dan pengetahuan Islam dari dataset project.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(query, 'quran', String(RELEASE.edition), 12),
    }),
    searchUniversalKnowledge: tool({
      description: 'Cari konteks universal lokal untuk coding, debugging, jaringan, laptop, Windows, tugas kuliah, percakapan umum, dan session continuity.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(buildRetrievalQuery(query, session), 'universal', String(RELEASE.edition), 12),
    }),
    planSafeWorkflow: tool({
        description: 'Membuat plan bounded/supervised dengan permission, expected state, verification, checkpoint, dan rollback policy.',
        inputSchema: z.object({ goal: z.string(), confirmed: z.boolean().optional().default(false) }),
        execute: async ({ goal, confirmed }: { goal: string; confirmed?: boolean }) => planAgentGoal(goal, Boolean(confirmed), sessionId),
      }),
      searchWorkflowKnowledge: tool({
      description: 'Cari blueprint pengembangan AI lokal: workflow, arsitektur, monitoring, deployment, evaluasi, CLI, dan session continuity.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(buildRetrievalQuery(query, session), 'workflow', String(RELEASE.edition), 12),
    }),
    rememberUserPreference: tool({
      description: 'Simpan preferensi atau konteks penting user untuk sesi berikutnya kecuali private mode ON.',
      inputSchema: z.object({ key: z.string(), value: z.string(), importance: z.number().min(1).max(5).default(1) }),
      execute: async ({ key, value, importance }: { key: string; value: string; importance: number }) => {
        if (session.privateMode) return { ok: false, reason: 'private_mode_on' };
        await upsertMemory(sessionId, key, value, importance);
        return { ok: true, key, value, importance };
      },
    }),
  };

  const result = streamText({
    model: getModel(intent),
    system: compiledPrompt.system,
    messages: [
      ...recentMessages,
      { role: 'user', content: compiledPrompt.user },
    ],
    tools: appConfig.toolsEnabled ? tools : undefined,
    stopWhen: stepCountIs(appConfig.maxSteps),
    temperature: intelligenceProfile.temperature ?? appConfig.temperature,
    maxOutputTokens: Math.min(7000, Math.max(appConfig.maxOutputTokens, intelligenceProfile.maxOutputTokens)),
    providerOptions: appConfig.provider === 'ollama' ? { ollama: { num_ctx: 16384 } } : undefined,
    onFinish: async ({ text, response, usage, finishReason, steps }: { text?: string; response?: { messages?: unknown[] }; usage?: unknown; finishReason?: string; steps?: unknown[] }) => {
      const answer = formatFinalAnswer(cleanAnswer(text || ''), body.message, String(RELEASE.edition), body.answerMode);
      await evaluateAnswerWithMl(body.message, answer, sources.map((source) => source.text || source.title));
      await appendMessage(sessionId, {
        role: 'assistant',
        content: answer,
        mode: body.mode,
        intelligenceLevel,
        intent,
        sources,
      });
      const updatedSession = await updateSessionAfterAssistant(sessionId, answer, sources);
      await upsertMemory(
        sessionId,
        'last_interaction_summary',
        `Mode=${intent.mode}; finish=${finishReason}; usage=${JSON.stringify(usage || {})}; steps=${steps?.length || 0}; responseMessages=${response?.messages?.length || 0}; activeTopic=${updatedSession.activeTopic || '-'}`,
        1,
      );
      await appendInteractionLog({
        sessionId,
        route: '/api/chat',
        mode: intent.mode,
        messageLength: body.message.length,
        sources: sources.length,
        finishReason,
        steps: steps?.length || 0,
        latencyMs: Date.now() - startedAt,
      });
    },
  });

  const response = formatTextResponse(result.toTextStreamResponse(), body.message, String(RELEASE.edition), body.answerMode);
  response.headers.set('x-quran-ai-session-id', sessionId);
  response.headers.set('x-quran-ai-mode', intent.mode);
  response.headers.set('x-quran-ai-confidence', String(intent.confidence));
  response.headers.set('x-nusamind-intelligence-level', intelligenceLevel);
  response.headers.set('x-nusamind-session-continuity', 'v13.20');
  response.headers.set('x-nusamind-ml-status', mlAnalysis ? 'active' : 'fallback');
  response.headers.set('x-nusamind-prompt-strategy', promptStrategy.id);
  response.headers.set('x-nusamind-prompt-hash', compiledPrompt.hash.slice(0, 16));
  if (mlAnalysis) response.headers.set('x-nusamind-ml-domain', mlAnalysis.domain);
  return response;
}
