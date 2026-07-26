import fs from 'node:fs/promises'; import path from 'node:path';
const root=process.cwd(); const profile=JSON.parse(await fs.readFile(path.join(root,'data/runtime/edition-profile.json'),'utf8'));
console.log({release:profile.releaseLabel,edition:profile.editionName,globalCounts:profile.globalCounts,upgradeItems:profile.upgradeItems,topCategoryCount:profile.topCategoryCount,desktopControl:profile.desktopControl,namingConvention:profile.namingConvention});
