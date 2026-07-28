import fs from 'node:fs';
const edition = process.env.NUSAMIND_EDITION || 'swift';
const profile = JSON.parse(fs.readFileSync('data/runtime/answer-quality-profile.json', 'utf8'));
console.log(JSON.stringify({ ok: true, release: 'N1.3', edition, profile }, null, 2));
