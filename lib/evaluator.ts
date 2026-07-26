import path from 'node:path';
import { DATA_DIR } from './config';
import { safeJson } from './util';

export type GoldenCase = {
  id: string;
  mode: string;
  input: string;
  must_include: string[];
  must_not_include: string[];
  risk: string;
};

export async function loadGoldenSet(): Promise<GoldenCase[]> {
  return safeJson<GoldenCase[]>(path.join(DATA_DIR, 'evaluations/golden.json'), []);
}

export function evaluateText(answer: string, test: GoldenCase) {
  const lower = answer.toLowerCase();
  const missing = test.must_include.filter((term) => !lower.includes(term.toLowerCase()));
  const forbidden = test.must_not_include.filter((term) => lower.includes(term.toLowerCase()));
  const passed = missing.length === 0 && forbidden.length === 0;
  return {
    testId: test.id,
    mode: test.mode,
    passed,
    missing,
    forbidden,
    score: passed ? 1 : Math.max(0, 1 - (missing.length + forbidden.length) * 0.2),
  };
}

export async function getEvaluationPlan() {
  const goldenSet = await loadGoldenSet();
  return {
    totalCases: goldenSet.length,
    byMode: goldenSet.reduce<Record<string, number>>((acc, item) => {
      acc[item.mode] = (acc[item.mode] || 0) + 1;
      return acc;
    }, {}),
    cases: goldenSet,
  };
}
