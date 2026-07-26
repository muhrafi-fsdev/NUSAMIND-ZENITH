export type ClaimState = 'VERIFIED' | 'SUPPORTED' | 'INFERRED' | 'ESTIMATED' | 'DISPUTED' | 'MISSING_EVIDENCE' | 'UNSUPPORTED';

export type ClaimAssessment = {
  text: string;
  state: ClaimState;
  critical: boolean;
};

export type QualityScorecard = {
  intentMatch: number;
  numericalCorrectness: number;
  factualCorrectness: number;
  evidenceCoverage: number;
  citationCorrectness: number;
  completeness: number;
  safety: number;
  formatting: number;
  preferenceCompliance: number;
  criticalGatePassed: boolean;
};

export function extractClaims(answer: string): string[] {
  return String(answer || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12 && !/^[-*#]/.test(item))
    .slice(0, 80);
}

export function assessClaims(input: {
  answer: string;
  sourceCount?: number;
  calculationVerified?: boolean;
  conflictCount?: number;
}): ClaimAssessment[] {
  const sourceCount = Math.max(0, input.sourceCount || 0);
  const calculationVerified = Boolean(input.calculationVerified);
  const conflicts = Math.max(0, input.conflictCount || 0);
  return extractClaims(input.answer).map((text) => {
    const numeric = /\d/.test(text);
    const hedged = /(?:perkiraan|estimasi|kemungkinan|asumsi|inferensi)/i.test(text);
    const critical = numeric || /(?:harus|tidak boleh|aman|klaim|hukum|medis|agama|investasi)/i.test(text);
    let state: ClaimState = 'INFERRED';
    if (conflicts) state = 'DISPUTED';
    else if (numeric && calculationVerified) state = 'VERIFIED';
    else if (sourceCount > 0) state = 'SUPPORTED';
    else if (hedged) state = 'ESTIMATED';
    else if (critical) state = 'MISSING_EVIDENCE';
    return { text, state, critical };
  });
}

export function scoreAnswer(input: {
  question: string;
  answer: string;
  claims: ClaimAssessment[];
  sourceCount?: number;
  calculationVerified?: boolean;
  safetyOk?: boolean;
  requestedFormatMet?: boolean;
}): QualityScorecard {
  const claims = input.claims;
  const critical = claims.filter((claim) => claim.critical);
  const supported = claims.filter((claim) => ['VERIFIED', 'SUPPORTED', 'INFERRED', 'ESTIMATED'].includes(claim.state));
  const supportedCritical = critical.filter((claim) => ['VERIFIED', 'SUPPORTED'].includes(claim.state));
  const hasAnswer = input.answer.trim().length > 0;
  const questionTerms = new Set(input.question.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
  const answerTerms = new Set(input.answer.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
  let overlap = 0;
  for (const term of questionTerms) if (answerTerms.has(term)) overlap += 1;
  const intentMatch = hasAnswer ? Math.min(1, 0.72 + overlap / Math.max(1, questionTerms.size) * 0.28) : 0;
  const evidenceCoverage = claims.length ? supported.length / claims.length : 1;
  const factual = critical.length ? supportedCritical.length / critical.length : evidenceCoverage;
  const numerical = /\d/.test(input.answer) ? (input.calculationVerified ? 1 : 0.72) : 1;
  const sourceCount = Math.max(0, input.sourceCount || 0);
  const citation = sourceCount > 0 ? Math.min(1, 0.82 + Math.min(sourceCount, 4) * 0.045) : 1;
  const completeness = Math.min(1, hasAnswer ? 0.82 + Math.min(0.18, input.answer.length / 4000) : 0);
  const safety = input.safetyOk === false ? 0 : 1;
  const formatting = input.requestedFormatMet === false ? 0.6 : 1;
  const preference = 1;
  const criticalGatePassed = safety === 1 && numerical >= 0.98 && (critical.length === 0 || supportedCritical.length === critical.length);
  return {
    intentMatch,
    numericalCorrectness: numerical,
    factualCorrectness: factual,
    evidenceCoverage,
    citationCorrectness: citation,
    completeness,
    safety,
    formatting,
    preferenceCompliance: preference,
    criticalGatePassed,
  };
}

export function reliabilityStatus(input: {
  calculationVerified?: boolean;
  sourceCount?: number;
  conflictCount?: number;
  missingData?: boolean;
  simulation?: boolean;
  criticalGatePassed?: boolean;
}): string {
  if (input.missingData) return 'Perlu Data';
  if ((input.conflictCount || 0) > 0) return 'Data Konflik';
  if (input.simulation) return 'Simulasi';
  if (input.calculationVerified) return 'Perhitungan Terverifikasi';
  if ((input.sourceCount || 0) > 0 && input.criticalGatePassed !== false) return 'Didukung Sumber';
  return 'Belum Terverifikasi';
}
