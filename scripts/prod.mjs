import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const arch = JSON.parse(await fs.readFile(path.join(root, 'data', 'runtime/prod.json'), 'utf-8'));
console.log(`${arch.name} ${arch.version}`);
console.log('Principles:', arch.principles.join(', '));
console.log('Layers:');
for (const layer of arch.layers) console.log(`- ${layer.name}: ${layer.responsibilities.join('; ')}`);
console.log('Stages:', arch.production_stages.join(' -> '));
