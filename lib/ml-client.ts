import type { IntentResult } from './types';

export interface MlAnalysis {
  domain: string;
  intent: string;
  confidence: number;
  sentiment: string;
  sentiment_score: number;
  emotion: string;
  urgency: 'low' | 'medium' | 'high' | string;
  urgency_score: number;
  risk: 'low' | 'medium' | 'high' | string;
  language: string;
  pii_types: string[];
  complexity?: { label?: string; score?: number; tokens?: number; sentences?: number };
  backend: string;
  latency_ms?: number;
}

export interface MlHealth {
  ok: boolean;
  status: string;
  release?: string;
  capabilities?: Record<string, unknown>;
  error?: string;
}

const enabled = () => String(process.env.NUSAMIND_ML_ENABLED || 'true').toLowerCase() === 'true';
const baseUrl = () => String(process.env.NUSAMIND_ML_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const timeoutMs = () => Math.max(200, Number(process.env.NUSAMIND_ML_TIMEOUT_MS || 1000));
const minConfidence = () => Math.min(0.99, Math.max(0.5, Number(process.env.NUSAMIND_ML_MIN_CONFIDENCE || 0.78)));

async function mlFetch(path: string, init?: RequestInit, timeout = timeoutMs()): Promise<Response | null> {
  if (!enabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getMlHealth(): Promise<MlHealth> {
  if (!enabled()) return { ok: false, status: 'disabled' };
  const response = await mlFetch('/health', { method: 'GET' }, Math.min(timeoutMs(), 900));
  if (!response?.ok) return { ok: false, status: 'unavailable', error: response ? `HTTP_${response.status}` : 'CONNECTION_FAILED' };
  try {
    return await response.json() as MlHealth;
  } catch {
    return { ok: false, status: 'invalid_response' };
  }
}

export async function analyzeTextWithMl(text: string): Promise<MlAnalysis | null> {
  if (!text.trim()) return null;
  const response = await mlFetch('/v1/analyze', { method: 'POST', body: JSON.stringify({ text }) });
  if (!response?.ok) return null;
  try {
    const payload = await response.json() as { ok?: boolean; analysis?: MlAnalysis };
    if (!payload.ok || !payload.analysis || typeof payload.analysis.domain !== 'string') return null;
    return payload.analysis;
  } catch {
    return null;
  }
}

export function refineIntentWithMl(current: IntentResult, ml: MlAnalysis | null): IntentResult {
  if (!ml || ml.confidence < minConfidence() || current.confidence >= 0.96) return current;
  const mapping: Record<string, IntentResult['mode']> = {
    religion: 'quran',
    coding: 'coding',
    ai_ml: 'workflow',
    telecom: 'coding',
    networking: 'coding',
    data: 'coding',
    companion: 'companion',
    insurance: 'universal',
    finance: 'universal',
    health: 'universal',
    legal: 'universal',
    education: 'universal',
    career: 'universal',
    customer_service: 'universal',
    general: 'universal',
  };
  const proposed = mapping[ml.domain] || current.mode;
  const confidence = Math.max(current.confidence, Math.min(0.97, ml.confidence));
  const safety: IntentResult['safety'] = proposed === 'quran' ? 'religious_guarded' : ['health', 'legal', 'finance', 'insurance'].includes(ml.domain) ? 'sensitive_general' : current.safety;
  return {
    mode: proposed,
    confidence,
    safety,
    reasons: [...current.reasons, `R13.45 ML: domain=${ml.domain}; intent=${ml.intent}; confidence=${ml.confidence.toFixed(2)}; backend=${ml.backend}.`],
  };
}

export function buildMlContext(ml: MlAnalysis | null): string {
  if (!ml) return '';
  const pii = ml.pii_types?.length ? ml.pii_types.join(', ') : 'none';
  return [
    'ML advisory signal (R13.45; bukan fakta final dan tidak boleh mengalahkan evidence):',
    `domain=${ml.domain}`,
    `intent=${ml.intent}`,
    `confidence=${ml.confidence}`,
    `sentiment=${ml.sentiment}`,
    `emotion=${ml.emotion}`,
    `urgency=${ml.urgency}`,
    `risk=${ml.risk}`,
    `language=${ml.language}`,
    `pii=${pii}`,
    'Gunakan sinyal ini hanya untuk routing, gaya respons, klarifikasi, dan kehati-hatian. Jangan membuat keputusan medis, hukum, finansial, atau klaim asuransi berdasarkan prediksi ML saja.',
  ].join('\n');
}

export async function evaluateAnswerWithMl(question: string, answer: string, evidence: string[] = []): Promise<Record<string, unknown> | null> {
  if (String(process.env.NUSAMIND_ML_EVAL_ENABLED || 'false').toLowerCase() !== 'true') return null;
  const response = await mlFetch('/v1/evaluate', { method: 'POST', body: JSON.stringify({ question, answer, evidence: evidence.slice(0, 12) }) }, Math.max(timeoutMs(), 1200));
  if (!response?.ok) return null;
  try {
    const payload = await response.json() as { ok?: boolean; evaluation?: Record<string, unknown> };
    return payload.ok ? payload.evaluation || null : null;
  } catch {
    return null;
  }
}

export async function proxyMlOperation(operation: string, payload: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const allowed = new Set(['analyze', 'batch', 'embed', 'similarity', 'anomaly', 'evaluate', 'health-analyze', 'neural-predict', 'neural-benchmark']);
  if (!allowed.has(operation)) return { ok: false, status: 400, data: { error: 'UNSUPPORTED_ML_OPERATION' } };
  const response = await mlFetch(`/v1/${operation}`, { method: 'POST', body: JSON.stringify(payload) }, Math.max(timeoutMs(), 3000));
  if (!response) return { ok: false, status: 503, data: { error: 'ML_SERVICE_UNAVAILABLE' } };
  let data: unknown;
  try { data = await response.json(); } catch { data = { error: 'INVALID_ML_RESPONSE' }; }
  return { ok: response.ok, status: response.status, data };
}
