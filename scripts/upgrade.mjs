import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/runtime/upgrade-plan.json','utf8'));
console.log({ok:true,release:data.release,edition:data.edition,total:data.total,noUiTouch:data.noUiTouch,jsonNaming:data.jsonNaming});
