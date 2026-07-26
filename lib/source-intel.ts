export type SourceMeta = {
  id: string;
  url?: string;
  canonicalUrl?: string;
  publisher?: string;
  authority?: number;
  independence?: string;
  verified?: boolean;
  deprecated?: boolean;
  contentDate?: string;
  effectiveDate?: string;
  updatedAt?: string;
  jurisdiction?: string;
  version?: string;
  citationRootId?: string;
};

export type SourceAssessment = {
  sourceId: string;
  score: number;
  stale: boolean;
  deprecated: boolean;
  independentKey: string;
  reasons: string[];
};

function dateValue(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedUrl(value?: string): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'ref']) url.searchParams.delete(key);
    return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/+$/, '')}${url.search}`;
  } catch {
    return value.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function independentEvidenceKey(source: SourceMeta): string {
  return source.citationRootId || source.independence || normalizedUrl(source.canonicalUrl || source.url) || source.publisher?.toLowerCase() || source.id;
}

export function assessSource(source: SourceMeta, options: { now?: string; maxAgeDays?: number; requireEffective?: boolean } = {}): SourceAssessment {
  const now = dateValue(options.now) || Date.now();
  const date = dateValue(source.effectiveDate) || dateValue(source.contentDate) || dateValue(source.updatedAt);
  const maxAge = Math.max(1, options.maxAgeDays ?? 365) * 86_400_000;
  const stale = Boolean(date && now - date > maxAge);
  let score = Math.max(0, Math.min(1, source.authority ?? 0.5));
  const reasons: string[] = [];
  if (source.verified) { score += 0.15; reasons.push('verified'); }
  if (source.effectiveDate) { score += 0.08; reasons.push('effective-date'); }
  if (source.contentDate) reasons.push('content-date');
  if (source.jurisdiction) { score += 0.03; reasons.push('jurisdiction'); }
  if (stale) { score -= 0.25; reasons.push('stale'); }
  if (source.deprecated) { score -= 0.6; reasons.push('deprecated'); }
  if (options.requireEffective && !source.effectiveDate) { score -= 0.12; reasons.push('missing-effective-date'); }
  score = Math.max(0, Math.min(1, score));
  return {
    sourceId: source.id,
    score,
    stale,
    deprecated: Boolean(source.deprecated),
    independentKey: independentEvidenceKey(source),
    reasons,
  };
}

export function countIndependentEvidence(sources: SourceMeta[]): number {
  return new Set(sources.map(independentEvidenceKey).filter(Boolean)).size;
}
