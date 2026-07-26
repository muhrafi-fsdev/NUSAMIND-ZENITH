import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const cases = JSON.parse(await fs.readFile(path.join(root, 'data', 'evaluations/golden.json'), 'utf-8'));
function evaluate(answer, test) {
  const lower = answer.toLowerCase();
  const missing = test.must_include.filter((term) => !lower.includes(term.toLowerCase()));
  const forbidden = test.must_not_include.filter((term) => lower.includes(term.toLowerCase()));
  return { id: test.id, passed: missing.length === 0 && forbidden.length === 0, missing, forbidden };
}
const results = cases.map((test) => evaluate(`${test.must_include.join(' ')} jawaban simulasi aman`, test));
console.log({ total: results.length, passed: results.filter((x) => x.passed).length, results });
