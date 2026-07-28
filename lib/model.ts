import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { appConfig } from './config';
import { RELEASE } from './release';
import type { IntentResult, IntelligenceLevel } from './types';

type ProbeState = { at: number; models: string[]; ok: boolean };
let probeCache: ProbeState = { at: 0, models: [], ok: false };

function ollamaClient() {
  return createOllama({ baseURL: appConfig.ollamaBaseUrl });
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function modelInstalled(installed: string[], requested: string) {
  if (!installed.length) return false;
  return installed.some((name) => name === requested || name === `${requested}:latest` || name.replace(/:latest$/, '') === requested.replace(/:latest$/, ''));
}

async function probeModels(): Promise<ProbeState> {
  const now = Date.now();
  if (now - probeCache.at < appConfig.ollamaProbeCacheMs) return probeCache;
  try {
    const base = appConfig.ollamaBaseUrl.replace(/\/api\/?$/, '');
    const response = await fetch(`${base}/api/tags`, { cache: 'no-store', signal: AbortSignal.timeout(appConfig.ollamaProbeTimeoutMs) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { models?: Array<{ name?: string }> };
    probeCache = { at: now, ok: true, models: (payload.models || []).map((item) => String(item.name || '')).filter(Boolean) };
  } catch {
    probeCache = { at: now, ok: false, models: [] };
  }
  return probeCache;
}

export function resolveThinking(modelName: string, intent: IntentResult, level: IntelligenceLevel | string) {
  if (!/^qwen3(?::|-)/i.test(modelName)) return false;
  if (appConfig.ollamaThinkingMode === 'off') return false;
  if (appConfig.ollamaThinkingMode === 'on') return true;
  if (RELEASE.edition === 'swift') return false;
  if (intent.mode === 'companion' || level === 'instant' || level === 'ordinary') return false;
  if (RELEASE.edition === 'zenith') return level === 'high' || level === 'thinking';
  return level === 'medium' || level === 'high' || level === 'thinking';
}

function desiredModel(intent: IntentResult, level: IntelligenceLevel | string) {
  const heavyCoder = RELEASE.edition === 'apex' && appConfig.heavyCoderEnabled && intent.mode === 'coding' && level === 'thinking';
  if (heavyCoder) return { name: appConfig.ollamaHeavyCoderModel, route: 'heavy-coding' as const };
  if (intent.mode === 'coding') return { name: appConfig.ollamaCoderModel, route: 'coding' as const };
  return { name: appConfig.ollamaModel, route: 'general' as const };
}

export function buildOllamaProviderOptions(modelName: string, intent: IntentResult, level: IntelligenceLevel | string) {
  const think = resolveThinking(modelName, intent, level);
  const numCtx = intent.mode === 'coding' ? appConfig.ollamaCoderContextWindow : appConfig.ollamaContextWindow;
  return {
    ollama: {
      think,
      options: {
        num_ctx: numCtx,
        repeat_penalty: 1.08,
        top_k: think ? 20 : 40,
        top_p: think ? 0.95 : 0.85,
      },
    },
  };
}

export async function resolveModelRuntime(intent: IntentResult, level: IntelligenceLevel | string = appConfig.defaultIntelligenceLevel) {
  if (appConfig.provider === 'openai' && process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return { model: openai(appConfig.openaiModel), selectedModel: appConfig.openaiModel, requestedModel: appConfig.openaiModel, route: 'openai', fallbackUsed: false, probeOk: true, installedModels: [] as string[], thinking: false, providerOptions: undefined };
  }

  const desired = desiredModel(intent, level);
  const probe = await probeModels();
  const candidates = intent.mode === 'coding'
    ? unique([desired.name, appConfig.ollamaCoderModel, appConfig.ollamaModel, appConfig.ollamaFallbackModel])
    : unique([desired.name, appConfig.ollamaFallbackModel]);
  const selectedModel = probe.ok ? (candidates.find((candidate) => modelInstalled(probe.models, candidate)) || desired.name) : desired.name;
  const providerOptions = buildOllamaProviderOptions(selectedModel, intent, level);
  return {
    model: ollamaClient()(selectedModel),
    selectedModel,
    requestedModel: desired.name,
    route: selectedModel === desired.name ? desired.route : 'fallback',
    fallbackUsed: selectedModel !== desired.name,
    probeOk: probe.ok,
    installedModels: probe.models,
    thinking: Boolean(providerOptions.ollama.think),
    providerOptions,
  };
}

export function getModel(intent: IntentResult) {
  if (appConfig.provider === 'openai' && process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai(appConfig.openaiModel);
  }
  return ollamaClient()(desiredModel(intent, appConfig.defaultIntelligenceLevel).name);
}

export async function checkOllama(): Promise<{ ok: boolean; message: string; models?: string[] }> {
  const probe = await probeModels();
  return probe.ok
    ? { ok: true, message: 'Ollama aktif', models: probe.models }
    : { ok: false, message: 'Ollama tidak terhubung atau model belum dapat diprofilkan' };
}
