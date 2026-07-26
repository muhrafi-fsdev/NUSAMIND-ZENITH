import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync(new URL('../data/runtime/coding-config.json', import.meta.url), 'utf8'));
console.log(JSON.stringify(config, null, 2));
