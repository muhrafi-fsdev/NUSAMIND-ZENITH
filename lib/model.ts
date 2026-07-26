import { createOpenAI } from '@ai-sdk/openai';
import { createOllama } from 'ollama-ai-provider-v2';
import { appConfig } from './config';
import type { IntentResult } from './types';

export function getModel(intent: IntentResult) {
  if (appConfig.provider === 'openai' && process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai(appConfig.openaiModel);
  }

  const ollama = createOllama({
    baseURL: appConfig.ollamaBaseUrl,
  });

  const modelName = intent.mode === 'coding' ? appConfig.ollamaCoderModel : appConfig.ollamaModel;
  return ollama(modelName);
}

export async function checkOllama(): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    const base = appConfig.ollamaBaseUrl.replace(/\/api\/?$/, '');
    const res = await fetch(`${base}/api/tags`, { cache: 'no-store' });
    if (!res.ok) return { ok: false, message: `Ollama HTTP ${res.status}` };
    const json = await res.json();
    const models = Array.isArray(json.models) ? json.models.map((m: any) => m.name).filter(Boolean) : [];
    return { ok: true, message: 'Ollama aktif', models };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Ollama tidak terhubung' };
  }
}
