import path from 'node:path';
import fs from 'node:fs/promises';
import { DATA_DIR } from './config';
import type { RetrievalHit } from './types';
import { clampText, normalizeText, safeJson, tokenize } from './util';
import { buildFullSurahRetrievalHits } from './quran-exact';
import { buildKnowledgeGuideHit, buildKnowledgeRoute, recordKnowledgeGap } from './knowledge-center';

let quranCache: RetrievalHit[] | null = null;
let universalCache: RetrievalHit[] | null = null;
let siteCache: RetrievalHit[] | null = null;
let ayahCache: RetrievalHit[] | null = null;
let workflowCache: RetrievalHit[] | null = null;
let languageCache: RetrievalHit[] | null = null;
let expansionCache: RetrievalHit[] | null = null;
let fullSurahCache: RetrievalHit[] | null = null;

const EXCLUDED_DYNAMIC_JSON = new Set([
  'core/universal.json','language/core.json','quran/ayah-idx.json','quran/surahs.json',
  'quran/chunks.json','quran/docs.json','quran/search.json','quran/doa.json','quran/dzikir.json',
  'core/site.json','runtime/blueprint.json','quran/training.json',
  'runtime/profile.json','runtime/perf.json','runtime/answers.json','runtime/release.json',
  'benchmarks/metrics.json','benchmarks/cats.json','benchmarks/history.json'
]);
async function listJsonFiles(dir: string, prefix = ''): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...await listJsonFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(rel);
  }
  return out;
}

function score(queryTokens: string[], haystack: string, tags: string[] = []): number {
  const normalized = normalizeText(haystack);
  const tagText = normalizeText(tags.join(' '));
  const [title = '', category = '', ...bodyParts] = haystack.split('\n');
  const normalizedTitle = normalizeText(title);
  const normalizedCategory = normalizeText(category);
  const normalizedBody = normalizeText(bodyParts.join(' '));
  let total = 0;
  let matchedImportant = 0;
  const importantTokens = queryTokens.filter((token) => token.length >= 3);
  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) total += token.length > 4 ? 4.5 : 2.8;
    if (normalizedCategory.includes(token)) total += 2.0;
    if (normalizedBody.includes(token)) total += token.length > 4 ? 2.2 : 1.2;
    if (tagText.includes(token)) total += 2.4;
    if (token.length >= 3 && normalized.includes(token)) matchedImportant += 1;
  }
  const phrase = queryTokens.join(' ');
  if (phrase && normalized.includes(phrase)) total += 7;
  if (importantTokens.length > 0) total += (matchedImportant / importantTokens.length) * 4;
  return total;
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join('; ');
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, val]) => `${key}: ${stringifyValue(val)}`).join('; ');
  return '';
}

function recordToHit(file: string, item: any, index: number): RetrievalHit | null {
  const id = String(item.id || item.key || `${file.replace(/\.json$/, '')}_${index}`);
  const title = String(item.title || item.instruction || item.feature || item.sub_fitur || item.subcategory || item.category || `Knowledge ${index + 1}`);
  const category = String(item.category || item.area_upgrade || item.mode || file.replace(/\.json$/, ''));
  const tags = Array.isArray(item.tags) ? item.tags.map(String) : [file.replace(/\.json$/, ''), String(item.version || '')].filter(Boolean);
  const textParts = [
    item.text,
    item.content,
    item.description,
    item.objective,
    item.goal,
    item.tujuan,
    item.kenapa_penting,
    item.fitur_yang_dibuat,
    item.cara_kerja_disarankan,
    item.expectedBehavior,
    item.criteria,
    item.responsePattern,
    item.workingRule,
    item.safePolicy,
    item.guardrail,
    item.guardrail_catatan,
    item.commandExample,
    item.exampleCommand,
    item.exampleUsage,
    item.commands,
    item.implementationHint,
    item.dataNeeded,
    item.formatSuggestion,
    item.metric,
    item.metrik_evaluasi,
    item.catatan_pengembangan,
    item.must_include,
    item.must_not_include,
    item.input,
    item.output,
    item.userVariant,
    item.normalized,
  ].map(stringifyValue).filter(Boolean);
  const text = textParts.join('\n');
  if (text.length < 10) return null;
  return {
    id,
    title,
    category,
    text,
    source: String(item.source || file),
    tags,
    score: 0,
    metadata: { version: item.version, confidence: item.confidence, file },
  };
}

async function loadFullSurahKnowledge(): Promise<RetrievalHit[]> {
  if (fullSurahCache) return fullSurahCache;
  fullSurahCache = await buildFullSurahRetrievalHits();
  return fullSurahCache;
}

async function loadQuranKnowledge(): Promise<RetrievalHit[]> {
  if (quranCache) return quranCache;
  const chunks = await safeJson<any[]>(path.join(DATA_DIR, 'quran/chunks.json'), []);
  quranCache = chunks.map((chunk, index) => ({
    id: String(chunk.id || `quran_chunk_${index}`),
    title: String(chunk.title || chunk.category || 'Knowledge Al-Qur\'an'),
    category: String(chunk.category || 'Al-Qur\'an'),
    text: String(chunk.text || chunk.excerpt || ''),
    source: String(chunk.source_label || chunk.source_file || 'Knowledge Base Al-Qur\'an'),
    tags: Array.isArray(chunk.tags) ? chunk.tags : [],
    score: 0,
    metadata: {
      page: chunk.page,
      source_path: chunk.source_path,
      document_id: chunk.document_id,
    },
  })).filter((item) => item.text.length > 10);
  return quranCache;
}

async function loadSiteKnowledge(): Promise<RetrievalHit[]> {
  if (siteCache) return siteCache;
  const site = await safeJson<any[]>(path.join(DATA_DIR, 'core/site.json'), []);
  const doa = await safeJson<any[]>(path.join(DATA_DIR, 'quran/doa.json'), []);
  const dzikir = await safeJson<any[]>(path.join(DATA_DIR, 'quran/dzikir.json'), []);
  siteCache = [
    ...site.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      category: String(item.category || 'Website'),
      text: [item.context, item.translation, item.details].filter(Boolean).join('\n'),
      source: 'core/site.json',
      tags: Array.isArray(item.tags) ? item.tags : [],
      score: 0,
    })),
    ...doa.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      category: String(item.category || 'Doa'),
      text: [item.context, item.arabic, item.latin, item.translation, item.source].filter(Boolean).join('\n'),
      source: String(item.source || 'quran/doa.json'),
      tags: Array.isArray(item.tags) ? item.tags : [],
      score: 0,
    })),
    ...dzikir.map((item) => ({
      id: String(item.id),
      title: String(item.title),
      category: String(item.category || 'Dzikir'),
      text: [item.arabic, item.latin, item.translation, item.note, item.source].filter(Boolean).join('\n'),
      source: String(item.source || 'quran/dzikir.json'),
      tags: Array.isArray(item.tags) ? item.tags : [],
      score: 0,
    })),
  ];
  return siteCache;
}

async function loadAyahKnowledge(): Promise<RetrievalHit[]> {
  if (ayahCache) return ayahCache;
  const ayahs = await safeJson<any[]>(path.join(DATA_DIR, 'quran/ayah-idx.json'), []);
  ayahCache = ayahs.map((ayah) => ({
    id: `ayah_${ayah.suraId}_${ayah.verseID}`,
    title: `QS ${ayah.suraId}:${ayah.verseID}`,
    category: 'Ayat Al-Qur\'an',
    text: [ayah.ayahText, ayah.readText, ayah.indoText].filter(Boolean).join('\n'),
    source: `quran/ayah-idx.json QS ${ayah.suraId}:${ayah.verseID}`,
    tags: ['quran', 'ayat', `surah-${ayah.suraId}`],
    score: 0,
  })).filter((item) => item.text.length > 8);
  return ayahCache;
}

async function loadUniversalKnowledge(): Promise<RetrievalHit[]> {
  if (universalCache) return universalCache;
  const data = await safeJson<any[]>(path.join(DATA_DIR, 'core/universal.json'), []);
  universalCache = data.map((item, index) => ({
    id: String(item.id || `universal_${index}`),
    title: String(item.title || 'Universal Knowledge'),
    category: String(item.category || 'Universal'),
    text: String(item.text || item.content || ''),
    source: String(item.source || 'NusaMind Universal Context V13'),
    tags: Array.isArray(item.tags) ? item.tags : [],
    score: 0,
    metadata: { confidence: item.confidence, version: item.version },
  })).filter((item) => item.text.length > 10);
  return universalCache;
}

async function loadWorkflowKnowledge(): Promise<RetrievalHit[]> {
  if (workflowCache) return workflowCache;
  const data = await safeJson<any[]>(path.join(DATA_DIR, 'runtime/blueprint.json'), []);
  workflowCache = data.flatMap((stage, index) => [{
    id: `workflow_stage_${stage.id || index}`,
    title: stage.title || `Tahap ${index + 1}`,
    category: 'AI Workflow',
    text: [stage.objective, ...(stage.checklist || []), ...(stage.outputs || []), ...(stage.metrics || []), ...(stage.tools || [])].filter(Boolean).join('\n'),
    source: 'runtime/blueprint.json',
    tags: Array.isArray(stage.tags) ? stage.tags : ['workflow', 'ai-local'],
    score: 0,
    metadata: { stage: stage.id, priority: stage.priority || index + 1 },
  }]);
  return workflowCache;
}

async function loadLanguageVariants(): Promise<RetrievalHit[]> {
  if (languageCache) return languageCache;
  const data = await safeJson<any[]>(path.join(DATA_DIR, 'language/core.json'), []);
  languageCache = data.map((item, index) => ({
    id: `language_variant_${index}_${item.normalized || item.phrase}`,
    title: `Language Variant: ${item.phrase}`,
    category: `Language Understanding - ${item.mode || 'auto'}`,
    text: `Frasa user "${item.phrase}" biasanya diarahkan ke mode ${item.mode || 'auto'}. Normalisasi: ${item.normalized || item.phrase}. Gunakan ini untuk memahami bahasa santai, typo, rujukan pendek, follow-up, dan maksud user.`,
    source: String(item.source || 'language/core.json'),
    tags: ['language', 'variant', String(item.mode || 'auto'), String(item.phrase || '')],
    score: 0,
    metadata: { mode: item.mode, weight: item.weight },
  })).filter((item) => item.text.length > 10);
  return languageCache;
}

async function loadExpansionKnowledge(): Promise<RetrievalHit[]> {
  if (expansionCache) return expansionCache;
  const files = (await listJsonFiles(DATA_DIR)).filter((file) => !EXCLUDED_DYNAMIC_JSON.has(file));
  const groups = await Promise.all(files.map(async (file: string) => {
    const raw = await safeJson<any>(path.join(DATA_DIR, file), []);
    const rows = Array.isArray(raw) ? raw : Array.isArray(raw.samples) ? raw.samples : [];
    return rows.map((item: any, index: number) => recordToHit(file, item, index)).filter(Boolean) as RetrievalHit[];
  }));
  const merged: RetrievalHit[] = groups.flat().filter((item: RetrievalHit) => item.text.length > 10);
  expansionCache = merged;
  return merged;
}

function rank(query: string, candidates: RetrievalHit[], limit: number): RetrievalHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  return candidates
    .map((item) => {
      const combined = `${item.title}\n${item.category}\n${item.text}`;
      return { ...item, text: clampText(item.text, 1600), score: score(tokens, combined, item.tags) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function searchQuranKnowledge(query: string, limit = 8): Promise<RetrievalHit[]> {
  const [fullSurahs, chunks, site, ayahs] = await Promise.all([loadFullSurahKnowledge(), loadQuranKnowledge(), loadSiteKnowledge(), loadAyahKnowledge()]);
  return rank(query, [...fullSurahs, ...site, ...ayahs, ...chunks], limit);
}

export async function searchUniversalKnowledge(query: string, limit = 8): Promise<RetrievalHit[]> {
  const [universal, language, expansion] = await Promise.all([loadUniversalKnowledge(), loadLanguageVariants(), loadExpansionKnowledge()]);
  const route = buildKnowledgeRoute(query);
  const routedQuery = `${query} ${route.domainName} ${route.aliases.join(' ')}`;
  const ranked = rank(routedQuery, [...language, ...expansion, ...universal], Math.max(1, limit - 1));
  if (!ranked.length) { try { recordKnowledgeGap(query, 'Universal retrieval returned no strong packaged/custom hit.'); } catch {} }
  return [buildKnowledgeGuideHit(query) as RetrievalHit, ...ranked].slice(0, limit);
}

export async function searchWorkflowKnowledge(query: string, limit = 8): Promise<RetrievalHit[]> {
  const [workflow, expansion] = await Promise.all([loadWorkflowKnowledge(), loadExpansionKnowledge()]);
  return rank(query, [...workflow, ...expansion], limit);
}

export async function searchHybridKnowledge(query: string, limit = 10): Promise<RetrievalHit[]> {
  const [quran, universal, workflow] = await Promise.all([
    searchQuranKnowledge(query, Math.ceil(limit / 3)),
    searchUniversalKnowledge(query, Math.ceil(limit / 2)),
    searchWorkflowKnowledge(query, Math.ceil(limit / 3)),
  ]);
  return [...quran, ...workflow, ...universal].sort((a, b) => b.score - a.score).slice(0, limit);
}

export function formatSourcesForPrompt(hits: RetrievalHit[]): string {
  if (!hits.length) return 'Tidak ada konteks lokal yang cukup kuat.';
  return hits.map((hit, index) => `[${index + 1}] ${hit.title} | ${hit.category} | score=${hit.score.toFixed(2)}\nSumber: ${hit.source || '-'}\nIsi: ${clampText(hit.text, 900)}`).join('\n\n');
}
