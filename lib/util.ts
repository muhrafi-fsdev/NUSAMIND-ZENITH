import crypto from 'node:crypto';

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s:._-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const stop = new Set([
    'yang','dan','di','ke','dari','ini','itu','apa','bagaimana','gimana','cara','untuk','dengan','atau','saya','aku','kamu','nya','ya','dong','tolong','bisa','ga','gak','tidak','adalah','the','a','an','of','to','in','is'
  ]);
  return normalizeText(input)
    .split(' ')
    .filter((token) => token.length > 1 && !stop.has(token))
    .slice(0, 64);
}

export function clampText(input: string, max = 1400): string {
  const clean = input.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

export async function safeJson<T>(path: string, fallback: T): Promise<T> {
  const fs = await import('node:fs/promises');
  try {
    const raw = await fs.readFile(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
