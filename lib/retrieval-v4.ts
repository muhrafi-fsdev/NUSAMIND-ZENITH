import { assessSource, independentEvidenceKey, type SourceMeta } from './source-intel.ts';
import { RELEASE } from './release.ts';

type RetrievalLike = {
  id: string;
  source?: string;
  url?: string;
  title?: string;
  text?: string;
  content?: string;
  score?: number;
  metadata?: Record<string, unknown>;
};

function fingerprint(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim().slice(0, 500);
}

function sourceMeta(hit: RetrievalLike): SourceMeta {
  const meta = hit.metadata || {};
  return {
    id: hit.id,
    url: hit.url || String(meta.url || ''),
    canonicalUrl: String(meta.canonicalUrl || ''),
    publisher: String(meta.publisher || hit.source || ''),
    authority: typeof meta.authority === 'number' ? meta.authority : undefined,
    independence: String(meta.independence || ''),
    verified: Boolean(meta.verified),
    deprecated: Boolean(meta.deprecated),
    contentDate: String(meta.contentDate || ''),
    effectiveDate: String(meta.effectiveDate || ''),
    updatedAt: String(meta.updatedAt || ''),
    jurisdiction: String(meta.jurisdiction || ''),
    citationRootId: String(meta.citationRootId || ''),
  };
}

export function diversifyEvidence<T extends RetrievalLike>(
  hits: T[],
  options: { topK?: number; maxPerSource?: number; maxAgeDays?: number } = {},
): T[] {
  const edition = String(RELEASE.edition);
  const topK = Math.max(1, options.topK ?? (edition === 'swift' ? 5 : edition === 'zenith' ? 9 : 16));
  const maxPerSource = Math.max(1, options.maxPerSource ?? (edition === 'apex' ? 3 : 2));
  const seenIds = new Set<string>();
  const seenText = new Set<string>();
  const perSource = new Map<string, number>();

  const ranked = hits.map((hit, index) => {
    const meta = sourceMeta(hit);
    const assessment = assessSource(meta, { maxAgeDays: options.maxAgeDays ?? 730 });
    const base = Number.isFinite(hit.score) ? Number(hit.score) : Math.max(0.1, 1 - index / Math.max(1, hits.length));
    const sourceKey = independentEvidenceKey(meta);
    return { hit, assessment, sourceKey, rank: base * 0.72 + assessment.score * 0.28 };
  }).sort((a, b) => b.rank - a.rank);

  const output: T[] = [];
  for (const item of ranked) {
    if (seenIds.has(item.hit.id)) continue;
    const body = fingerprint(item.hit.text || item.hit.content || item.hit.title || item.hit.id);
    if (body && seenText.has(body)) continue;
    const used = perSource.get(item.sourceKey) || 0;
    if (used >= maxPerSource) continue;
    if (item.assessment.deprecated) continue;
    seenIds.add(item.hit.id);
    if (body) seenText.add(body);
    perSource.set(item.sourceKey, used + 1);
    output.push(item.hit);
    if (output.length >= topK) break;
  }
  return output;
}
