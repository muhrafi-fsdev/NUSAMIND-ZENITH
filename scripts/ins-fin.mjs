import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync('data/runtime/insurance-finance.json','utf8'));
const formulas=JSON.parse(fs.readFileSync('data/runtime/formula-catalog.json','utf8'));
console.log({ok:true,release:data.release,edition:data.edition,features:data.total,formulas:formulas.length,limits:data.limits});
