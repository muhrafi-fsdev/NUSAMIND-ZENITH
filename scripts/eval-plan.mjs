import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const data = JSON.parse(await fs.readFile(path.join(root, 'data', 'evaluations/checklist.json'), 'utf-8'));
console.log('Evaluation Blueprint');
console.log('- Smoke tests:', (data.smoke_tests || []).join('; '));
console.log('- Metrics:', (data.evaluation_metrics || []).join(', '));
console.log('- Deployment stages:', (data.deployment_stages || []).join(' -> '));
console.log('- Monitoring KPIs:', (data.monitoring_kpis || []).join(', '));
