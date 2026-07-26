import fs from 'node:fs/promises'; import path from 'node:path';
const policy=JSON.parse(await fs.readFile(path.join(process.cwd(),'data/runtime/desktop-config.json'),'utf8'));
const categories={}; for(const item of policy.items||[]) categories[item.category]=(categories[item.category]||0)+1;
console.log({release:policy.release,edition:policy.edition,mode:policy.mode,defaultExecutionEnabled:policy.defaultExecutionEnabled,items:(policy.items||[]).length,categories});
