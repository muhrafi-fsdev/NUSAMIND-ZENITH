import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync('data/runtime/model-routing.json','utf8'));
const live=process.argv.includes('--live');
const result={release:'N1.4',edition:config.edition,configured:true,config,live:{requested:live,ok:false,models:[]}};
if(live){try{const base=(process.env.OLLAMA_BASE_URL||'http://localhost:11434/api').replace(/\/api\/?$/,'');const response=await fetch(`${base}/api/tags`,{signal:AbortSignal.timeout(2500)});if(response.ok){const payload=await response.json();result.live.ok=true;result.live.models=(payload.models||[]).map((x)=>x.name);}}catch{result.live.ok=false;}}
console.log(JSON.stringify(result,null,2));
if(live&&!result.live.ok)process.exitCode=2;
