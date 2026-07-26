import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
async function read(file, fallback) {
  try { return JSON.parse(await fs.readFile(path.join(root, 'data', file), 'utf-8')); }
  catch { return fallback; }
}
const [expansion, playbooks, lexicon, golden, fineTune] = await Promise.all([
  read('knowledge/base.json', []),
  read('playbooks/domains.json', []),
  read('language/core.json', []),
  read('evaluations/golden.json', []),
  read('runtime/finetune.json', {}),
]);
console.log('V12 Knowledge + Tuning Summary');
console.log({
  currentKnowledgeCards: expansion.length,
  domainPlaybooks: playbooks.length,
  languageVariants: lexicon.length,
  goldenTests: golden.length,
  fineTunePrepSamples: fineTune.samples?.length || 0,
  fineTuneExport: 'data/export/instruction_dataset_sample.jsonl',
});
console.log('Fokus V12: current tech/AI knowledge, bahasa santai, playbook debugging, Quran safety, fine-tuning prep, dan hybrid vector-lite index.');
