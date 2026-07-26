export type CacheDependencies = {
  question: string;
  sourceChecksums?: string[];
  corpusVersion?: string;
  formulaVersion?: string;
  promptVersion?: string;
  modelVersion?: string;
  toolVersion?: string;
  permissionScope?: string;
  outputFormat?: string;
};

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

export function evidenceCacheKey(input: CacheDependencies): string {
  const normalized = {
    ...input,
    question: input.question.trim().toLowerCase().replace(/\s+/g, ' '),
    sourceChecksums: [...(input.sourceChecksums || [])].sort(),
  };
  return `rel-${hash(JSON.stringify(normalized))}`;
}

export function cacheInvalidated(previous: CacheDependencies, current: CacheDependencies): boolean {
  return evidenceCacheKey(previous) !== evidenceCacheKey(current);
}
