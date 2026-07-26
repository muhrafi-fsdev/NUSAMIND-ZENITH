import fs from 'node:fs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const depNames=[...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{})];
const runtimeSurfaces=[];
for(const p of ['app/api/n8n','packages/n8n','services/n8n','lib/n8n.ts','n8n.json'])if(fs.existsSync(p))runtimeSurfaces.push(p);
for(const name of depNames)if(/n8n/i.test(name))runtimeSurfaces.push(`dependency:${name}`);
const ok=runtimeSurfaces.length===0;
console.log(JSON.stringify({ok,release:'N1.0',status:'POSTPONED',runtimeSurfaces},null,2));if(!ok)process.exit(1);
