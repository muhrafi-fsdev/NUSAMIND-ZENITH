import path from 'node:path';
import fs from 'node:fs/promises';
import { STORAGE_DIR } from './config';
import { normalizeText, tokenize } from './util';

const INDEX_DIR = path.join(STORAGE_DIR, 'index');
const INDEX_FILE = path.join(INDEX_DIR, 'hybrid-vector-lite-index.json');

export type VectorLiteDoc = {
  id: string;
  title: string;
  category: string;
  text: string;
  source?: string;
  tokens: string[];
  fingerprint: Record<string, number>;
};

function fingerprint(text: string): Record<string, number> {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized).slice(0, 160);
  const map: Record<string, number> = {};
  for (const token of tokens) map[token] = (map[token] || 0) + 1;
  for (let i = 0; i < normalized.length - 2; i += 1) {
    const tri = normalized.slice(i, i + 3);
    if (/^[a-z0-9 ]+$/i.test(tri)) map[`tri:${tri}`] = (map[`tri:${tri}`] || 0) + 0.15;
  }
  return map;
}

export function cosineLite(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0, an = 0, bn = 0;
  for (const [key, value] of Object.entries(a)) {
    an += value * value;
    if (b[key]) dot += value * b[key];
  }
  for (const value of Object.values(b)) bn += value * value;
  if (!an || !bn) return 0;
  return dot / (Math.sqrt(an) * Math.sqrt(bn));
}

export function buildVectorLiteDoc(input: { id: string; title: string; category: string; text: string; source?: string }): VectorLiteDoc {
  const combined = `${input.title}\n${input.category}\n${input.text}`;
  return {
    ...input,
    tokens: tokenize(combined).slice(0, 120),
    fingerprint: fingerprint(combined),
  };
}

export async function saveVectorLiteIndex(docs: VectorLiteDoc[]) {
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify({ version: 'v11-vector-lite', builtAt: new Date().toISOString(), total: docs.length, docs }, null, 2), 'utf-8');
}

export async function loadVectorLiteIndex(): Promise<VectorLiteDoc[]> {
  try {
    const raw = JSON.parse(await fs.readFile(INDEX_FILE, 'utf-8'));
    return Array.isArray(raw.docs) ? raw.docs : [];
  } catch {
    return [];
  }
}

export function searchVectorLite(query: string, docs: VectorLiteDoc[], limit = 8) {
  const q = fingerprint(query);
  return docs
    .map((doc) => ({ ...doc, vectorScore: cosineLite(q, doc.fingerprint) }))
    .filter((doc) => doc.vectorScore > 0)
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, limit);
}
