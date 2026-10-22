import fs from 'node:fs';
const read = (p) => fs.readFileSync(p, 'utf8');
const engine = read('lib/academic-answer-engine.ts');
const format = read('lib/answer-format.ts');
const calc = read('lib/calc-engine.ts');
const prompts = read('lib/prompts.ts');
const pkg = JSON.parse(read('package.json'));
const profile = JSON.parse(read('data/runtime/answer-quality-profile.json'));
const cases = [
  ['version', /^1\.(?:[3-9]|\d{2,})\.\d+$/.test(pkg.version)],
  ['engine exists', engine.includes('buildAcademicAnswerInstruction')],
  ['math known section', engine.includes('Diketahui')],
  ['formula section', engine.includes('Konsep/Rumus')],
  ['solution section', engine.includes('Penyelesaian')],
  ['final answer section', engine.includes('Jawaban akhir')],
  ['explanation section', engine.includes('Penjelasan singkat')],
  ['coding fenced block policy', engine.includes('fenced code block')],
  ['coding example policy', engine.includes('Contoh input/output')],
  ['coding edge case policy', engine.includes('edge case')],
  ['prompt integration', prompts.includes('buildAcademicAnswerInstruction')],
  ['code preservation', format.includes('isCodingQuestion')],
  ['structured answer guard', format.includes('hasStructuredAcademicAnswer')],
  ['polynomial derivative', calc.includes('polynomialDerivative')],
  ['arithmetic operations', calc.includes('basicArithmetic')],
  ['raw latex off', profile.rawLatexDefault === false],
  ['no dataset style', profile.datasetStyleDefault === false],
  ['ui locked', profile.noUiTouch === true],
];
const failed = cases.filter(([, ok]) => !ok).map(([name]) => name);
const result = { ok: failed.length === 0, release: 'N1.3', edition: profile.edition, passed: cases.length - failed.length, total: cases.length, failed };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
