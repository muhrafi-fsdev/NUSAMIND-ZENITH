export type ContextLayer = {
  activeEntities: string[];
  decisions: string[];
  openQuestions: string[];
  resolvedQuestions: string[];
  sourceSets: string[];
  summary: string;
  history: Array<{ text: string; timestamp?: string }>;
};

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
}

export function selectContext(query: string, context: ContextLayer, maxHistory = 6) {
  const queryTokens = tokens(query);
  const scored = context.history.map((item) => {
    const itemTokens = tokens(item.text);
    let overlap = 0;
    for (const token of queryTokens) if (itemTokens.has(token)) overlap += 1;
    return { ...item, score: overlap / Math.max(1, queryTokens.size) };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, maxHistory);

  return {
    active: {
      entities: context.activeEntities,
      decisions: context.decisions,
      openQuestions: context.openQuestions,
      sourceSets: context.sourceSets,
    },
    summary: context.summary,
    retrievedHistory: scored,
  };
}
