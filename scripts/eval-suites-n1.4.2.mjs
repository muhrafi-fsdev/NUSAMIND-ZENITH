import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const json = (p) => JSON.parse(read(p));

const pkg = json('package.json');
const taxonomy = json('data/benchmarks/suite-taxonomy.json');
const method = json('data/benchmarks/scoring-method.json');
const capability = json('data/runtime/suite-capability-map.json');
const knowledge = json('data/knowledge/benchmark-suites.json');

const expected = { agentic: 18, reasoning: 202, coding: 29, 'browser-use': 25, 'data-analysis': 150, research: 22, design: 25 };
const ids = Object.keys(expected);
const byId = Object.fromEntries(taxonomy.suites.map((s) => [s.id, s]));
const statusValues = Object.keys(capability.statusValues);

const fullySplit = taxonomy.suites.filter((s) => s.subcategories.every((x) => Number.isInteger(x.count)));
const partlySplit = taxonomy.suites.filter((s) => !fullySplit.includes(s));

const checks = {
  version: (([a, b, c]) => a === 1 && (b > 4 || (b === 4 && c >= 2)))(pkg.version.split('.').map(Number)),
  sevenSuites: taxonomy.suites.length === 7 && ids.every((id) => byId[id]),
  suiteCounts: ids.every((id) => byId[id]?.count === expected[id]),
  subcategoryCountsSum: fullySplit.every((s) => s.subcategories.reduce((sum, x) => sum + x.count, 0) === s.count),
  unknownSplitsDeclared: partlySplit.every((s) => Boolean(s.subcategoryCountNote)) && partlySplit.length === 2,
  provenanceUnverified: taxonomy.provenance.verification === 'UNVERIFIED' && method.provenance.verification === 'UNVERIFIED',
  unmeasuredScoresZero: method.unmeasuredTask.scoredAs === 0 && method.unmeasuredTask.excludedFromMean === false,
  equalWeightSuites: JSON.stringify([...method.subcategoryScore.equalWeightMeanOfSubcategories].sort()) === JSON.stringify(['data-analysis', 'reasoning']),
  browserUseNeedsVision: byId['browser-use']?.requiresVision === true,
  capabilityCoversSuites: ids.every((id) => capability.suites.some((s) => s.id === id)) && capability.suites.length === 7,
  capabilityStatusValid: capability.suites.every((s) => statusValues.includes(s.status)),
  capabilityEvidenceAndGaps: capability.suites.every((s) => s.evidence.length > 0 && s.gaps.length > 0),
  noScoreClaimed: capability.measurement.liveBenchmark === 'NOT_RUN' && capability.measurement.scoreClaimed === null,
  knowledgeRecordShape: Array.isArray(knowledge) && knowledge.every((r) => r.id && r.title && r.category && r.text.length > 10 && Array.isArray(r.tags) && r.source),
  knowledgeIdsUnique: new Set(knowledge.map((r) => r.id)).size === knowledge.length,
  knowledgeCoversSuites: ids.every((id) => knowledge.some((r) => r.id === `n142_suite_${id.replace('-', '_')}`)),
  knowledgeFlagsProvenance: knowledge.filter((r) => r.id !== 'n142_zenith_capability_honesty').every((r) => /unverified/i.test(r.source)),
  releaseManifest: fs.existsSync('data/release/n1.4.2/manifest.json') && json('data/release/n1.4.2/manifest.json').uiChanged === false,
};

let behavioral = { status: 'SKIPPED', reason: '' };
try {
  const s = await import(new URL('../lib/suite-scoring.ts', import.meta.url).href);
  const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;
  const results = {
    unmeasuredCountsAsZero: near(s.suiteScore([100, null, 50, 0]), 37.5),
    emptySuiteIsNull: s.suiteScore([]) === null,
    equalWeightSkipsUnscored: near(s.equalWeightMean([80, null, 40]), 60),
    overallSkipsBlankAndNa: near(s.overallScore({ a: 50, b: null, c: 'n/a', d: 0 }), 25),
    overallZeroCounts: near(s.overallScore({ a: 0, b: 100 }), 50),
    costPerTaskIsPooled: near(s.costPerTask([{ cost: 10, tasks: 5 }, { cost: 2, tasks: 15 }]), 0.6),
    costPerSuccessfulTask: near(s.costPerSuccessfulTask(0.6, 30), 2),
    zeroScoreCostUndefined: s.costPerSuccessfulTask(0.6, 0) === null,
  };
  behavioral = { status: Object.values(results).every(Boolean) ? 'PASS' : 'FAIL', results };
} catch (error) {
  behavioral.reason = `lib/suite-scoring.ts tidak dapat dimuat langsung (butuh Node >= 22.18 untuk type stripping): ${error.code || error.message}`;
}

const passed = Object.values(checks).filter(Boolean).length;
const total = Object.keys(checks).length;
const ok = passed === total && behavioral.status !== 'FAIL';
const result = {
  release: 'N1.4.2',
  edition: 'zenith',
  passed,
  total,
  ok,
  failed: Object.entries(checks).filter(([, v]) => !v).map(([k]) => k),
  behavioral,
  liveSuiteBenchmark: 'NOT_RUN',
  checks,
};
console.log(JSON.stringify(result, null, 2));
if (!ok) process.exit(1);
