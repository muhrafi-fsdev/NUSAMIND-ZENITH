export type TaskScore = number | null | undefined;
export type SuiteScoreMap = Record<string, number | null | undefined | 'n/a'>;
export type CostEntry = { cost: number; tasks: number };

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const isScore = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Task yang tidak terukur (null/undefined/NaN) dihitung 0, tidak dibuang dari rata-rata. */
export function suiteScore(taskScores: TaskScore[]): number | null {
  if (taskScores.length === 0) return null;
  const total = taskScores.reduce<number>((sum, score) => sum + (isScore(score) ? clamp(score) : 0), 0);
  return total / taskScores.length;
}

/** Rata-rata berbobot sama antar subkategori (Data Analysis dan Reasoning). Subkategori tanpa skor tidak ikut. */
export function equalWeightMean(subcategoryScores: Array<number | null | undefined>): number | null {
  const scored = subcategoryScores.filter(isScore).map(clamp);
  return scored.length === 0 ? null : scored.reduce((sum, score) => sum + score, 0) / scored.length;
}

/** Overall: rata-rata suite yang punya skor. Sel kosong dan n/a tidak ikut; skor 0 ikut. */
export function overallScore(suites: SuiteScoreMap): number | null {
  const scored = Object.values(suites).filter(isScore).map(clamp);
  return scored.length === 0 ? null : scored.reduce((sum, score) => sum + score, 0) / scored.length;
}

/** Biaya per task lintas suite = total biaya / total task, bukan rata-rata biaya per suite. */
export function costPerTask(entries: CostEntry[]): number | null {
  const tasks = entries.reduce((sum, entry) => sum + entry.tasks, 0);
  if (tasks <= 0) return null;
  return entries.reduce((sum, entry) => sum + entry.cost, 0) / tasks;
}

/** (biaya per task / skor) x 100. Skor 0 atau kurang membuat hasil tidak terdefinisi, bukan Infinity. */
export function costPerSuccessfulTask(perTask: number | null, score: number | null): number | null {
  if (perTask === null || score === null || !(score > 0)) return null;
  return (perTask / score) * 100;
}
