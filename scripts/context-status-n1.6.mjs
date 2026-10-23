import fs from 'node:fs';

const file = JSON.parse(fs.readFileSync('data/runtime/hardware-profiles.json', 'utf8'));
let budget;
try {
  budget = await import(new URL('../lib/context-budget.ts', import.meta.url).href);
} catch (error) {
  console.error(`lib/context-budget.ts tidak dapat dimuat langsung (butuh Node >= 22.18): ${error.code || error.message}`);
  process.exit(2);
}

const asJson = process.argv.includes('--json');
const pad = (v, n) => String(v).padEnd(n);
const mb = (v) => `${Math.round(v)} MB`;

const profiles = Object.entries(file.profiles).map(([name, p]) => {
  const rows = ['main', 'coder'].map((role) => {
    const tag = p.models[role];
    const ctx = role === 'main' ? p.contextTokens : p.coderContextTokens;
    const est = budget.estimateMemory(file, tag, ctx, p.kvCacheType);
    const limit = p.ramGB * 1000 * budget.RAM_SHARE_FOR_MODEL;
    return { role, model: tag, contextTokens: ctx, kvType: p.kvCacheType, ...est, planningLimitMB: limit, fits: est.totalMB <= limit };
  });
  return { name, label: p.label, ramGB: p.ramGB, default: name === file.default, compactPrompt: p.compactPrompt, thinking: p.thinking, maxOutputTokens: p.maxOutputTokens, rows };
});

const focusTag = file.profiles[file.default].models.main;
const horizon = [4096, 8192, 16384, 32768, 131072, 262144, 1_000_000, 2_000_000].map((tokens) => ({
  tokens,
  f16GiB: budget.kvGiBForTokens(file, focusTag, 'f16', tokens),
  q8GiB: budget.kvGiBForTokens(file, focusTag, 'q8_0', tokens),
  q4GiB: budget.kvGiBForTokens(file, focusTag, 'q4_0', tokens),
}));
const arch = file.architectures[focusTag];
const planningBudgetMB = 2000;
const reach = ['f16', 'q8_0', 'q4_0'].map((kv) => ({ kv, maxContextTokens: budget.maxContextForMemory(file, focusTag, kv, planningBudgetMB) }));

if (asJson) {
  console.log(JSON.stringify({ default: file.default, profiles, focus: { model: focusTag, arch, planningBudgetMB, reach, horizon }, problems: budget.validateProfilesFile(file) }, null, 2));
  process.exit(0);
}

console.log(`NusaMind N1.6 — profil perangkat keras (bawaan: ${file.default}).`);
console.log(`Perkiraan memori = bobot + KV cache + overhead ${file.runtimeOverheadMB} MB (overhead adalah asumsi; ukur dengan "ollama ps").\n`);
console.log(pad('profil', 7), pad('peran', 6), pad('model', 20), pad('konteks', 8), pad('KV', 5), pad('bobot', 9), pad('KV cache', 9), pad('total', 9), pad('batas 60% RAM', 14), 'muat');
for (const p of profiles) {
  for (const r of p.rows) {
    console.log(pad(p.name + (p.default ? '*' : ''), 7), pad(r.role, 6), pad(r.model, 20), pad(r.contextTokens, 8), pad(r.kvType, 5), pad(mb(r.weightsMB), 9), pad(mb(r.kvMB), 9), pad(mb(r.totalMB), 9), pad(mb(r.planningLimitMB), 14), r.fits ? 'ya' : 'TIDAK');
  }
}
console.log(`\nBerapa token yang dapat aktif sekaligus? Model ${focusTag}: ${arch.layers} layer x ${arch.kvHeads} KV head x ${arch.headDim} dim.`);
console.log(`KV cache f16 = ${budget.kvBytesPerToken(arch, 'f16', file)} byte/token; batas posisi model ${arch.maxPositions} token.`);
console.log(`\nKV cache yang dibutuhkan (GiB), BELUM termasuk bobot ${mb(arch.weightsMB)}:`);
console.log(pad('token aktif', 14), pad('f16', 10), pad('q8_0', 10), 'q4_0');
for (const h of horizon) console.log(pad(h.tokens.toLocaleString('id-ID'), 14), pad(h.f16GiB.toFixed(2), 10), pad(h.q8GiB.toFixed(2), 10), h.q4GiB.toFixed(2));
console.log(`\nPada anggaran ${planningBudgetMB} MB untuk model (asumsi mesin 4 GB), konteks maksimum yang muat:`);
for (const r of reach) console.log(`  KV ${pad(r.kv, 5)} -> ${r.maxContextTokens.toLocaleString('id-ID')} token`);
console.log('\nRiwayat percakapan jutaan token tetap dapat disimpan di SQLite dan dicari ulang; yang aktif di model hanya jendela di atas.');
const problems = budget.validateProfilesFile(file);
console.log(problems.length ? `\nMASALAH PROFIL:\n- ${problems.join('\n- ')}` : '\nValidasi profil: tidak ada masalah.');
process.exit(problems.length ? 1 : 0);
