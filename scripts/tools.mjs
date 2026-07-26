import fs from 'node:fs';console.log(JSON.parse(fs.readFileSync('data/runtime/tool-registry.json','utf8')));
