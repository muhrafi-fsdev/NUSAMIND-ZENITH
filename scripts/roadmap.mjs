import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../data/runtime/release-roadmap.json',import.meta.url),'utf8'));
console.log(`${data.name} ${data.release}`);console.log(`Roadmap items: ${data.items.length}`);for(const x of data.items)console.log(`- [${x.sourceTarget}] ${x.feature}`);
