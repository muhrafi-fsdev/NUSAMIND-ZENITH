import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { POST as developer } from '../../app/api/n1/developer/route';
import { POST as autonomy } from '../../app/api/n1/autonomy/route';
import { POST as coding } from '../../app/api/coding/route';
import { registerMcp, inspectMcp } from '../../packages/autonomy-engine/mcp';
import { resolveTrustedTarget } from '../../packages/autonomy-engine/workspace';
import { n1ContractEvaluation } from '../../packages/n1-runtime';
import { validateUrl } from '../../packages/browser-operator';

test('Host localhost does not authorize developer, autonomy or coding plan/job', async () => {
  delete process.env.CODING_AGENT_TOKEN;
  delete process.env.AUTONOMY_AGENT_TOKEN;
  delete process.env.DESKTOP_CONTROL_TOKEN;
  delete process.env.ADMIN_TOKEN;
  for (const [handler, action] of [[developer, 'plan'], [autonomy, 'status'], [coding, 'job']] as const) {
    const res = await handler(new Request('http://localhost:3000/api/test', {
      method: 'POST', headers: { host: 'localhost.evil.test', 'content-type': 'application/json' },
      body: JSON.stringify({ action, jobId: 'does-not-exist' }),
    }));
    assert.equal(res.status, 403, `${action} must be denied before dispatch`);
  }
});

test('quarantined MCP inspection cannot execute even a supplied wrapper', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'nusamind-mcp-'));
  const marker = path.join(home, 'executed');
  try {
    const s = await registerMcp(home, { name: 'hostile-fixture', command: [process.execPath, '-e', `require('fs').writeFileSync(${JSON.stringify(marker)},'bad')`], sandboxCommand: [process.execPath] });
    await assert.rejects(inspectMcp(home, s.id), /QUARANTINED|DISABLED|UNAVAILABLE/);
    await assert.rejects(fs.stat(marker), { code: 'ENOENT' });
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});

test('trusted workspace cannot escape through a symlink or junction', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'nusamind-path-'));
  try {
    const root = path.join(home, 'owner');
    const outside = path.join(home, 'outside');
    await fs.mkdir(root); await fs.mkdir(outside);
    await fs.symlink(outside, path.join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(resolveTrustedTarget(root, path.join(root, 'escape', 'new.txt'), true));
  } finally { await fs.rm(home, { recursive: true, force: true }); }
});

test('benchmarks without execution evidence never pass', () => {
  const result = n1ContractEvaluation();
  assert.equal(result.pass, 0);
  assert.ok(result.results.every(t => t.status === 'NOT_RUN'));
});

test('browser preflight rejects private, mapped and IP literal destinations', () => {
  for (const url of ['http://[::1]', 'http://[::ffff:127.0.0.1]', 'http://[fd00::1]', 'http://127.1', 'http://2130706433', 'http://100.64.0.1', 'http://169.254.169.254', 'http://example.localhost']) {
    assert.equal(validateUrl(url).ok, false, url);
  }
});
