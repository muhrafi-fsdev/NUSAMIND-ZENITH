import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const prep = JSON.parse(await fs.readFile(path.join(root, 'data', 'runtime/finetune.json'), 'utf-8'));
const jsonlPath = path.join(root, 'data', 'export', 'instruction_dataset_sample.jsonl');
let jsonlCount = 0;
try {
  const raw = await fs.readFile(jsonlPath, 'utf-8');
  jsonlCount = raw.trim() ? raw.trim().split('\n').length : 0;
} catch {}
console.log('Fine-tuning Prep V12');
console.log({
  version: prep.version,
  purpose: prep.purpose,
  recommendedBaseModels: prep.recommendedBaseModels,
  schema: prep.schema,
  curatedSamples: prep.samples?.length || 0,
  exportedJsonlSamples: jsonlCount,
  jsonlPath: 'data/export/instruction_dataset_sample.jsonl',
});
console.log('Catatan: file JSONL ini adalah persiapan LoRA/QLoRA. Review manual tetap wajib, terutama untuk data agama.');
