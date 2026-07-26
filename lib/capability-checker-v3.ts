import fs from 'node:fs';
import path from 'node:path';
import { RELEASE } from './release';
import { databaseStatus } from './db';
export type Readiness='AVAILABLE'|'DEGRADED'|'NOT_READY';
function exists(rel:string){return fs.existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(),rel));}
function jsonCount(rel:string){try{const value=JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(),rel),'utf8'));return Array.isArray(value)?value.length:Array.isArray(value?.items)?value.items.length:Object.keys(value||{}).length;}catch{return 0;}}
function status(ok:boolean,degraded:boolean):Readiness{return ok?'AVAILABLE':degraded?'DEGRADED':'NOT_READY';}
export function capabilityReadinessV3(){
  let dbOk=false; try{dbOk=databaseStatus().integrity==='ok';}catch{}
  const model=exists('ml-service/models/intent.joblib')||exists('ml-service/models/intent-model.joblib');
  const healthRecords=jsonCount('data/health/disease-registry.json')+jsonCount('data/health/medicine-registry.json')+jsonCount('data/health/herbal-registry.json');
  let healthCurated=false;try{healthCurated=JSON.parse(fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(),'data/manifests/health-manifest.json'),'utf8')).curated===true;}catch{}
  const retrievalFiles=exists('lib/retrieval-v6.ts')&&exists('lib/evidence-graph-v3.ts');
  const neuralFiles=exists('ml-service/neural_lab/trainer_v2.py')&&exists('ml-service/neural_lab/text_features_v2.py');
  const neuralAllowed=String(RELEASE.edition)!=='swift';
  return {release:RELEASE.label,edition:RELEASE.edition,truthful:true,generatedAt:new Date().toISOString(),capabilities:{
    ml:{status:status(model,exists('ml-service/app.py')),reason:model?'active model and runtime files detected':'runtime tersedia, tetapi model aktif belum diproduksikan'},
    neural:{status:status(neuralAllowed&&neuralFiles,neuralFiles),reason:neuralAllowed?'edition policy allows neural activation':'Swift menggunakan ML ringan tanpa neural production'},
    retrieval:{status:status(retrievalFiles&&dbOk,retrievalFiles),reason:dbOk?'V6 files and SQLite ready':'V6 tersedia; database runtime belum siap'},
    health:{status:status(healthCurated&&healthRecords>=100,healthRecords>0),records:healthRecords,reason:healthCurated?'curated registry threshold met':'seed registry tersedia; perlu kurasi sumber dan benchmark sebelum AVAILABLE'},
    corpus:{status:status(exists('data/manifests/corpus-manifest.json')&&(exists('data/packs/knowledge/pack-manifest.json')||exists('data/core/universal-knowledge.json')),exists('data/core/universal-knowledge.json')),reason:exists('data/packs/knowledge/pack-manifest.json')?'versioned knowledge packs active':'legacy monolith remains read-only until migration command completes'}
  }};
}
