import fs from 'node:fs';
import path from 'node:path';

const required = [
  'ml-service/app.py',
  'ml-service/nusamind_ml/engine.py',
  'ml-service/smoke.py',
  'lib/ml-client.ts',
  'app/api/ml/route.ts',
  'ml-setup.bat',
  'ml-start.bat',
];
const missing = required.filter((file) => !fs.existsSync(path.resolve(file)));
if (missing.length) {
  console.error(JSON.stringify({ ok: false, missing }, null, 2));
  process.exit(1);
}
const release = fs.readFileSync('lib/release.ts', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');
const route = fs.readFileSync('app/api/chat-json/route.ts', 'utf8');
const checks = {
  release: release.includes("13.43.0") && release.includes("R13.43"),
  env: env.includes('NUSAMIND_ML_ENABLED=true') && env.includes('NUSAMIND_ML_URL=http://127.0.0.1:8000'),
  chatIntegration: route.includes('analyzeTextWithMl') && route.includes('refineIntentWithMl') && route.includes('buildMlContext'),
};
if (Object.values(checks).some((value) => !value)) {
  console.error(JSON.stringify({ ok: false, checks }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, release: 'R13.43', checks }, null, 2));
