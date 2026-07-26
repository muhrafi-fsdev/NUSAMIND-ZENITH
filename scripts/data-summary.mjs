import fs from 'node:fs/promises'; import path from 'node:path';
const d=path.join(process.cwd(),'data'); const read=async p=>{try{return JSON.parse(await fs.readFile(path.join(d,p),'utf8'));}catch{return [];}};
const [profile,desktop,top,language,golden]=await Promise.all([read('runtime/profile.json'),read('runtime/desktop.json'),read('benchmarks/cats.json'),read('language/core.json'),read('evaluations/golden.json')]);
console.log({release:profile.releaseLabel,edition:profile.editionName,globalCounts:profile.globalCounts,desktopCapabilities:(desktop.items||[]).length,topCategories:(top||[]).length,languageVariants:Array.isArray(language)?language.length:0,goldenCases:Array.isArray(golden)?golden.length:0});
