import fs from 'node:fs';import manifest from '../data/release/n1/manifest.json' with {type:'json'};
const required=['packages/n1-runtime/index.ts','packages/intelligence-orchestrator/index.ts','packages/reasoning/index.ts','packages/reliability/index.ts','data/release/n1/upgrades.json','data/release/n1/benchmarks.json','app/api/n1/status/route.ts','app/api/n1/evaluate/route.ts'];
const missing=required.filter(p=>!fs.existsSync(p));const ok=manifest.release==='N1.0'&&manifest.version==='1.0.0'&&manifest.scope.windowsExe==='CANCELLED'&&manifest.scope.n8n==='POSTPONED'&&manifest.scope.mainUi==='LOCKED'&&missing.length===0;
console.log(JSON.stringify({ok,release:manifest.release,edition:manifest.edition,upgradeItems:manifest.upgradeItems,missing},null,2));if(!ok)process.exit(1);
