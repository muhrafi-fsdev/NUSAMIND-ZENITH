import fs from 'node:fs';import crypto from 'node:crypto';import lock from '../data/runtime/ui-checksum-n1.json' with {type:'json'};
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');const mismatches=[];
for(const [p,expected] of Object.entries(lock.files)){if(!fs.existsSync(p)||hash(p)!==expected)mismatches.push(p);}
console.log(JSON.stringify({ok:mismatches.length===0,release:'N1.0',checked:Object.keys(lock.files).length,mismatches},null,2));if(mismatches.length)process.exit(1);
