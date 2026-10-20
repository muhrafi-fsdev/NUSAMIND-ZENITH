import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { appConfig } from '@/lib/config';
import { RELEASE } from '@/lib/release';
import { detectIntent } from '@/lib/intent-router';
import { checkRateLimit, getRateLimitKey } from '@/lib/rate-limit';
import { appendMessage, autoExtractMemory, loadMemory, loadSession, normalizeSessionId, upsertMemory } from '@/lib/memory';
import { appendInteractionLog } from '@/lib/monitoring';
import { resolveModelRuntime } from '@/lib/model';
import { buildStructuredPrompt, buildSystemPrompt } from '@/lib/prompts';
import { compilePrompt } from '@/lib/prompt-engine/registry';
import { routePromptStrategy } from '@/lib/prompt-engine/strategy';
import { cleanAnswer } from '@/lib/safety';
import { buildFastLocalAnswer, formatDirectAccuracyAnswer } from '@/lib/direct-answer-policy';
import { buildExactQuranAnswer } from '@/lib/quran-exact';
import { getIntelligenceProfile, normalizeIntelligenceLevel } from '@/lib/intelligence-level';
import { buildRetrievalQuery, buildSessionContextBlock, getRecentMessagesForPrompt, handleSessionCommand, updateSessionAfterAssistant, updateSessionAfterUser } from '@/lib/session-continuity';
import type { AssistantMode, IntelligenceProfile, RetrievalHit } from '@/lib/types';
import { classifyServiceIntent, normalizeChatMode, requiresHumanHandoff } from '@/lib/customer-service';
import { tryBuildInsuranceFinanceAnswer } from '@/lib/ins-finance';
import { analyzeReligionRequest, buildReligionPrompt } from '@/lib/religion';
import { planAgentGoal } from '@/lib/agent-v3';
import { retrieveKnowledgeV6 } from '@/lib/retrieval-v6';
import { formatFinalAnswer } from '@/lib/answer-format';
import { finalizeReliableAnswer } from '@/lib/reliable';
import { tryBuildCalculationAnswer } from '@/lib/calc-engine';
import { analyzeTextWithMl, buildMlContext, evaluateAnswerWithMl, refineIntentWithMl } from '@/lib/ml-client';
import { analyzeHealthRequest, buildEmergencyHealthAnswer, buildHealthContext } from '@/lib/health-intel';
import { createPrivateHealthSession } from '@/lib/health/private-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonUtf8(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

const requestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  mode: z.enum(['auto', 'quran', 'universal', 'coding', 'companion', 'workflow']).optional().default('auto'),
  intelligenceLevel: z.string().optional().default(appConfig.defaultIntelligenceLevel),
  sessionMode: z.string().optional().default('general_chat'),
  answerMode: z.string().optional().default('auto'),
});

async function selectSources(mode: AssistantMode, message: string, profile: IntelligenceProfile) {
  return retrieveKnowledgeV6(message, mode, String(RELEASE.edition), profile.retrievalTopK);
}

function publicSources(sources: RetrievalHit[]) {
  return sources.map((source) => ({
    id: source.id,
    title: source.title,
    category: source.category,
    score: source.score,
    source: source.source,
  }));
}

export async function POST(req: Request) {
  const body = requestSchema.parse(await req.json());
  const sessionId = normalizeSessionId(body.sessionId);
  const intelligenceLevel = normalizeIntelligenceLevel(body.intelligenceLevel);
  const sessionMode = normalizeChatMode(body.sessionMode);
  const religion = analyzeReligionRequest(body.message, sessionMode, String(RELEASE.edition));
  const religionContext = buildReligionPrompt(religion);
  const mlAnalysis = await analyzeTextWithMl(body.message);
  const mlContext = buildMlContext(mlAnalysis);
  const healthAnalysis = analyzeHealthRequest(body.message);
  const healthContext = buildHealthContext(healthAnalysis);
  const combinedDomainContext = [religionContext, mlContext, healthContext].filter(Boolean).join('\n\n');
  const serviceIntent = classifyServiceIntent(body.message);
  const humanHandoffRecommended = sessionMode !== 'general_chat' && requiresHumanHandoff(body.message, serviceIntent);
  const emergencyHealthAnswer = buildEmergencyHealthAnswer(healthAnalysis);
  if (emergencyHealthAnswer) {
    const answer = formatFinalAnswer(emergencyHealthAnswer, body.message, String(RELEASE.edition), body.answerMode);
    return jsonUtf8({ ok: true, sessionId, answer, mode: 'universal', sessionMode, intelligenceLevel, confidence: 1, reasons: ['R13.45 deterministic emergency health gate.'], safety: 'sensitive_general', sources: [], usage: null, finishReason: 'health_emergency_gate', steps: 0, health: healthAnalysis });
  }
  const intelligenceProfile = getIntelligenceProfile(intelligenceLevel);
  const rate = checkRateLimit(getRateLimitKey(req, sessionId), 60, 60_000);
  if (!rate.ok) {
    return jsonUtf8({ ok: false, error: 'RATE_LIMITED', message: 'Terlalu banyak request. Tunggu sebentar lalu coba lagi.', resetAt: rate.resetAt }, { status: 429 });
  }

  const baseIntent = detectIntent(body.message, religion.active ? 'quran' : body.mode as AssistantMode);
  const intent = refineIntentWithMl(baseIntent, mlAnalysis);
  const startedAt = Date.now();

  const command = await handleSessionCommand(sessionId, body.message);
  if (command.handled) {
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: formatFinalAnswer(command.answer, body.message, String(RELEASE.edition), body.answerMode), mode: body.mode, intelligenceLevel, intent, sources: [] });
    await updateSessionAfterAssistant(sessionId, command.answer, []);
    await appendInteractionLog({ sessionId, route: '/api/chat-json', mode: 'workflow', messageLength: body.message.length, sources: 0, finishReason: 'session_command', steps: 0, latencyMs: Date.now() - startedAt });
    return jsonUtf8({ ok: true, sessionId, answer: formatFinalAnswer(command.answer, body.message, String(RELEASE.edition), body.answerMode), mode: 'workflow', intelligenceLevel, confidence: 1, reasons: [`${RELEASE.label} session command handled locally`], safety: 'normal', sources: [], usage: null, finishReason: 'session_command', steps: 0 });
  }

  const calculationLocal = tryBuildCalculationAnswer(body.message, String(RELEASE.edition), body.answerMode);
  if (calculationLocal && !religion.active) {
    const answer = formatFinalAnswer(calculationLocal.answer, body.message, String(RELEASE.edition), body.answerMode);
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources: [] });
    const updatedSession = await updateSessionAfterAssistant(sessionId, answer, []);
    await appendInteractionLog({
      sessionId,
      route: '/api/chat-json',
      mode: `calculation-${calculationLocal.domain}`,
      messageLength: body.message.length,
      sources: 0,
      finishReason: 'deterministic_calculation',
      steps: 0,
      latencyMs: Date.now() - startedAt,
    });
    return jsonUtf8({
      ok: true,
      sessionId,
      answer,
      mode: 'calculation',
      sessionMode,
      intelligenceLevel,
      confidence: calculationLocal.status === 'verified' ? 1 : 0.5,
      reasons: [`${RELEASE.label} deterministic formula engine; formula=${calculationLocal.formulaId}`],
      safety: calculationLocal.status === 'needs_input' ? 'needs_input' : 'normal',
      sources: [],
      usage: null,
      finishReason: 'deterministic_calculation',
      steps: 0,
      calculation: calculationLocal,
      sessionContext: {
        activeTopic: updatedSession.activeTopic,
        messageCount: updatedSession.messages.length,
        hasLastOutput: Boolean(updatedSession.lastOutput),
      },
    });
  }

  const financeLocal = tryBuildInsuranceFinanceAnswer(body.message, sessionMode);
  if (financeLocal) {
    const answer = formatFinalAnswer(formatDirectAccuracyAnswer(financeLocal.answer, {
      userMessage: body.message,
      mode: intent.mode,
      intelligenceLevel,
      edition: appConfig.edition,
      sourcesCount: 0,
    }), body.message, String(RELEASE.edition));
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources: [] });
    const updatedSession = await updateSessionAfterAssistant(sessionId, answer, []);
    await appendInteractionLog({
      sessionId,
      route: '/api/chat-json',
      mode: `insurance-finance-${financeLocal.result.intent}`,
      messageLength: body.message.length,
      sources: 0,
      finishReason: 'insurance_finance_local',
      steps: 0,
      latencyMs: Date.now() - startedAt,
    });
    return jsonUtf8({
      ok: true,
      sessionId,
      answer,
      mode: 'insurance-finance',
      sessionMode,
      religion,
      serviceIntent,
      modelRuntime: null,
      humanHandoffRecommended,
      intelligenceLevel,
      confidence: financeLocal.result.confidence,
      reasons: [`${RELEASE.label} deterministic insurance calculator.`],
      safety: 'financial_guarded',
      sources: [],
      usage: null,
      finishReason: 'insurance_finance_local',
      steps: 0,
      finance: financeLocal.result,
      sessionContext: {
        activeTopic: updatedSession.activeTopic,
        messageCount: updatedSession.messages.length,
        hasLastOutput: Boolean(updatedSession.lastOutput),
      },
    });
  }

  const fastLocal = buildFastLocalAnswer(body.message);
  if (fastLocal && !religion.active) {
    const answer = formatFinalAnswer(formatDirectAccuracyAnswer(fastLocal.answer, { userMessage: body.message, mode: intent.mode, intelligenceLevel, edition: appConfig.edition, sourcesCount: 0 }), body.message, String(RELEASE.edition), body.answerMode);
    await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources: [] });
    await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources: [] });
    const updatedSession = await updateSessionAfterAssistant(sessionId, answer, []);
    await appendInteractionLog({ sessionId, route: '/api/chat-json', mode: `fast-local-${fastLocal.tag}`, messageLength: body.message.length, sources: 0, finishReason: fastLocal.tag, steps: 0, latencyMs: Date.now() - startedAt });
    return jsonUtf8({ ok: true, sessionId, answer, mode: intent.mode, sessionMode, serviceIntent, humanHandoffRecommended, intelligenceLevel, confidence: 1, reasons: [`${RELEASE.label} ${fastLocal.tag} answered without heavy retrieval/model.`], safety: 'normal', sources: [], usage: null, finishReason: fastLocal.tag, steps: 0, sessionContext: { activeTopic: updatedSession.activeTopic, messageCount: updatedSession.messages.length, hasLastOutput: Boolean(updatedSession.lastOutput) } });
  }

  const preSession = await loadSession(sessionId);
  const retrievalQuery = buildRetrievalQuery(body.message, preSession);
  const exactQuran = await buildExactQuranAnswer(body.message);
  const exactAllowed = Boolean(exactQuran && (!religion.active || religion.allowExactLookup));
  const selectedSources = await selectSources(religion.active ? 'quran' : intent.mode, retrievalQuery, intelligenceProfile);
  const sources = [...(exactQuran?.sources || []), ...selectedSources].filter((item, index, all) => all.findIndex(other => other.id === item.id) === index).slice(0, Math.max(12, intelligenceProfile.retrievalTopK));

  if (!healthAnalysis.privacySensitive) await autoExtractMemory(sessionId, body.message);
  else createPrivateHealthSession(sessionId, body.message);
  await appendMessage(sessionId, { role: 'user', content: body.message, mode: body.mode, intelligenceLevel, intent, sources });
  const continuitySession = await updateSessionAfterUser(sessionId, body.message);
  const memory = await loadMemory(sessionId);

  if (exactQuran && exactAllowed) {
    const answer = formatFinalAnswer(formatDirectAccuracyAnswer(exactQuran.answer, { userMessage: body.message, mode: 'quran', intelligenceLevel, edition: appConfig.edition, sourcesCount: sources.length }), body.message, String(RELEASE.edition), body.answerMode);
    await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources });
    await updateSessionAfterAssistant(sessionId, answer, sources);
    await upsertMemory(sessionId, 'last_exact_quran_answer', `Guard=${exactQuran.guardType}; TopicOrSurah=${exactQuran.surahName}; QS=${exactQuran.surahId}; Source=${exactQuran.dataSource}`, 2);
    await appendInteractionLog({
      sessionId,
      route: '/api/chat-json',
      mode: `quran-${exactQuran.guardType}`,
      messageLength: body.message.length,
      sources: sources.length,
      finishReason: `exact_quran_${exactQuran.guardType}_guard`,
      steps: 0,
      latencyMs: Date.now() - startedAt,
    });
    return jsonUtf8({
      ok: true,
      sessionId,
      answer,
      mode: 'quran',
      intelligenceLevel,
      intelligenceProfile: { name: intelligenceProfile.name, retrievalTopK: intelligenceProfile.retrievalTopK, reasoningDepth: intelligenceProfile.reasoningDepth },
      confidence: 1,
      reasons: [`Exact Quran Database Guard aktif: ${exactQuran.guardType}; sumber=${exactQuran.dataSource}.`],
      safety: 'religious_guarded',
      sources: publicSources(sources),
      usage: null,
      finishReason: `exact_quran_${exactQuran.guardType}_guard`,
      steps: 0,
      sessionContext: { activeTopic: continuitySession.activeTopic, hasLastOutput: Boolean(continuitySession.lastOutput), messageCount: continuitySession.messages.length },
    });
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

  const modelRuntime = await resolveModelRuntime(intent, intelligenceLevel);

  const result = await generateText({
    model: modelRuntime.model,
    system: compiledPrompt.system,
    messages: [
      ...recentMessages,
      { role: 'user', content: compiledPrompt.user },
    ],
    tools: appConfig.toolsEnabled ? {
      searchQuranKnowledge: tool({
        description: 'Cari konteks lokal Al-Qur\'an dan tema Islam.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(query, 'quran', String(RELEASE.edition), 12),
      }),
      searchUniversalKnowledge: tool({
        description: 'Cari konteks universal lokal untuk coding, laptop, jaringan, umum, dan session continuity.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(buildRetrievalQuery(query, session), 'universal', String(RELEASE.edition), 12),
      }),
      planSafeWorkflow: tool({
        description: 'Membuat plan bounded/supervised dengan permission, expected state, verification, checkpoint, dan rollback policy.',
        inputSchema: z.object({ goal: z.string(), confirmed: z.boolean().optional().default(false) }),
        execute: async ({ goal, confirmed }: { goal: string; confirmed?: boolean }) => planAgentGoal(goal, Boolean(confirmed), sessionId),
      }),
      searchWorkflowKnowledge: tool({
        description: 'Cari blueprint workflow pengembangan AI lokal, CLI, memory, dan session continuity.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }: { query: string }) => retrieveKnowledgeV6(buildRetrievalQuery(query, session), 'workflow', String(RELEASE.edition), 12),
      }),
    } : undefined,
    stopWhen: stepCountIs(appConfig.maxSteps),
    temperature: intelligenceProfile.temperature ?? appConfig.temperature,
    maxOutputTokens: Math.min(7000, Math.max(appConfig.maxOutputTokens, intelligenceProfile.maxOutputTokens)),
    providerOptions: modelRuntime.providerOptions,
  });

  const formattedAnswer = formatFinalAnswer(formatDirectAccuracyAnswer(cleanAnswer(result.text || ''), { userMessage: body.message, mode: intent.mode, intelligenceLevel, edition: appConfig.edition, sourcesCount: sources.length }), body.message, String(RELEASE.edition), body.answerMode);
  const reliable = finalizeReliableAnswer({
    question: body.message,
    answer: formattedAnswer,
    edition: RELEASE.edition,
    sourceCount: sources.length,
    safetyOk: true,
    requestedFormatMet: true,
  });
  const answer = reliable.answer;
  const mlEvaluation = await evaluateAnswerWithMl(body.message, answer, sources.map((source) => source.text || source.title));
  await appendMessage(sessionId, { role: 'assistant', content: answer, mode: body.mode, intelligenceLevel, intent, sources });
  const updatedSession = await updateSessionAfterAssistant(sessionId, answer, sources);
  await upsertMemory(sessionId, 'last_json_interaction', `Mode=${intent.mode}; finish=${result.finishReason}; steps=${result.steps?.length || 0}; activeTopic=${updatedSession.activeTopic || '-'}`, 1);
  await appendInteractionLog({
    sessionId,
    route: '/api/chat-json',
    mode: intent.mode,
    messageLength: body.message.length,
    sources: sources.length,
    finishReason: result.finishReason,
    steps: result.steps?.length || 0,
    latencyMs: Date.now() - startedAt,
  });

  return jsonUtf8({
    ok: true,
    sessionId,
    answer,
    mode: intent.mode,
    intelligenceLevel,
    intelligenceProfile: { name: intelligenceProfile.name, retrievalTopK: intelligenceProfile.retrievalTopK, reasoningDepth: intelligenceProfile.reasoningDepth },
    confidence: intent.confidence,
    reasons: intent.reasons,
    safety: intent.safety,
    promptStrategy,
    promptHash: compiledPrompt.hash.slice(0, 16),
    sources: publicSources(sources),
    usage: result.usage,
    finishReason: result.finishReason,
    steps: result.steps?.length || 0,
    reliability: reliable.reliability,
    ml: { analysis: mlAnalysis, evaluation: mlEvaluation },
    sessionContext: { activeTopic: updatedSession.activeTopic, messageCount: updatedSession.messages.length, hasLastOutput: Boolean(updatedSession.lastOutput), tasks: (updatedSession.pendingTasks || []).length, artifacts: (updatedSession.artifacts || []).length },
    sessionMode,
    serviceIntent,
    modelRuntime: { selectedModel: modelRuntime.selectedModel, requestedModel: modelRuntime.requestedModel, route: modelRuntime.route, fallbackUsed: modelRuntime.fallbackUsed, probeOk: modelRuntime.probeOk, thinking: modelRuntime.thinking },
    humanHandoffRecommended,
  });
}
