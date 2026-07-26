import fs from 'node:fs';
const runtime=JSON.parse(fs.readFileSync('data/runtime/religion-runtime.json','utf8'));
const profile=JSON.parse(fs.readFileSync('data/runtime/edition-profile.json','utf8'));
const required=['religion_quran','quran_lookup_theme','quran_contextual_tafsir','quran_comparative','quran_arabic','quran_qiraat','religion_hadith','quran_asbab_history','religion_fiqh','religion_theology','religion_academic','religion_artifact','religion_evidence_view','religion_human_handoff','religion_security'];
const missing=required.filter(x=>!runtime.modes.includes(x));
const failures=[];
if(runtime.release!=='13.38.0')failures.push('release');
if(missing.length)failures.push(`modes:${missing.join(',')}`);
if(runtime.sharedItems!==22)failures.push('sharedItems');
if(!runtime.features.some(x=>x.id==='SHARED-1337-001'))failures.push('intent-hotfix');
if(!runtime.policies.lookupOnlyBlocker)failures.push('lookup-only-blocker');
if(profile.topCategories.some(x=>Number(x.score)<=Number(x.previous)))failures.push('category-not-raised');
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1)}
console.log(JSON.stringify({ok:true,release:runtime.release,edition:runtime.edition,modes:runtime.modes.length,features:runtime.features.length,topCategories:profile.topCategoryCount},null,2));
