import fs from 'node:fs';
const menu=JSON.parse(fs.readFileSync(new URL('../data/runtime/cli-menu.json',import.meta.url),'utf8'));
console.log(`${menu.title} ${menu.label}`);
for(const item of menu.items) console.log(`${item.order}. ${item.label} — ${item.behavior}`);
