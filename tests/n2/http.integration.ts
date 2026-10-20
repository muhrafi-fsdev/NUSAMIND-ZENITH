import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { terminateProcessTree } from '../../lib/process-control';
const port = 32174, base = `http://127.0.0.1:${port}`, token = randomBytes(32).toString('hex');
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
test('production HTTP: auth boundary and retained deterministic product flows', { timeout: 90_000 }, async t => {
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '-p', String(port)], {
    windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ADMIN_TOKEN: token, CODING_AGENT_TOKEN: '', AUTONOMY_AGENT_TOKEN: '', NUSAMIND_EDITION: 'zenith', NUSAMIND_APP_ORIGIN: base, NUSAMIND_ML_ENABLED: 'false', OLLAMA_BASE_URL: 'http://127.0.0.1:1/api', QURAN_DB_ENABLED: 'false', QURAN_SOURCE: 'static' },
  });
  let log = '';
  child.stdout.on('data', d => { log = (log + d).slice(-3000); });
  child.stderr.on('data', d => { log = (log + d).slice(-3000); });
  try {
    let ready = false;
    for (let n = 0; n < 60; n++) {
      try { if ((await fetch(base + '/api/n1/status', { headers, signal: AbortSignal.timeout(1500) })).ok) { ready = true; break; } } catch { /* Wait for the owned fixture server. */ }
      await new Promise(r => setTimeout(r, 300));
    }
    assert.ok(ready, log);
    await t.test('all private and mutating APIs reject forged localhost Host', async () => {
      for (const route of ['/api/coding', '/api/n1/developer', '/api/n1/autonomy', '/api/desktop', '/api/memory', '/api/sessions', '/api/upload/analyze', '/api/code/index', '/api/admin/reindex', '/api/v3/migrate']) {
        const res = await fetch(base + route, { method: 'POST', headers: { host: 'localhost', 'content-type': 'application/json', 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware' }, body: '{}' });
        assert.equal(res.status, 401, route);
      }
      for (const route of ['/', '/dashboard', '/api/sessions', '/api/upload/artifacts', '/api/security/events']) assert.equal((await fetch(base + route)).status, 401, route);
    });
    await t.test('valid credentials cannot bypass configured Origin', async () => {
      const res = await fetch(base + '/api/n1/developer', { method: 'POST', headers: { ...headers, origin: 'http://evil.test' }, body: '{}' });
      assert.equal(res.status, 401);
    });
    await t.test('authenticated browser entry and developer plan remain available', async () => {
      const page = await fetch(base, { headers: { authorization: `Basic ${Buffer.from(`nusamind:${token}`).toString('base64')}` } });
      assert.equal(page.status, 200); assert.match(await page.text(), /Zenith/);
      const response = await fetch(base + '/api/n1/developer', { method: 'POST', headers, body: JSON.stringify({ action: 'plan', mode: 'PLAN', request: 'Inspect fixture' }) });
      assert.equal(response.status, 200); assert.equal((await response.json()).plan.writeAllowed, false);
    });
    await t.test('unscoped legacy build and deployment fail closed', async () => {
      for (const [route, action] of [['/api/coding', 'build'], ['/api/n1/autonomy', 'deployment-run'], ['/api/n1/autonomy', 'mcp-inspect']]) {
        assert.equal((await fetch(base + route, { method: 'POST', headers, body: JSON.stringify({ action, confirmed: true, approved: true }) })).status, 423);
      }
    });
    await t.test('evaluation API reports unexecuted benchmarks honestly', async () => {
      const result = await (await fetch(base + '/api/n1/evaluate', { headers })).json();
      assert.equal(result.pass, 0); assert.equal(result.status, 'NOT_RUN'); assert.equal(result.notRun, result.total);
    });
    await t.test('Quran exact lookup still returns canonical source data', async () => {
      const response = await fetch(base + '/api/quran/exact', { headers });
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.ok, true); assert.match(result.answer, /Fatihah/i); assert.ok(result.sources.length > 0);
    });
    await t.test('chat JSON retains the deterministic calculation path', async () => {
      const response = await fetch(base + '/api/chat-json', { method: 'POST', headers, body: JSON.stringify({ message: 'hitung 12 + 8', sessionId: 'n2-http-fixture', mode: 'auto' }) });
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.ok, true); assert.match(result.answer, /20/);
    });
    await t.test('CSV upload still produces real parsed evidence', async () => {
      const form = new FormData(); form.append('file', new Blob(['item,total\na,2\nb,3\n'], { type: 'text/csv' }), 'n2-fixture.csv'); form.append('privateMode', 'true');
      const response = await fetch(base + '/api/upload/analyze', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
      assert.equal(response.status, 200); const result = await response.json();
      assert.equal(result.ok, true); assert.match(result.promptContext, /total/);
    });
  } finally { await terminateProcessTree(child); }
});
