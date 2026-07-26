export type FailureFixture = {
  failureId: string;
  edition: string;
  route: string;
  inputRedacted: string;
  category: string;
  actualAnswer?: string;
  expectedBehavior: string;
  toolStatus?: string;
  retrievalIds: string[];
  fixedInVersion?: string;
};

function redact(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/\b(?:\+?62|0)8\d{7,11}\b/g, '[PHONE]')
    .replace(/\b(?:sk|api|token|password)[-_:=\s]+[A-Za-z0-9._-]{8,}\b/gi, '[SECRET]');
}

export function makeFailureFixture(input: Omit<FailureFixture, 'inputRedacted' | 'failureId'> & { input: string }): FailureFixture {
  const seed = `${input.edition}|${input.route}|${input.category}|${input.input}`;
  let hash = 0;
  for (const char of seed) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) | 0;
  return {
    failureId: `REL-${Math.abs(hash).toString(36).toUpperCase()}`,
    edition: input.edition,
    route: input.route,
    inputRedacted: redact(input.input),
    category: input.category,
    actualAnswer: input.actualAnswer ? redact(input.actualAnswer) : undefined,
    expectedBehavior: input.expectedBehavior,
    toolStatus: input.toolStatus,
    retrievalIds: input.retrievalIds,
    fixedInVersion: input.fixedInVersion,
  };
}
