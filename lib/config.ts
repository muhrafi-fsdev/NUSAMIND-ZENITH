import { RELEASE } from './release';
import path from 'node:path';

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
export const SESSION_DIR = path.join(STORAGE_DIR, 'sessions');
export const MEMORY_DIR = path.join(STORAGE_DIR, 'memory');
export const LOG_DIR = path.join(STORAGE_DIR, 'logs');

const editionDefaults = String(RELEASE.edition) === 'apex'
  ? { level: 'thinking', maxSteps: 16, maxOutputTokens: 7000, model: 'qwen3:14b', coder: 'qwen2.5-coder:7b', fallback: 'qwen2.5:7b', heavyCoder: 'qwen3-coder:30b', thinking: 'auto', context: 16384, coderContext: 16384, description: 'Runtime expert dengan Qwen3 14B, adaptive thinking, coding fallback, dan heavy coder opsional.' }
  : RELEASE.edition === 'zenith'
    ? { level: 'high', maxSteps: 10, maxOutputTokens: 5200, model: 'qwen3:8b', coder: 'qwen2.5-coder:7b', fallback: 'qwen2.5:7b', heavyCoder: 'qwen3-coder:30b', thinking: 'auto', context: 16384, coderContext: 12288, description: 'Runtime seimbang dengan Qwen3 8B dan adaptive thinking untuk tugas kompleks.' }
    : { level: 'ordinary', maxSteps: 5, maxOutputTokens: 3000, model: 'qwen3:4b', coder: 'qwen2.5-coder:7b', fallback: 'qwen2.5:7b', heavyCoder: 'qwen3-coder:30b', thinking: 'off', context: 8192, coderContext: 8192, description: 'Runtime cepat dengan Qwen3 4B, coding model khusus, dan fallback lokal.' };

const thinkingMode = String(process.env.OLLAMA_THINKING_MODE || editionDefaults.thinking).toLowerCase();

export const appConfig = {
  version: RELEASE.label,
  edition: process.env.NUSAMIND_EDITION || RELEASE.edition,
  editionName: process.env.NUSAMIND_EDITION_NAME || RELEASE.name,
  editionDescription: process.env.NUSAMIND_EDITION_DESCRIPTION || editionDefaults.description,
  defaultIntelligenceLevel: process.env.AI_DEFAULT_INTELLIGENCE_LEVEL || process.env.AI_DEFAULT_INTELLIGENCE || editionDefaults.level,
  provider: process.env.AI_PROVIDER || 'ollama',
  defaultMode: process.env.AI_DEFAULT_MODE || 'auto',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/api',
  ollamaModel: process.env.OLLAMA_MODEL || editionDefaults.model,
  ollamaCoderModel: process.env.OLLAMA_CODER_MODEL || editionDefaults.coder,
  ollamaFallbackModel: process.env.OLLAMA_FALLBACK_MODEL || editionDefaults.fallback,
  ollamaHeavyCoderModel: process.env.OLLAMA_HEAVY_CODER_MODEL || editionDefaults.heavyCoder,
  heavyCoderEnabled: (process.env.NUSAMIND_HEAVY_CODER_ENABLED || 'false') === 'true',
  ollamaThinkingMode: (['off','auto','on'].includes(thinkingMode) ? thinkingMode : editionDefaults.thinking) as 'off'|'auto'|'on',
  ollamaContextWindow: Number(process.env.OLLAMA_NUM_CTX || editionDefaults.context),
  ollamaCoderContextWindow: Number(process.env.OLLAMA_CODER_NUM_CTX || editionDefaults.coderContext),
  ollamaProbeTimeoutMs: Number(process.env.OLLAMA_PROBE_TIMEOUT_MS || 1400),
  ollamaProbeCacheMs: Number(process.env.OLLAMA_PROBE_CACHE_MS || 5000),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  maxSteps: Number(process.env.AI_MAX_STEPS || editionDefaults.maxSteps),
  temperature: Number(process.env.AI_TEMPERATURE || 0.28),
  maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS || editionDefaults.maxOutputTokens),
  memoryEnabled: (process.env.AI_MEMORY_ENABLED || 'true') !== 'false',
  toolsEnabled: (process.env.AI_ENABLE_TOOLS || 'true') !== 'false',
  streamingEnabled: (process.env.AI_ENABLE_STREAMING || 'true') !== 'false',
};
