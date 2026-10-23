import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as nodeModule from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const cases = json('data/benchmarks/context-cases.json');
const pkg = json('package.json');
const out = { release: 'N1.6.0', behavioral: 'SKIPPED', reason: '' };

// Modul lib memakai alias "@/" dan impor tanpa ekstensi (gaya bundler); hook ini hanya untuk pengujian.
if (typeof nodeModule.registerHooks !== 'function') {
  console.log(JSON.stringify({ ok: false, ...out, reason: 'butuh Node >= 22.18 (module.registerHooks)' }, null, 2));
  process.exit(2);
}
const tryExt = (p) => { for (const e of ['', '.ts', '.tsx', '.json', '/index.ts']) { const f = p + e; if (fs.existsSync(f) && fs.statSync(f).isFile()) return f; } return null; };
nodeModule.registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) { const f = tryExt(path.join(ROOT, spec.slice(2))); if (f) return { url: pathToFileURL(f).href, shortCircuit: true }; }
    try { return next(spec, ctx); } catch (e) { if (spec.startsWith('.') && !/\.\w+$/.test(spec)) return next(`${spec}.ts`, ctx); throw e; }
  },
  load(url, ctx, next) {
    if (url.endsWith('.json') && url.startsWith('file:')) return { format: 'module', source: `export default ${fs.readFileSync(fileURLToPath(url), 'utf8')}`, shortCircuit: true };
    return next(url, ctx);
  },
});
const lib = (p, query = '') => import(`${pathToFileURL(path.join(ROOT, 'lib', p)).href}${query}`);

const tests = {};
const notes = {};
const check = (name, ok, detail) => { tests[name] = Boolean(ok); if (!ok && detail !== undefined) notes[name] = detail; };

let budget, compactor, engine, compactPrompt, prompts, intelligence;
try {
  budget = await lib('context-budget.ts');
  compactor = await lib('context-compactor.ts');
  engine = await lib('context-engine.ts');
  compactPrompt = await lib('compact-prompt.ts');
  prompts = await lib('prompts.ts');
  intelligence = await lib('intelligence-level.ts');
} catch (error) {
  console.log(JSON.stringify({ ok: false, ...out, reason: `modul lib tidak dapat dimuat: ${error.code || error.message}` }, null, 2));
  process.exit(2);
}
out.behavioral = 'RAN';

const hw = json('data/runtime/hardware-profiles.json');
const clone = (v) => JSON.parse(JSON.stringify(v));
const P4 = hw.profiles['4gb'];
const P16 = hw.profiles['16gb'];

/* ---------- A. matematika anggaran memori (angka diturunkan dengan tangan, lihat catatan di cases) ---------- */
for (const [tag, expect] of Object.entries(cases.kvBytesPerTokenF16)) {
  check(`A.kvF16.${tag}`, budget.kvBytesPerToken(hw.architectures[tag], 'f16', hw) === expect, budget.kvBytesPerToken(hw.architectures[tag], 'f16', hw));
}
for (const c of cases.kvTypeBytes) check(`A.kvType.${c.model}.${c.kv}`, budget.kvBytesPerToken(hw.architectures[c.model], c.kv, hw) === c.expect);
{
  const m = cases.memory;
  const est = budget.estimateMemory(hw, m.model, m.context, m.kv);
  check('A.memory.4gb-main', est.totalMB >= m.expectTotalMinMB && est.totalMB <= m.expectTotalMaxMB, est.totalMB);
}
for (const c of cases.maxContext) check(`A.maxContext.${c.model}.${c.kv}@${c.budgetMB}`, budget.maxContextForMemory(hw, c.model, c.kv, c.budgetMB) === c.expect, budget.maxContextForMemory(hw, c.model, c.kv, c.budgetMB));
for (const c of cases.kvGiB) check(`A.kvGiB.${c.model}.${c.kv}.${c.tokens}`, Math.abs(budget.kvGiBForTokens(hw, c.model, c.kv, c.tokens) - c.expect) <= c.tolerance, budget.kvGiBForTokens(hw, c.model, c.kv, c.tokens));
check('A.oneMillionTokensDoesNotFit4gb', budget.kvGiBForTokens(hw, P4.models.main, P4.kvCacheType, 1_000_000) * 1024 > P4.ramGB * 1000);

/* ---------- B. validasi profil (mutasi) dan pemilihan profil ---------- */
check('B.shippedProfilesValid', budget.validateProfilesFile(hw).length === 0, budget.validateProfilesFile(hw));
for (const m of cases.profileMutations) {
  const bad = clone(hw);
  let node = bad;
  for (const k of m.path.slice(0, -1)) node = node[k];
  node[m.path[m.path.length - 1]] = m.value;
  const problems = budget.validateProfilesFile(bad);
  check(`B.mutation.${m.id}`, problems.some((p) => p.includes(m.expect)), problems);
}
for (const c of cases.profileSelection) {
  const r = budget.getProfile(hw, c.requested);
  check(`B.select.${JSON.stringify(c.requested)}`, r.name === c.name && Boolean(r.warning) === c.warning, r);
}

/* ---------- C. properti kompaktor ---------- */
const b4 = P4.budgets;
const opt = (extra = {}) => ({ historyBudget: 1500, digestTokens: b4.digestTokens, recallTokens: b4.recallTokens, perMessageMaxChars: b4.perMessageMaxChars, olderMessageMaxChars: b4.olderMessageMaxChars, blockSize: b4.blockSize, minVerbatimMessages: b4.minVerbatimMessages, safety: P4.tokenSafetyFactor, ...extra });
const topics = ['Docker compose untuk aplikasi Node', 'resep nasi goreng', 'tugas kuliah statistika regresi', 'error CORS pada Next.js', 'jadwal olahraga mingguan'];
const convo = [];
for (let i = 0; i < 300; i += 1) {
  const t = topics[i % topics.length];
  convo.push({ role: 'user', content: `Pertanyaan ${i} tentang ${t}. Saya sedang butuh penjelasan yang lengkap mengenai ${t} beserta contohnya, tolong ya.` });
  convo.push({ role: 'assistant', content: `Jawaban ${i}: berikut penjelasan mengenai ${t}. `.repeat(18) });
}
{
  let nonFit = 0; let notUser = 0; let notSuffix = 0; let checked = 0;
  for (const hb of [300, 600, 900, 1500, 3000]) {
    for (let n = 4; n <= 300; n += 7) {
      const input = convo.slice(0, n);
      const r = compactor.compactHistory(input, opt({ historyBudget: hb }));
      checked += 1;
      if (!r.report.fitsBudget) nonFit += 1;
      if (r.messages.length && r.messages[0].role !== 'user') notUser += 1;
      const k = r.messages.length;
      const tail = input.slice(input.length - k);
      const ok = tail.every((m, i) => {
        const cap = input.length - k + i >= input.length - 2 ? b4.perMessageMaxChars : b4.olderMessageMaxChars;
        const got = r.messages[i];
        return got.role === m.role && got.content.length <= cap && m.content.startsWith(got.content.slice(0, 24));
      });
      if (!ok) notSuffix += 1;
    }
  }
  check('C.alwaysFitsBudget', nonFit === 0, { nonFit, checked });
  check('C.firstKeptIsUser', notUser === 0, { notUser, checked });
  check('C.keptIsSuffixWithShortenedContent', notSuffix === 0, { notSuffix, checked });
  const a = compactor.compactHistory(convo, opt({ query: 'docker compose' }));
  const c = compactor.compactHistory(convo, opt({ query: 'docker compose' }));
  check('C.deterministic', JSON.stringify(a) === JSON.stringify(c));
  check('C.noteWithinDigestCap', compactor.tokensOf(a.note, P4.tokenSafetyFactor) <= b4.digestTokens + 8, compactor.tokensOf(a.note, P4.tokenSafetyFactor));
  check('C.evictsWhenOverBudget', a.report.evictedMessages > 0 && a.report.verbatimMessages < convo.length);
  let aligned = 0; let evictedRuns = 0;
  for (const base of [0, 8, 40]) {
    for (let n = 60; n <= 300; n += 11) {
      const r = compactor.compactHistory(convo.slice(0, n), opt({ baseIndex: base }));
      if (r.report.evictedMessages > 0) { evictedRuns += 1; if (r.report.boundaryAbsolute % b4.blockSize === 0) aligned += 1; }
    }
  }
  check('C.blockBoundaryAlignedToAbsoluteIndex', evictedRuns > 0 && aligned === evictedRuns, { aligned, evictedRuns });
  let prev = ''; let changes = 0; let prevNaive = ''; let naiveChanges = 0;
  for (let n = 80; n <= 160; n += 2) {
    const r = compactor.compactHistory(convo.slice(0, n), opt());
    if (r.note !== prev) changes += 1;
    prev = r.note;
    const naive = compactor.compactHistory(convo.slice(0, n), opt({ blockSize: 1 }));
    if (naive.note !== prevNaive) naiveChanges += 1;
    prevNaive = naive.note;
  }
  check('C.prefixStability', naiveChanges > 0 && changes <= naiveChanges * 0.6, { changes, naiveChanges });
}
{
  const token = `ghp_${'a1B2c3D4e5'.repeat(4)}`;
  const msgs = cases.facts.messages.map((m) => m.replace('{{GHP}}', token));
  const f5 = compactor.extractFacts(msgs, 5);
  check('C.facts.limit5', JSON.stringify(f5) === JSON.stringify(cases.facts.limit5), f5);
  const f2 = compactor.extractFacts(msgs, 2);
  check('C.facts.limit2', JSON.stringify(f2) === JSON.stringify(cases.facts.limit2), f2);
  check('C.facts.neverLeakSecret', !JSON.stringify([f5, f2]).includes(token));
}
{
  const corpus = cases.recall.corpus;
  for (const q of cases.recall.queries) {
    const hits = compactor.recallFromCorpus(q.q, corpus, { k: 5 });
    const text = hits.map((h) => h.msg.content.toLowerCase()).join(' | ');
    const okCount = hits.length === q.hits;
    const okAny = !q.mustContainAny || q.mustContainAny.some((w) => text.includes(w));
    const okNot = !q.mustNotContain || q.mustNotContain.every((w) => !text.includes(w));
    check(`C.recall.${q.q || '(kosong)'}`, okCount && okAny && okNot, { hits: hits.length, text });
  }
  const dup = [...cases.recall.corpus, { ...cases.recall.corpus[1] }, { ...cases.recall.corpus[1], content: `${cases.recall.corpus[1].content}.` }];
  const dd = compactor.compactHistory(convo.slice(0, 40), opt({ historyBudget: 500, query: 'ingress kubernetes', archive: dup, baseIndex: dup.length }));
  const occurrences = dd.recallNote.split('proxy-read-timeout').length - 1;
  check('C.recall.dedupesNearDuplicates', occurrences <= 1, occurrences);
}

/* ---------- D. prepareContext (sintetis) ---------- */
const src = (i, n = 3000) => ({ id: `s${i}`, title: `Sumber ${i}`, category: 'k', text: `Isi sumber contoh ${i}. `.repeat(Math.ceil(n / 24)).slice(0, n), source: 'x', tags: [], score: 1 });
const mkBuild = (opts = {}) => ({ sources, memoryItems, compact }) => ({
  system: `SISTEM ${compact ? 'ringkas' : 'penuh'} memori=${memoryItems}${opts.padSystem ? ` ${'x'.repeat(opts.padSystem)}` : ''}${compact ? '' : sources.map((s) => `\n${s.title}: ${s.text}`).join('')}`,
  user: `${opts.userPad ? 'u'.repeat(opts.userPad) : ''}Pertanyaan: ${opts.question || 'apa kabar?'}${compact ? sources.map((s) => `\n[${s.title}] ${s.text}`).join('') : ''}`,
});
const prep = (profile, ctx, { build: buildOpts, ...rest } = {}) => engine.prepareContext({ profile, contextTokens: ctx, requestedMaxOutputTokens: 5200, build: mkBuild(buildOpts), sources: [], history: [], query: 'apa kabar?', ...rest });
const inputBudget4 = P4.contextTokens - P4.reserveOutputTokens;
{
  const s1 = prep(P4, 4096);
  check('D.s1.tinyFits', s1.report.fits && s1.messages.at(-1).role === 'user' && s1.maxOutputTokens <= P4.maxOutputTokens && s1.maxOutputTokens >= 128, s1.report);
  const s2 = prep(P4, 4096, { history: convo, query: 'docker compose' });
  check('D.s2.hugeHistoryFits', s2.report.fits && s2.report.tokens.total <= inputBudget4 && s2.report.history.evictedMessages > 0 && s2.messages[0].role === 'user', s2.report);
  const s3 = prep(P4, 4096, { build: { userPad: 40000 } });
  check('D.s3.hugeUserTruncated', s3.report.userTruncated && s3.report.fits, s3.report);
  const s4 = prep(P4, 4096, { sources: Array.from({ length: 20 }, (_, i) => src(i, 5000)) });
  check('D.s4.sourcesTrimmed', s4.report.sources.used < s4.report.sources.given && s4.report.trimmed.includes('sources') && s4.report.fits, s4.report);
  const s5 = prep(P16, 16384, { build: { padSystem: 90000 }, sources: Array.from({ length: 6 }, (_, i) => src(i)) });
  check('D.s5.oversizeSystemHandled', s5.report.fits && (s5.report.trimmed.includes('system-hardcut') || s5.report.trimmed.includes('compact-prompt')), s5.report);
  const archive = { messages: [{ role: 'user', content: 'Catatan lama: kode proyek adalah flamboyan-biru-77' }], total: 400 };
  const s6 = prep(P4, 4096, { history: convo.slice(0, 20), archive, query: 'flamboyan biru' });
  check('D.s6.recallInUserNotSystem', s6.user.includes('flamboyan-biru-77') && !s6.system.includes('flamboyan-biru-77') && s6.report.history.recallHits >= 1, s6.report.history);
  const s7 = prep(P16, 16384, { history: convo.slice(0, 6) });
  check('D.s7.profile16gbIsLenient', !s7.report.compactPrompt && s7.maxOutputTokens === 5200 && s7.report.history.evictedMessages === 0, { out: s7.maxOutputTokens, compact: s7.report.compactPrompt });
  // Sumber muat di anggaran sumber sendiri (fitSources) tetapi bersama pesan pengguna yang besar melampaui batas tetap: loop pemangkasan harus membuang sumber, bukan memotong pertanyaan.
  const s8 = prep(P4, 4096, { build: { userPad: 9000 }, sources: Array.from({ length: 4 }, (_, i) => src(i, 400)) });
  check('D.s8.loopDropsSourcesBeforeTruncatingUser', s8.report.trimmed.includes('sources') && s8.report.sources.used < s8.report.sources.given && !s8.report.userTruncated && s8.report.fits, s8.report);
  const d1 = prep(P4, 4096, { history: convo.slice(0, 30), query: 'x' });
  const d2 = prep(P4, 4096, { history: convo.slice(0, 30), query: 'x' });
  check('D.deterministicSystem', d1.system === d2.system && JSON.stringify(d1.messages) === JSON.stringify(d2.messages));
  let nonFit = 0; let n = 0;
  for (const ctx of [2048, 3072, 4096]) for (const len of [2, 20, 120, 300]) for (const nsrc of [0, 3, 12]) {
    const p = clone(P4); p.contextTokens = ctx; p.reserveOutputTokens = Math.min(p.reserveOutputTokens, Math.floor(ctx / 4)); p.maxOutputTokens = p.reserveOutputTokens;
    const r = prep(p, ctx, { history: convo.slice(0, len), sources: Array.from({ length: nsrc }, (_, i) => src(i, 4000)) });
    n += 1; if (!r.report.fits) nonFit += 1;
  }
  check('D.fitsAcrossGrid', nonFit === 0, { nonFit, n });
}

/* ---------- E. integrasi nyata: prompt sungguhan, prepareChatContext, appConfig per profil ---------- */
const intent = { mode: 'universal', confidence: 0.7, reasons: [], safety: 'normal' };
const level = intelligence.getIntelligenceProfile('medium');
const hits8 = Array.from({ length: 8 }, (_, i) => ({ ...src(i, 1200), text: `UNIK${i}ZZ ${src(i, 1200).text}` }));
{
  const full = prompts.buildSystemPrompt(intent, hits8, [], level, 'Session ID: s1\nTopik aktif: belum ada', 'general_chat', '');
  const compact = compactPrompt.buildCompactSystemPrompt({ intent, memory: [], memoryItems: 6, intelligenceProfile: level, sessionBlock: 'Session ID: s1\nTopik aktif: belum ada', sessionBlockChars: 700, chatMode: 'general_chat', domainContext: '' });
  const est = (await lib('prompt-engine/token-context.ts')).estimateQwenTokens;
  check('E.compactPromptAtLeast4xSmaller', est(full) >= 4 * est(compact), { full: est(full), compact: est(compact) });
  for (const phrase of cases.compactCoreMustContain) check(`E.compactCore.has.${phrase}`, compactPrompt.COMPACT_CORE.includes(phrase) || compact.includes(phrase));
  check('E.compactSystemHasNoSources', !compact.includes('Isi sumber contoh'));
}
{
  const chat = await lib('chat-context.ts');
  const window = convo.slice(-200).map((m, i) => ({ id: `m${i}`, createdAt: '2026-01-01T00:00:00Z', ...m }));
  window.push({ id: 'cur', createdAt: '2026-01-01T00:00:00Z', role: 'user', content: 'Jelaskan CORS singkat saja.' });
  const base = { sessionId: 'e2e-no-archive', session: { sessionId: 'e2e-no-archive', createdAt: '', updatedAt: '', messages: window, totalMessages: window.length, defaultIntelligenceLevel: 'medium', pinned: false }, userMessage: 'Jelaskan CORS singkat saja.', intent, intelligenceProfile: level, memory: [], sources: hits8, sessionContextBlock: 'Session ID: e2e', chatMode: 'general_chat', domainContext: '', taskType: 'general', strategy: 'direct', requestedMaxOutputTokens: 2000 };
  const prepared = chat.prepareChatContext(base);
  const lastUsers = prepared.messages.filter((m) => m.content.includes('Jelaskan CORS singkat saja.')).length;
  check('E.prepareChat.fits', prepared.report.fits && prepared.report.tokens.total <= inputBudget4, prepared.report);
  check('E.prepareChat.userMessageSentOnce', lastUsers === 1, lastUsers);
  check('E.prepareChat.outputCapped', prepared.maxOutputTokens <= P4.maxOutputTokens, prepared.maxOutputTokens);
  check('E.prepareChat.profileAndHash', prepared.profile === '4gb' && /^[0-9a-f]{8,}$/.test(String(prepared.promptHash)), { profile: prepared.profile, hash: prepared.promptHash });
  check('E.prepareChat.sourcesOnlyOnce', (prepared.system + prepared.messages.map((m) => m.content).join('\n')).split('UNIK0ZZ').length - 1 <= 1);
  chat.recordUsage(prepared, { inputTokens: prepared.rawInputEstimate * 2 });
  check('E.recordUsage.calibratesUp', compactor.getCalibration() > 1, compactor.getCalibration());
  compactor.resetCalibration();
  check('E.recordUsage.ignoresMissing', (chat.recordUsage(prepared, undefined), compactor.getCalibration() === 1));
}
{
  const keys = ['NUSAMIND_HARDWARE_PROFILE', 'OLLAMA_MODEL', 'OLLAMA_CODER_MODEL', 'OLLAMA_FALLBACK_MODEL', 'OLLAMA_THINKING_MODE', 'OLLAMA_NUM_CTX', 'OLLAMA_CODER_NUM_CTX', 'AI_MAX_STEPS', 'AI_MAX_OUTPUT_TOKENS', 'AI_ENABLE_TOOLS'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const c of cases.configProfiles) {
    for (const k of keys) delete process.env[k];
    Object.assign(process.env, c.env);
    const cfg = (await lib('config.ts', `?case=${encodeURIComponent(c.id)}`)).appConfig;
    const actual = { name: cfg.hardware.name, warning: Boolean(cfg.hardware.warning), ollamaModel: cfg.ollamaModel, ollamaCoderModel: cfg.ollamaCoderModel, ollamaFallbackModel: cfg.ollamaFallbackModel, ollamaContextWindow: cfg.ollamaContextWindow, ollamaCoderContextWindow: cfg.ollamaCoderContextWindow, ollamaThinkingMode: cfg.ollamaThinkingMode, maxSteps: cfg.maxSteps, toolsEnabled: cfg.toolsEnabled, maxOutputTokens: cfg.maxOutputTokens };
    const mismatches = Object.entries(c.expect).filter(([k, v]) => actual[k] !== v).map(([k, v]) => `${k}: ${actual[k]} != ${v}`);
    check(`E.config.${c.id}`, mismatches.length === 0, mismatches);
  }
  for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
}

/* ---------- F. SQLite nyata: arsip jutaan token ---------- */
{
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nusamind-n16-'));
  const previous = process.cwd();
  process.chdir(work);
  try {
    const memory = await lib('memory.ts');
    const db = (await lib('db.ts')).getDatabase();
    const repos = await lib('repos.ts');
    const est = (await lib('prompt-engine/token-context.ts')).estimateQwenTokens;
    const sid = 'arsip-besar';
    const total = 6000;
    const NEEDLE = 'kapibaraunik';
    let tokens = 0;
    const insert = db.prepare('INSERT INTO messages(id,session_id,role,content,data_json,created_at) VALUES(?,?,?,?,?,?)');
    db.prepare('INSERT INTO sessions(id,title,state_json,created_at,updated_at) VALUES(?,?,?,?,?)').run(sid, '', '{"messages":[]}', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    db.exec('BEGIN');
    for (let i = 0; i < total; i += 1) {
      const body = `Pesan nomor ${i} tentang ${topics[i % topics.length]}. ${'Penjelasan panjang untuk keperluan uji arsip. '.repeat(20)}${i === 100 ? ` Catatan khusus: proyek ${NEEDLE} harus selesai sebelum Desember.` : ''}${i === 150 ? ' Diskon 50% berlaku, kode PROMO_50%_OFF.' : ''}${i === 151 ? ' Diskon 500 persen tidak masuk akal.' : ''}`;
      tokens += est(body);
      insert.run(`m${String(i).padStart(6, '0')}`, sid, i % 2 ? 'assistant' : 'user', body, '{}', new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString());
    }
    db.exec('COMMIT');
    const count = () => db.prepare('SELECT COUNT(*) n FROM messages WHERE session_id=?').get(sid).n;
    check('F.archiveReachesMillionsOfTokens', tokens >= 1_000_000, tokens);
    notes['F.archiveTokens'] = tokens;

    const t0 = performance.now();
    const win = await memory.loadSession(sid, 200);
    const tWin = performance.now() - t0;
    const t1 = performance.now();
    const all = await memory.loadSession(sid);
    const tAll = performance.now() - t1;
    notes['F.timingMs'] = { window200: Math.round(tWin * 10) / 10, full: Math.round(tAll * 10) / 10 };
    check('F.window.size', win.messages.length === 200 && win.totalMessages === total, { n: win.messages.length, total: win.totalMessages });
    check('F.window.isNewestInOrder', win.messages[0].id === 'm005800' && win.messages.at(-1).id === 'm005999');
    check('F.window.fasterThanFullLoad', tWin < tAll, notes['F.timingMs']);
    check('F.full.stillAvailable', all.messages.length === total);

    const found = memory.recallCandidates(sid, `bagaimana status ${NEEDLE} itu?`, 200);
    check('F.recall.findsOldMessage', found.some((m) => m.content.includes(NEEDLE)), found.length);
    check('F.recall.excludesWindow', found.every((m) => !/Pesan nomor (5[89]\d\d)\b/.test(m.content)));
    check('F.recall.noMatchEmpty', memory.recallCandidates(sid, 'zzzqxv wwwqk', 200).length === 0);

    const sessionRepo = new repos.SessionRepository();
    const pct = sessionRepo.search(sid, ['50%'], 200, 10);
    check('F.search.likeEscaped', pct.length === 1 && pct[0].content.includes('50%') && !pct[0].content.includes('500 persen'), pct.map((m) => m.content.slice(0, 40)));
    const under = sessionRepo.search(sid, ['promo_50'], 200, 10);
    check('F.search.underscoreEscaped', under.length === 1, under.length);
    const inj = sessionRepo.search(sid, ["'; DROP TABLE messages; --", '" OR 1=1 --'], 0, 10);
    check('F.search.injectionInert', inj.length === 0 && count() === total, { hits: inj.length, count: count() });

    await memory.saveSession(win);
    check('F.saveSession.keepsArchive', count() === total, count());
    await memory.updateSessionMeta(sid, { title: 'Judul baru', pinned: true });
    check('F.updateSessionMeta.keepsArchive', count() === total, count());
    const appended = await memory.appendMessage(sid, { role: 'user', content: 'pesan terbaru' });
    check('F.append.returnsWindowedSession', appended.messages.length <= 60 && appended.totalMessages === total + 1 && appended.messages.at(-1).content === 'pesan terbaru', { n: appended.messages.length, total: appended.totalMessages });

    const chat = await lib('chat-context.ts');
    const session = await memory.loadSession(sid, 200);
    const question = `Ingatkan saya, bagaimana kabar proyek ${NEEDLE}?`;
    const prepared = chat.prepareChatContext({ sessionId: sid, session, userMessage: question, intent, intelligenceProfile: level, memory: [], sources: [], sessionContextBlock: 'Session ID: x', chatMode: 'general_chat', domainContext: '', taskType: 'general', strategy: 'direct', requestedMaxOutputTokens: 2000 });
    check('F.e2e.recallsOldFactIntoPrompt', prepared.messages.at(-1).content.includes(NEEDLE) && prepared.report.history.recallHits >= 1, prepared.report.history);
    check('F.e2e.fitsWindow', prepared.report.fits && prepared.report.tokens.total <= inputBudget4, prepared.report.tokens);
    check('F.e2e.activeTokensFarBelowArchive', prepared.report.tokens.total < 4096 && tokens / prepared.report.tokens.total > 300, { active: prepared.report.tokens.total, archive: tokens });

    db.prepare('DELETE FROM sessions WHERE id=?').run(sid);
    check('F.cascade.deleteRemovesMessages', count() === 0, count());
  } finally {
    process.chdir(previous);
    fs.rmSync(work, { recursive: true, force: true });
  }
}

/* ---------- G. struktural ---------- */
{
  check('G.version>=1.6.0', /^1\.(?:[6-9]|\d{2,})\.\d+$/.test(pkg.version), pkg.version);
  const release = read('lib/release.ts');
  check('G.releaseLabel', /label:\s*'N1\.6'/.test(release) && release.includes("'N1.5.1'"));
  check('G.scripts', Boolean(pkg.scripts['context:n16:status']) && Boolean(pkg.scripts['context:n16:benchmark']));
  const manifestPath = 'data/release/n1.6/manifest.json';
  const manifest = fs.existsSync(path.join(ROOT, manifestPath)) ? json(manifestPath) : null;
  check('G.manifest.honest', manifest && manifest.modelRuntimeChanged === true && manifest.answerBehaviorChanged === true && manifest.uiChanged === false && /NOT_RUN/.test(JSON.stringify(manifest.liveSuiteBenchmark)), manifest);
  const chatRoute = read('app/api/chat/route.ts');
  const jsonRoute = read('app/api/chat-json/route.ts');
  check('G.routesUsePreparedContext', chatRoute.includes('prepareChatContext') && jsonRoute.includes('prepareChatContext') && chatRoute.includes('prepared.messages') && jsonRoute.includes('prepared.messages'));
  check('G.routesRecordUsage', chatRoute.includes('recordUsage') && jsonRoute.includes('recordUsage'));
  check('G.routesWindowedLoad', chatRoute.includes('RECENT_WINDOW') && jsonRoute.includes('RECENT_WINDOW'));
  check('G.routesNoLongerSendFullHistory', !chatRoute.includes('getRecentMessagesForPrompt') && !jsonRoute.includes('getRecentMessagesForPrompt'));
  check('G.sessionsApiWindowed', read('app/api/sessions/route.ts').includes('RECENT_WINDOW'));
  check('G.repoDoesNotDeleteArchive', !/DELETE FROM messages WHERE session_id=\? AND id NOT IN/.test(read('lib/repos.ts')));
  const active = read('.env.example').split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => l.split('=')[0].trim());
  const overrides = ['OLLAMA_MODEL', 'OLLAMA_CODER_MODEL', 'OLLAMA_FALLBACK_MODEL', 'OLLAMA_THINKING_MODE', 'OLLAMA_NUM_CTX', 'OLLAMA_CODER_NUM_CTX', 'AI_MAX_STEPS', 'AI_MAX_OUTPUT_TOKENS', 'AI_ENABLE_TOOLS'];
  check('G.envExampleDoesNotOverrideProfile', overrides.every((k) => !active.includes(k)), active.filter((k) => overrides.includes(k)));
  check('G.envExampleSelectsProfile', active.includes('NUSAMIND_HARDWARE_PROFILE') && read('.env.example').includes(`NUSAMIND_HARDWARE_PROFILE=${hw.default}`));
  check('G.envExampleRelease', new RegExp(`NUSAMIND_RELEASE=N?${pkg.version.replace(/\./g, '\\.')}|NUSAMIND_RELEASE=N1\\.6`).test(read('.env.example')));
  const bat = Object.fromEntries([...read('ollama-4gb.bat').matchAll(/^set\s+([A-Z_]+)=(\S+)\s*$/gm)].map((m) => [m[1], m[2]]));
  check('G.batMatchesProfileEnv', JSON.stringify(bat) === JSON.stringify(P4.ollamaServerEnv), bat);
  const pulls = [...read('ollama-4gb.bat').matchAll(/ollama pull (\S+)/g)].map((m) => m[1]).sort();
  check('G.batPullsProfileModels', JSON.stringify(pulls) === JSON.stringify(Object.values(P4.models).sort()), pulls);
  const routing = json('data/runtime/model-routing.json');
  check('G.routingMatchesDefaultProfile', routing.mainModel === P4.models.main && routing.coderModel === P4.models.coder && routing.fallbackModel === P4.models.fallback && routing.thinkingPolicy === P4.thinking && routing.contextWindow === P4.contextTokens && routing.coderContextWindow === P4.coderContextTokens && routing.hardwareProfile === hw.default, routing);
  const readme = read('README.md');
  check('G.readmeMentions4gb', /4\s*GB/.test(readme) && /N1\.6/.test(readme) && !/RAM[^\n]*16\s*GB[^\n]*(minimum|disarankan)/i.test(readme.split('\n').filter((l) => /minimum/i.test(l)).join('\n')), null);
  const docPath = 'docs/compact-context-n1.6.md';
  const doc = fs.existsSync(path.join(ROOT, docPath)) ? read(docPath) : '';
  check('G.docAnswersHowManyTokens', /juta/i.test(doc) && /106[,.]81/.test(doc) && /ollama ps/.test(doc) && /16gb/i.test(doc), null);
  const kPath = 'data/knowledge/context-compaction.json';
  let kOk = false;
  try { const k = json(kPath); const rows = Array.isArray(k) ? k : k.records || k.items || []; kOk = rows.length >= 3 && rows.every((r) => r.id && r.title && r.text); } catch { kOk = false; }
  check('G.knowledgeRecordsValid', kOk);
}

const names = Object.keys(tests);
const failed = names.filter((n) => !tests[n]);
const result = { ...out, version: pkg.version, passed: names.length - failed.length, total: names.length, ok: failed.length === 0, failed, details: Object.fromEntries(Object.entries(notes).filter(([k]) => failed.includes(k) || k.startsWith('F.archive') || k === 'F.timingMs')) };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
