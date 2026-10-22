import fs from 'node:fs';
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const taxonomy = json('data/benchmarks/suite-taxonomy.json');
const capability = json('data/runtime/suite-capability-map.json');

const suites = taxonomy.suites.map((suite) => {
  const map = capability.suites.find((x) => x.id === suite.id);
  return {
    id: suite.id,
    count: `${suite.count} ${suite.unit}${suite.count === 1 ? '' : 's'}`,
    zenithStatus: map?.status ?? 'UNKNOWN',
    measured: 'NOT_RUN',
    topGap: map?.gaps?.[0] ?? null,
  };
});
console.log(JSON.stringify({
  ok: true,
  release: 'N1.4.2',
  edition: capability.edition,
  provenance: taxonomy.provenance.verification,
  note: capability.measurement.note,
  suites,
}, null, 2));
