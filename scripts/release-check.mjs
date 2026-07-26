import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const rel=JSON.parse(fs.readFileSync(path.join(root,'data/runtime/release-config.json'),'utf8'));
const profile=JSON.parse(fs.readFileSync(path.join(root,'data/runtime/edition-profile.json'),'utf8'));
const errors=[];
if(pkg.version!==rel.release||profile.release!==rel.release)errors.push('Release version tidak sinkron.');
for(const [key,value] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
  const version=String(value);
  if(version==='latest'||version.startsWith('^')||version.startsWith('~'))errors.push(`Dependency belum pinned: ${key}=${version}`);
}
const conventional=new Set(['package.json','package-lock.json','tsconfig.json']);
const walk=(dir)=>fs.readdirSync(dir,{withFileTypes:true}).flatMap((entry)=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
for(const file of walk(root).filter((item)=>item.endsWith('.json'))){
  const name=path.basename(file);
  const stem=name.slice(0,-5);
  if(!conventional.has(name)){
    if(name.length>19)errors.push(`Nama JSON terlalu panjang: ${path.relative(root,file)}`);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(stem))errors.push(`Nama JSON bukan short-kebab-case: ${path.relative(root,file)}`);
    if(/(?:^|[-_])(?:v|r)?13\d+(?:[-_]|$)/i.test(stem))errors.push(`Versi ditemukan pada nama JSON: ${path.relative(root,file)}`);
  }
  if(fs.statSync(file).size<=5_000_000)JSON.parse(fs.readFileSync(file,'utf8'));
}
const lock=fs.readFileSync(path.join(root,'package-lock.json'),'utf8');
if(/applied-caas-gateway|artifactory/.test(lock))errors.push('Registry internal masih ditemukan.');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('Release check lulus.');
