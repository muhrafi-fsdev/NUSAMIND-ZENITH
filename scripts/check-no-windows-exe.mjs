import fs from 'node:fs'; import path from 'node:path';
const forbidden=['electron','electron-forge','squirrel','forge.config','run-desktop.bat','build-windows.bat','nusamind.exe','setup.exe','pyinstaller'];
const files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.next','.git'].includes(e.name))continue;const p=path.join(d,e.name);e.isDirectory()?walk(p):files.push(p);}};walk('.');
const runtimeFiles=files.filter(f=>!f.includes(`${path.sep}docs${path.sep}`)&&!f.includes(`${path.sep}data${path.sep}release${path.sep}`));
const hits=[];for(const f of runtimeFiles){const name=f.toLowerCase();if(forbidden.some(x=>name.includes(x)))hits.push(f);}
console.log(JSON.stringify({ok:hits.length===0,release:'N1.0',hits},null,2));if(hits.length)process.exit(1);
