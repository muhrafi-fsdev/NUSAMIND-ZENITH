import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const data = JSON.parse(await fs.readFile(path.join(root, 'data', 'runtime/blueprint.json'), 'utf-8'));
console.log('Workflow AI Lokal:');
for (const step of data) {
  console.log(`- ${step.title}`);
  console.log(`  Objective: ${step.objective}`);
  console.log(`  Checklist: ${(step.checklist || []).length} item | Outputs: ${(step.outputs || []).length} | Metrics: ${(step.metrics || []).length}`);
}
