import { RELEASE } from './release.ts';

export type ReliabilityEdition = 'swift' | 'zenith' | 'apex';
export type ReasoningPath = 'fast' | 'grounded' | 'analytical' | 'agent';

export type ReasoningInput = {
  question: string;
  edition?: ReliabilityEdition;
  fileCount?: number;
  sourceConflict?: boolean;
  missingInputs?: number;
};

export type ReasoningPlan = {
  edition: ReliabilityEdition;
  path: ReasoningPath;
  complexity: number;
  retrievalTopK: number;
  correctionPasses: number;
  requiredCapabilities: string[];
  recommendedEdition: ReliabilityEdition;
  reasons: string[];
};

const limits = {
  swift: { grounded: 20, analytical: 48, agent: 76, topK: 5, passes: 1 },
  zenith: { grounded: 16, analytical: 40, agent: 69, topK: 9, passes: 1 },
  apex: { grounded: 12, analytical: 34, agent: 61, topK: 16, passes: 3 },
} as const;

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

export function routeReasoning(input: ReasoningInput): ReasoningPlan {
  const question = String(input.question || '').trim();
  const edition = (input.edition || RELEASE.edition) as ReliabilityEdition;
  const cfg = limits[edition];
  const entityCount = Math.min(8, countMatches(question, /\b(?:[A-Z][a-z]{2,}|QS\.?|Rp|USD|EUR|Windows|Linux|Next\.?js|Ollama|SQLite)\b/g));
  const formulaCount = Math.min(8, countMatches(question, /(?:\d+\s*(?:[x×*/+\-]|dibagi|dikali)|%|dBm|Gbps|Mbps|rumus|hitung|integral|turunan)/gi));
  const fileCount = input.fileCount ?? countMatches(question, /\b\S+\.(?:pdf|docx?|xlsx?|csv|json|txt|png|jpe?g|zip|ts|tsx|js|py)\b/gi);
  const toolNeed = /(?:buat|ubah|hapus|jalankan|eksekusi|buka|tutup|install|build|test|deploy|upload)\b/i.test(question) ? 1 : 0;
  const risk = /(?:medis|hukum|investasi|klaim|polis|password|token|admin|registry|hapus|format disk|agama|fatwa)\b/i.test(question) ? 1 : 0;
  const freshness = /(?:terbaru|sekarang|hari ini|live|current|versi terbaru|harga saat ini)\b/i.test(question) ? 1 : 0;
  const conflict = Boolean(input.sourceConflict) || /(?:berbeda|konflik|bertentangan|tidak sama|versi mana yang benar)\b/i.test(question);
  const missingInputs = Math.max(0, input.missingInputs || 0);
  const lengthScore = Math.min(18, Math.ceil(question.length / 90) * 3);

  const complexity = Math.min(100,
    5 + lengthScore + entityCount * 2 + formulaCount * 4 + Math.min(fileCount, 6) * 6 +
    toolNeed * 16 + risk * 13 + freshness * 10 + (conflict ? 16 : 0) + missingInputs * 5
  );

  let path: ReasoningPath = 'fast';
  if (complexity >= cfg.agent || toolNeed && fileCount > 0) path = 'agent';
  else if (complexity >= cfg.analytical || conflict || risk && question.length > 140) path = 'analytical';
  else if (complexity >= cfg.grounded || freshness || fileCount > 0) path = 'grounded';

  const requiredCapabilities = new Set<string>();
  if (formulaCount) requiredCapabilities.add('calculator');
  if (path !== 'fast') requiredCapabilities.add('retrieval');
  if (fileCount) requiredCapabilities.add('artifact-reader');
  if (conflict) requiredCapabilities.add('conflict-detector');
  if (freshness) requiredCapabilities.add('freshness-check');
  if (toolNeed) requiredCapabilities.add('supervised-tools');
  if (risk) requiredCapabilities.add('safety-review');
  if (path === 'analytical' || path === 'agent') requiredCapabilities.add('claim-verifier');

  let recommendedEdition: ReliabilityEdition = edition;
  if (complexity >= 78 || path === 'agent' && risk) recommendedEdition = 'apex';
  else if (complexity >= 45 && edition === 'swift') recommendedEdition = 'zenith';

  const topK = path === 'fast' ? 0 : Math.min(cfg.topK, path === 'grounded' ? Math.max(3, Math.ceil(cfg.topK / 2)) : cfg.topK);
  const correctionPasses = path === 'fast' ? 0 : Math.min(cfg.passes, path === 'grounded' ? 1 : cfg.passes);

  return {
    edition,
    path,
    complexity,
    retrievalTopK: topK,
    correctionPasses,
    requiredCapabilities: [...requiredCapabilities],
    recommendedEdition,
    reasons: [
      `complexity=${complexity}`,
      `path=${path}`,
      fileCount ? `files=${fileCount}` : '',
      formulaCount ? `formulaSignals=${formulaCount}` : '',
      conflict ? 'sourceConflict=true' : '',
      freshness ? 'freshnessNeeded=true' : '',
      toolNeed ? 'toolAction=true' : '',
      risk ? 'riskReview=true' : '',
    ].filter(Boolean),
  };
}
