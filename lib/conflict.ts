export type ConflictDatum = {
  entity: string;
  value: unknown;
  sourceId: string;
  authority?: number;
  contentDate?: string;
  effectiveDate?: string;
  scope?: string;
};

export type ConflictRecord = {
  entity: string;
  material: boolean;
  values: Array<{ normalized: string; sourceIds: string[]; authority: number; date?: string }>;
  preferredValue?: string;
  unresolved: boolean;
  safeNextAction: string;
};

function normalizeValue(value: unknown): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'invalid';
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function dateValue(value?: string): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function detectConflicts(data: ConflictDatum[]): ConflictRecord[] {
  const groups = new Map<string, ConflictDatum[]>();
  for (const row of data) {
    const key = row.entity.trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const records: ConflictRecord[] = [];
  for (const [entity, rows] of groups) {
    const variants = new Map<string, ConflictDatum[]>();
    for (const row of rows) {
      const value = normalizeValue(row.value);
      variants.set(value, [...(variants.get(value) || []), row]);
    }
    if (variants.size <= 1) continue;
    const values = [...variants.entries()].map(([normalized, sources]) => ({
      normalized,
      sourceIds: [...new Set(sources.map((item) => item.sourceId))],
      authority: Math.max(...sources.map((item) => item.authority ?? 0.5)),
      date: sources.map((item) => item.effectiveDate || item.contentDate).filter(Boolean).sort().at(-1),
    })).sort((a, b) => b.authority - a.authority || dateValue(b.date) - dateValue(a.date));

    const lead = values[0];
    const runner = values[1];
    const preferred = lead && runner && lead.authority - runner.authority >= 0.25 ? lead.normalized : undefined;
    records.push({
      entity,
      material: true,
      values,
      preferredValue: preferred,
      unresolved: !preferred,
      safeNextAction: preferred
        ? 'Gunakan nilai dengan otoritas lebih kuat dan tampilkan perbedaan sumber.'
        : 'Tampilkan kedua nilai, jelaskan cakupan/tanggal, lalu minta verifikasi atau handoff.',
    });
  }
  return records;
}
