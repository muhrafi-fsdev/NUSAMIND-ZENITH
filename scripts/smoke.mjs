import fs from 'node:fs';
const profile=JSON.parse(fs.readFileSync(new URL('../data/runtime/edition-profile.json',import.meta.url),'utf8'));
const upgrade=JSON.parse(fs.readFileSync(new URL('../data/runtime/upgrade-plan.json',import.meta.url),'utf8'));
const finance=JSON.parse(fs.readFileSync(new URL('../data/runtime/insurance-finance.json',import.meta.url),'utf8'));
const religion=JSON.parse(fs.readFileSync(new URL('../data/runtime/religion-runtime.json',import.meta.url),'utf8'));
const menu=JSON.parse(fs.readFileSync(new URL('../data/runtime/cli-menu.json',import.meta.url),'utf8'));
const tests=[
  profile.release==='13.38.0',
  profile.releaseLabel==='R13.38',
  Array.isArray(profile.topCategories)&&profile.topCategories.length===profile.topCategoryCount,
  profile.topCategories.every(x=>Number(x.score)>Number(x.previous)),
  Array.isArray(upgrade.features)&&upgrade.features.length===upgrade.total,
  Array.isArray(finance.features)&&finance.features.length===finance.total,
  menu.some(x=>x.id==='insurance_finance'),
  menu.some(x=>x.id==='insurance_finance_claim'),
  menu.some(x=>x.id==='insurance_finance_premium'),
  religion.policies.lookupOnlyBlocker===true,
  religion.modes.includes('quran_comparative'),
  religion.features.some(x=>x.id==='SHARED-1337-001')
];
if(tests.every(Boolean))console.log('Smoke evaluation R13.38 lulus.');
else{console.error({tests,release:profile.release,top:profile.topCategories?.length,total:profile.topCategoryCount,upgrade:upgrade.features?.length,finance:finance.features?.length});process.exit(1);}
