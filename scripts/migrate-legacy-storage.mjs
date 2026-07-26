import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const storage = path.resolve('storage');
const sessionDir = path.join(storage, 'sessions');
const memoryDir = path.join(storage, 'memory');
const backup = path.join(storage, 'legacy-backup-r1338');
fs.mkdirSync(backup, { recursive: true });
const report = { sessions: 0, memory: 0, skipped: 0, errors: [], checksums: {}, at: new Date().toISOString() };
for (const [dir, kind] of [[sessionDir, 'session'], [memoryDir, 'memory']]) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir).filter((item) => item.endsWith('.json'))) {
    const file = path.join(dir, name);
    try {
      const raw = fs.readFileSync(file, 'utf8');
      JSON.parse(raw);
      report.checksums[`${kind}/${name}`] = crypto.createHash('sha256').update(raw).digest('hex');
      fs.copyFileSync(file, path.join(backup, `${kind}-${name}`));
      report[kind === 'session' ? 'sessions' : 'memory'] += 1;
    } catch (error) { report.errors.push(`${kind}/${name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
}
fs.writeFileSync(path.join(storage, 'migration.json'), JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report));
