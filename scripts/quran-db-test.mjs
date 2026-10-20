import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const quran = JSON.parse(await fs.readFile(path.join(root, 'data', 'quran', 'ayah-index.json'), 'utf-8'));
const topics = JSON.parse(await fs.readFile(path.join(root, 'data', 'quran', 'topic-index.json'), 'utf-8'));
const sabar = topics.find((topic) => topic.id === 'sabar');
const refs = new Set();
for (const ref of sabar.refs) {
  const match = ref.match(/(\d+):(\d+)(?:-(\d+))?/);
  if (!match) continue;
  const surah = Number(match[1]);
  const start = Number(match[2]);
  const end = Number(match[3] || match[2]);
  for (let ayah = start; ayah <= end; ayah++) refs.add(`${surah}:${ayah}`);
}
const rows = quran.filter((ayah) => refs.has(`${ayah.suraId}:${ayah.verseID}`));
const text = rows.map((ayah) => `${ayah.suraId}:${ayah.verseID} ${ayah.ayahText}\nLatin: ${ayah.readText}\nTerjemah: ${ayah.indoText}`).join('\n\n');
const required = ['2:153', '2:155', '39:10', '103:3'];
const missingRefs = required.filter((ref) => !text.includes(ref));
const containsSabaBug = /Surah Saba lengkap|QS 34/.test(text);
const hasSabarTerm = /sabar|bersabar|kesabaran/i.test(text);
const passed = rows.length >= 6 && missingRefs.length === 0 && !containsSabaBug && hasSabarTerm;
console.log({
  test: 'quran-topic-sabar-database-guard',
  rows: rows.length,
  dataSource: 'quran-static.json fallback / optional Laragon MySQL compatible',
  missingRefs,
  containsSabaBug,
  hasSabarTerm,
  passed,
});
if (!passed) process.exit(1);
