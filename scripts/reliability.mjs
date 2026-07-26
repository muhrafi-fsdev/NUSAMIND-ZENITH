import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'data', 'runtime', 'quality.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log(`${data.name} ${data.label}`);
console.log(`Mode: ${data.mode}`);
console.log(`Shared architecture: ${data.sharedArchitecture.length}`);
console.log(`Edition features: ${data.editionFeatures.length}`);
console.log(`Benchmark required: ${data.releaseGate.benchmark}`);
console.log(`UI touch: ${data.releaseGate.uiTouch ? 'yes' : 'no'}`);
