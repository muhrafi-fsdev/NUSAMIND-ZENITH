import fs from 'node:fs/promises';
import path from 'node:path';
import { STORAGE_DIR } from './config';
import { nowIso, safeJson } from './util';

const FEEDBACK_DIR = path.join(STORAGE_DIR, 'feedback');

export type FeedbackPayload = {
  sessionId: string;
  messageId?: string;
  rating: number;
  label: string;
  note?: string;
  mode?: string;
};

async function ensureDir() {
  await fs.mkdir(FEEDBACK_DIR, { recursive: true });
}

function feedbackPath() {
  return path.join(FEEDBACK_DIR, `${nowIso().slice(0, 10)}.json`);
}

export async function appendFeedback(payload: FeedbackPayload) {
  await ensureDir();
  const file = feedbackPath();
  const current = await safeJson<any[]>(file, []);
  const record = { id: `feedback_${Date.now()}`, createdAt: nowIso(), ...payload };
  current.push(record);
  await fs.writeFile(file, JSON.stringify(current.slice(-1000), null, 2), 'utf-8');
  return record;
}

export async function getFeedbackSummary() {
  await ensureDir();
  const files = (await fs.readdir(FEEDBACK_DIR).catch(() => [])).filter((file) => file.endsWith('.json'));
  const labels: Record<string, number> = {};
  let total = 0;
  let ratingSum = 0;
  for (const file of files) {
    const rows = await safeJson<any[]>(path.join(FEEDBACK_DIR, file), []);
    for (const row of rows) {
      total += 1;
      ratingSum += Number(row.rating || 0);
      labels[row.label || 'unknown'] = (labels[row.label || 'unknown'] || 0) + 1;
    }
  }
  return { totalFeedback: total, averageRating: total ? Number((ratingSum / total).toFixed(2)) : null, labels };
}
