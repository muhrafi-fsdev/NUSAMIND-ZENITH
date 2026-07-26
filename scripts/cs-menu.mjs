import fs from 'node:fs';console.table(JSON.parse(fs.readFileSync('data/runtime/cli-menu.json','utf8')));
