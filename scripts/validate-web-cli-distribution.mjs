import fs from 'node:fs';const required=['package.json','app','cli','run-cli.bat','dev.bat','ml-start.bat','ollama.bat','app/api/n1/status/route.ts'];const missing=required.filter(p=>!fs.existsSync(p));
console.log(JSON.stringify({ok:missing.length===0,release:'N1.0',distribution:['WEB_LOCAL','CLI'],missing},null,2));if(missing.length)process.exit(1);
