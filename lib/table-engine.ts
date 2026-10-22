export type TableFormat = 'csv' | 'tsv' | 'json' | 'jsonl' | 'markdown' | 'html';
type Cell = string | number | boolean | null;
type Table = { headers: string[]; rows: Cell[][]; typed: boolean };
type Parsed = { format: TableFormat; table: Table };

export type TableAnswer = {
  handled: true;
  answer: string;
  formulaId: string;
  domain: string;
  status: 'verified' | 'simulation' | 'needs_input';
  confidence: {
    input: 'complete' | 'partial';
    formula: 'matched' | 'ambiguous';
    verification: 'matched' | 'not_run';
  };
  values?: Record<string, number | string>;
};

const FORMAT_LABEL: Record<TableFormat, string> = { csv: 'CSV', tsv: 'TSV', json: 'JSON', jsonl: 'JSONL', markdown: 'Markdown', html: 'HTML' };

/* ---------- parsing ---------- */

function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (quoted) return [];
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function fromDelimited(text: string, hint?: TableFormat): Parsed | null {
  const candidates: Array<[string, TableFormat]> = hint === 'tsv'
    ? [['\t', 'tsv']]
    : hint === 'csv'
      ? [[',', 'csv'], [';', 'csv']]
      : [['\t', 'tsv'], [',', 'csv'], [';', 'csv']];
  let best: { rows: string[][]; format: TableFormat } | null = null;
  for (const [delimiter, format] of candidates) {
    const rows = parseDelimited(text, delimiter);
    if (rows.length < 2 || rows[0].length < 2) continue;
    if (!rows.every((r) => r.length === rows[0].length)) continue;
    if (!best || rows[0].length > best.rows[0].length) best = { rows, format };
  }
  if (!best) return null;
  const [headers, ...rows] = best.rows;
  return { format: best.format, table: { headers: headers.map((h) => h.trim()), rows, typed: false } };
}

function splitMarkdownRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  const body = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\\' && body[i + 1] === '|') { cell += '|'; i += 1; }
    else if (body[i] === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += body[i];
  }
  cells.push(cell.trim());
  return cells;
}

function fromMarkdown(text: string): Parsed | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 3 || !lines[0].includes('|')) return null;
  const separator = splitMarkdownRow(lines[1]);
  if (!separator.every((c) => /^:?-{1,}:?$/.test(c))) return null;
  const headers = splitMarkdownRow(lines[0]);
  const rows = lines.slice(2).map(splitMarkdownRow);
  if (headers.length < 2 || !rows.every((r) => r.length === headers.length)) return null;
  return { format: 'markdown', table: { headers, rows, typed: false } };
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function codePointText(value: number, original: string) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : original;
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d{1,8});/g, (m, n) => codePointText(Number(n), m))
    .replace(/&#x([0-9a-f]{1,8});/gi, (m, n) => codePointText(parseInt(n, 16), m))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function fromHtml(text: string): Parsed | null {
  const table = /<table[\s>][\s\S]*?<\/table>/i.exec(text)?.[0];
  if (!table) return null;
  const rowMatches = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const grid = rowMatches.map((m) => ({
    hasTh: /<th[\s>]/i.test(m[1]),
    cells: [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((c) => decodeEntities(c[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim()),
  }));
  if (grid.length < 2 || !grid[0].hasTh) return null;
  const headers = grid[0].cells;
  const rows = grid.slice(1).map((r) => r.cells);
  if (headers.length < 2 || !rows.every((r) => r.length === headers.length)) return null;
  return { format: 'html', table: { headers, rows, typed: false } };
}

function objectsToTable(objects: unknown[]): Table | null {
  if (!objects.length || !objects.every((o) => o !== null && typeof o === 'object' && !Array.isArray(o))) return null;
  const headers: string[] = [];
  for (const o of objects as Record<string, unknown>[]) for (const key of Object.keys(o)) if (!headers.includes(key)) headers.push(key);
  const rows: Cell[][] = [];
  for (const o of objects as Record<string, unknown>[]) {
    const row: Cell[] = [];
    for (const key of headers) {
      const value = key in o ? o[key] : null;
      if (value !== null && typeof value === 'object') return null;
      row.push(value as Cell);
    }
    rows.push(row);
  }
  return headers.length >= 2 ? { headers, rows, typed: true } : null;
}

function fromJson(text: string): Parsed | null {
  try {
    const value = JSON.parse(text);
    if (!Array.isArray(value)) return null;
    const table = objectsToTable(value);
    return table ? { format: 'json', table } : null;
  } catch { return null; }
}

function fromJsonl(text: string): Parsed | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => l.startsWith('{'))) return null;
  try {
    const table = objectsToTable(lines.map((l) => JSON.parse(l)));
    return table ? { format: 'jsonl', table } : null;
  } catch { return null; }
}

function parseTable(text: string, hint?: TableFormat): Parsed | null {
  const body = text.replace(/^﻿/, '').trim();
  if (!body) return null;
  let parsed: Parsed | null = null;
  if (hint === 'html' || /<table[\s>]/i.test(body)) parsed = fromHtml(body);
  else if (hint === 'json' || body.startsWith('[')) parsed = fromJson(body);
  else if (hint === 'jsonl' || body.startsWith('{')) parsed = fromJsonl(body);
  else if (hint === 'markdown' || /^\s*\|/.test(body)) parsed = fromMarkdown(body) ?? (hint === 'markdown' ? null : fromDelimited(body, hint));
  else parsed = fromDelimited(body, hint);
  if (!parsed) return null;
  const names = parsed.table.headers;
  if (names.some((h) => h === '') || new Set(names.map((h) => h.toLowerCase())).size !== names.length) return null;
  return parsed;
}

/* ---------- serialization ---------- */

const isExactNumber = (value: string) => {
  const n = Number(value);
  return value !== '' && /^-?\d/.test(value) && Number.isFinite(n) && String(n) === value;
};

/** Kolom teks menjadi angka JSON hanya bila SEMUA selnya angka persis; selain itu seluruh kolom tetap teks. */
function numericColumns(t: Table): boolean[] {
  if (t.typed) return t.headers.map(() => false);
  return t.headers.map((_, i) => t.rows.every((r) => typeof r[i] === 'string' && isExactNumber(r[i] as string)));
}

const cellText = (value: Cell) => (value === null ? '' : String(value));

function toCsv(t: Table) {
  const quote = (v: Cell) => { const s = cellText(v); return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [t.headers, ...t.rows].map((r) => r.map(quote).join(',')).join('\n');
}
function toTsv(t: Table) {
  return [t.headers, ...t.rows].map((r) => r.map((v) => cellText(v).replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');
}
function toObjects(t: Table) {
  const numeric = numericColumns(t);
  return t.rows.map((r) => Object.fromEntries(t.headers.map((h, i) => [h, numeric[i] ? Number(r[i]) : r[i]])));
}
function toMarkdown(t: Table) {
  const esc = (v: Cell) => cellText(v).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(t.headers.map(esc)), line(t.headers.map(() => '---')), ...t.rows.map((r) => line(r.map(esc)))].join('\n');
}
function toHtml(t: Table) {
  const esc = (v: Cell) => cellText(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const row = (tag: string, cells: Cell[]) => `    <tr>${cells.map((c) => `<${tag}>${esc(c)}</${tag}>`).join('')}</tr>`;
  return ['<table>', '  <thead>', row('th', t.headers), '  </thead>', '  <tbody>', ...t.rows.map((r) => row('td', r)), '  </tbody>', '</table>'].join('\n');
}

function serialize(t: Table, format: TableFormat): string {
  switch (format) {
    case 'csv': return toCsv(t);
    case 'tsv': return toTsv(t);
    case 'json': return JSON.stringify(toObjects(t), null, 2);
    case 'jsonl': return toObjects(t).map((o) => JSON.stringify(o)).join('\n');
    case 'markdown': return toMarkdown(t);
    case 'html': return toHtml(t);
  }
}

/* ---------- question splitting ---------- */

const FORMAT_WORDS: Array<[RegExp, TableFormat]> = [
  [/^(?:json\s*lines|jsonl|ndjson)$/, 'jsonl'],
  [/^json$/, 'json'],
  [/^csv$/, 'csv'],
  [/^tsv$/, 'tsv'],
  [/^(?:markdown|md)(?:\s+table)?$/, 'markdown'],
  [/^(?:html)(?:\s+table)?$/, 'html'],
];

function formatFromWord(word: string): TableFormat | null {
  const w = word.trim().toLowerCase();
  for (const [pattern, format] of FORMAT_WORDS) if (pattern.test(w)) return format;
  return null;
}

type Block = { hint?: TableFormat; text: string };

function extractBlocks(question: string): { instruction: string; blocks: Block[] } {
  const blocks: Block[] = [];
  const fenced = /```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g;
  const instruction = question.replace(fenced, (_, lang: string, body: string) => {
    blocks.push({ hint: formatFromWord(lang) ?? undefined, text: body });
    return '\n';
  });
  if (blocks.length) return { instruction, blocks };

  const htmlTables = [...question.matchAll(/<table[\s>][\s\S]*?<\/table>/gi)];
  if (htmlTables.length) {
    return {
      instruction: question.replace(/<table[\s>][\s\S]*?<\/table>/gi, '\n'),
      blocks: htmlTables.map((m) => ({ hint: 'html' as const, text: m[0] })),
    };
  }

  const lines = question.split(/\r?\n/);
  const maxPreamble = Math.min(lines.length - 1, 12);
  for (let i = 0; i <= maxPreamble; i += 1) {
    const rest = lines.slice(i).join('\n');
    const groups = rest.split(/\r?\n[ \t]*\r?\n/).filter((g) => g.trim());
    if (groups.length >= 2 && groups.slice(0, 2).every((g) => parseTable(g))) {
      return { instruction: lines.slice(0, i).join('\n'), blocks: groups.map((g) => ({ text: g })) };
    }
    if (parseTable(rest)) return { instruction: lines.slice(0, i).join('\n'), blocks: [{ text: rest }] };
  }
  return { instruction: question, blocks: [] };
}

function fence(text: string, lang: string) {
  let marks = '```';
  while (text.includes(marks)) marks += '`';
  return `${marks}${lang}\n${text}\n${marks}`;
}

const result = (answer: string, formulaId: string, extra: Partial<TableAnswer> = {}): TableAnswer => ({
  handled: true,
  answer,
  formulaId,
  domain: 'table',
  status: 'verified',
  confidence: { input: 'complete', formula: 'matched', verification: 'matched' },
  ...extra,
});

/* ---------- 1. reformat ---------- */

const CONVERT_VERB = /\b(konversi|konversikan|ubah|ubahlah|convert|transform|reformat|format ulang|jadikan|tulis ulang|ganti format)\b/i;
const OTHER_TASK = /\b(filter|saring|urutkan|sort|hapus|delete|tambah(?:kan)?|add|hitung|jumlah(?:kan)?|rata-rata|group|kelompokkan|hanya|only|where|drop|rename|ganti nama|gabung|merge|join|ringkas|summari[sz]e|jelaskan|explain)\b/i;
const TARGET_PATTERN = /(?<!\b(?:dari|from)\s+)\b(?:ke|to|into|menjadi|jadi|as|dalam format|format)\s+(?:bentuk\s+|format\s+|tabel\s+)?(json\s*lines|jsonl|ndjson|json|csv|tsv|markdown(?:\s+table)?|md|html(?:\s+table)?)\b/gi;

function detectTarget(instruction: string): TableFormat | null {
  let target: TableFormat | null = null;
  for (const m of instruction.matchAll(TARGET_PATTERN)) target = formatFromWord(m[1]) ?? target;
  return target;
}

function tryReformat(instruction: string, blocks: Block[]): TableAnswer | null {
  if (blocks.length !== 1 || !CONVERT_VERB.test(instruction) || OTHER_TASK.test(instruction)) return null;
  const target = detectTarget(instruction);
  if (!target) return null;
  const parsed = parseTable(blocks[0].text, blocks[0].hint);
  if (!parsed || parsed.format === target) return null;
  // Kunci objek berbentuk angka diurutkan ulang oleh JavaScript sehingga urutan kolom tidak bisa dijamin.
  if ((target === 'json' || target === 'jsonl') && parsed.table.headers.some((h) => /^\d+$/.test(h))) return null;
  const output = serialize(parsed.table, target);
  const numeric = (target === 'json' || target === 'jsonl') && numericColumns(parsed.table).some(Boolean);
  const head = `Konversi ${FORMAT_LABEL[parsed.format]} → ${FORMAT_LABEL[target]}: ${parsed.table.rows.length} baris, ${parsed.table.headers.length} kolom.`;
  const note = numeric ? '\nKolom yang seluruh nilainya angka persis (tanpa nol di depan atau desimal berlebih) ditulis sebagai angka; kolom lain tetap teks.' : '';
  return result(`${head}${note}\n\n${fence(output, target === 'markdown' ? 'markdown' : target)}`, `table-reformat-${parsed.format}-${target}`, {
    values: { rows: parsed.table.rows.length, columns: parsed.table.headers.length },
  });
}

/* ---------- dates and numbers ---------- */

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agus: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12,
};

type RawDate = { kind: 'ymd'; y: number; m: number; d: number } | { kind: 'slash'; a: number; b: number; y: number };

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const validYmd = (y: number, m: number, d: number) => y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

function parseRawDate(input: string): RawDate | null {
  const t = input.trim().replace(/(?:[T\s])\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?$/i, '').trim();
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t))) return validYmd(+m[1], +m[2], +m[3]) ? { kind: 'ymd', y: +m[1], m: +m[2], d: +m[3] } : null;
  if ((m = /^(\d{4})[-/.](\d{1,2})$/.exec(t))) return validYmd(+m[1], +m[2], 1) ? { kind: 'ymd', y: +m[1], m: +m[2], d: 1 } : null;
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(t))) return { kind: 'slash', a: +m[1], b: +m[2], y: m[3].length === 2 ? 2000 + +m[3] : +m[3] };
  if ((m = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]+)\.?,?[\s-]+(\d{4})$/i.exec(t))) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo && validYmd(+m[3], mo, +m[1]) ? { kind: 'ymd', y: +m[3], m: mo, d: +m[1] } : null;
  }
  if ((m = /^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(t))) {
    const mo = MONTHS[m[1].toLowerCase()];
    return mo && validYmd(+m[3], mo, +m[2]) ? { kind: 'ymd', y: +m[3], m: mo, d: +m[2] } : null;
  }
  if ((m = /^([a-z]+)\.?[\s-]+(\d{4})$/i.exec(t))) {
    const mo = MONTHS[m[1].toLowerCase()];
    return mo ? { kind: 'ymd', y: +m[2], m: mo, d: 1 } : null;
  }
  if ((m = /^(\d{4})$/.exec(t))) return validYmd(+m[1], 1, 1) ? { kind: 'ymd', y: +m[1], m: 1, d: 1 } : null;
  return null;
}

/** Mengembalikan ordinal tanggal per sel, atau null bila kolom bukan tanggal / urutan dd-mm vs mm-dd bertentangan. */
function resolveDates(values: string[]): { ordinals: number[]; assumedDayFirst: boolean } | null {
  const raw = values.map(parseRawDate);
  if (raw.some((r) => r === null)) return null;
  const slash = raw.filter((r): r is Extract<RawDate, { kind: 'slash' }> => r!.kind === 'slash');
  const dayFirstProof = slash.some((r) => r.a > 12);
  const monthFirstProof = slash.some((r) => r.b > 12);
  if (dayFirstProof && monthFirstProof) return null;
  const dayFirst = !monthFirstProof;
  const assumedDayFirst = slash.length > 0 && !dayFirstProof && !monthFirstProof;
  const ordinals: number[] = [];
  for (const r of raw as RawDate[]) {
    const [y, m, d] = r.kind === 'ymd' ? [r.y, r.m, r.d] : dayFirst ? [r.y, r.b, r.a] : [r.y, r.a, r.b];
    if (!validYmd(y, m, d)) return null;
    ordinals.push(y * 10000 + m * 100 + d);
  }
  return { ordinals, assumedDayFirst };
}

function parseNumber(input: string): number | null {
  const t = input.trim().replace(/^(?:rp\.?|idr|usd|[$€£¥])\s*/i, '').replace(/\s*%$/, '');
  if (/^-?\d+(?:\.\d+)?$/.test(t)) return Number(t);
  if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return null;
}

/* ---------- 2. consecutive growth ---------- */

const NUMBER_WORDS: Record<string, number> = { dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 };

function requestedRun(question: string): number | null {
  const q = question.toLowerCase();
  const near = /(?:minimal|paling sedikit|at least|setidaknya)?\s*(\d+|dua|tiga|empat|lima|enam|tujuh|two|three|four|five|six|seven)\s*(?:kali|periode|period|periods|tahun|years?|bulan|months?|kuartal|quarters?|minggu|weeks?|hari|days?)?\s*(?:secara\s+)?(?:berturut|beruntun|consecutive|berurutan|in a row)/.exec(q);
  const reversed = /(?:berturut-turut|beruntun|consecutive)[^.\n]{0,25}?(\d+|dua|tiga|empat|lima|enam|tujuh|two|three|four|five|six|seven)\b/.exec(q);
  const token = near?.[1] ?? reversed?.[1];
  if (!token) return null;
  const n = /^\d+$/.test(token) ? Number(token) : NUMBER_WORDS[token];
  return n && n >= 1 && n <= 50 ? n : null;
}

function tryGrowth(instruction: string, blocks: Block[]): TableAnswer | null {
  if (blocks.length !== 1) return null;
  if (!/(pertumbuhan|tumbuh|naik|meningkat|growth|grow|increas)/i.test(instruction) || !/(berturut|beruntun|consecutive|berurutan|in a row)/i.test(instruction)) return null;
  const parsed = parseTable(blocks[0].text, blocks[0].hint);
  if (!parsed || parsed.table.rows.length < 3) return null;
  const { headers, rows } = parsed.table;
  const col = (i: number) => rows.map((r) => cellText(r[i]).trim());
  const info = headers.map((h, i) => {
    const values = col(i);
    const dates = values.every((v) => v !== '') ? resolveDates(values) : null;
    const numbers = values.map(parseNumber);
    return { h, i, dates, numeric: numbers.every((n) => n !== null) ? (numbers as number[]) : null };
  });
  let dateCols = info.filter((c) => c.dates);
  if (dateCols.length > 1) {
    const real = dateCols.filter((c) => !col(c.i).every((v) => /^\d{4}$/.test(v)));
    const named = dateCols.filter((c) => /(date|tanggal|tgl|periode|period|tahun|year|bulan|month|waktu|time)/i.test(c.h));
    dateCols = real.length === 1 ? real : named.length === 1 ? named : [];
  }
  if (dateCols.length !== 1) return null;
  const dateCol = dateCols[0];
  const numericCols = info.filter((c) => c !== dateCol && c.numeric);
  const mentioned = numericCols.filter((c) => instruction.toLowerCase().includes(c.h.toLowerCase()));
  const valueCol = numericCols.length === 1 ? numericCols[0] : mentioned.length === 1 ? mentioned[0] : null;
  const entityCols = info.filter((c) => c !== dateCol && c !== valueCol && !c.numeric);
  if (!valueCol || entityCols.length !== 1) return null;
  const entityCol = entityCols[0];

  const groups = new Map<string, { label: string; points: Array<{ date: number; value: number }> }>();
  rows.forEach((r, idx) => {
    const label = cellText(r[entityCol.i]).trim();
    const key = label.toLowerCase();
    if (!groups.has(key)) groups.set(key, { label, points: [] });
    groups.get(key)!.points.push({ date: dateCol.dates!.ordinals[idx], value: valueCol.numeric![idx] });
  });
  for (const g of groups.values()) {
    g.points.sort((a, b) => a.date - b.date);
    if (g.points.some((p, i) => i > 0 && p.date === g.points[i - 1].date)) return null;
  }

  const requested = requestedRun(instruction);
  const threshold = requested ?? 2;
  const stats = [...groups.values()].map((g) => {
    let best = 0;
    let run = 0;
    g.points.forEach((p, i) => {
      run = i > 0 && p.value > g.points[i - 1].value ? run + 1 : 0;
      best = Math.max(best, run);
    });
    return { label: g.label, longest: best, points: g.points.length };
  });
  const meets = (n: number) => stats.filter((s) => s.longest >= n).map((s) => s.label);
  const list = (names: string[]) => (names.length ? names.join(', ') : '(tidak ada)');

  const lines = [
    `Kolom terdeteksi: entitas = ${entityCol.h}, tanggal = ${dateCol.h}, nilai = ${valueCol.h}.`,
    'Data diurutkan menurut tanggal per entitas. Satu pertumbuhan = nilai lebih besar dari catatan sebelumnya; nilai yang sama atau turun memutus runtutan.',
    '',
    `| ${entityCol.h} | Runtutan kenaikan terpanjang | Titik data dalam runtutan |`,
    '| --- | --- | --- |',
    ...stats.map((s) => `| ${s.label} | ${s.longest} | ${s.longest ? s.longest + 1 : 0} |`),
    '',
    `Jawaban akhir (≥ ${threshold} kenaikan berturut-turut${requested ? '' : ', ambang bawaan karena jumlah tidak disebut'}): ${list(meets(threshold))}`,
  ];
  if (threshold > 1) lines.push(`Jika yang dimaksud ${threshold} titik data berurutan (setara ${threshold - 1} kenaikan): ${list(meets(threshold - 1))}`);
  if (dateCol.dates!.assumedDayFirst) lines.push('Catatan: tanggal bergaya a/b/tahun yang ambigu dibaca sebagai hari/bulan/tahun.');
  return result(lines.join('\n'), 'table-consecutive-growth', {
    confidence: { input: 'complete', formula: requested && !dateCol.dates!.assumedDayFirst ? 'matched' : 'ambiguous', verification: 'matched' },
    values: { threshold, entities: stats.length },
  });
}

/* ---------- 3. column mapping ---------- */

type ColumnKind = 'number' | 'date' | 'text';

function describeColumn(values: Cell[]) {
  const text = values.map((v) => cellText(v).trim());
  const nonEmpty = text.filter((v) => v !== '');
  if (!nonEmpty.length) return null;
  const numbers = nonEmpty.map(parseNumber);
  let kind: ColumnKind = 'text';
  let keys: string[] = nonEmpty.map((v) => v.toLowerCase());
  if (numbers.every((n) => n !== null)) { kind = 'number'; keys = (numbers as number[]).map(String); }
  else if (resolveDates(nonEmpty)) { kind = 'date'; keys = resolveDates(nonEmpty)!.ordinals.map(String); }
  return { kind, set: new Set(keys) };
}

const normalizeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function tryMapping(instruction: string, blocks: Block[]): TableAnswer | null {
  if (blocks.length < 2 || !/(petakan|pemetaan|map|mapping|cocokkan|padankan|match)/i.test(instruction) || !/(kolom|column)/i.test(instruction)) return null;
  const first = parseTable(blocks[0].text, blocks[0].hint);
  const second = parseTable(blocks[1].text, blocks[1].hint);
  if (!first || !second || first.table.headers.length > second.table.headers.length) return null;
  const a = first.table;
  const b = second.table;
  const da = a.headers.map((_, i) => describeColumn(a.rows.map((r) => r[i])));
  const db = b.headers.map((_, i) => describeColumn(b.rows.map((r) => r[i])));
  if (da.some((d) => !d) || db.some((d) => !d)) return null;

  const scores = a.headers.map((ha, i) => b.headers.map((hb, j) => {
    const x = da[i]!; const y = db[j]!;
    if (x.kind !== y.kind) return 0;
    const shared = [...x.set].filter((v) => y.set.has(v)).length;
    const union = x.set.size + y.set.size - shared;
    return (union ? shared / union : 0) + (normalizeName(ha) === normalizeName(hb) ? 0.3 : 0);
  }));

  const pairs = scores.flatMap((row, i) => row.map((score, j) => ({ i, j, score }))).sort((p, q) => q.score - p.score);
  const usedA = new Set<number>(); const usedB = new Set<number>();
  const mapping = new Map<number, { j: number; score: number }>();
  for (const p of pairs) {
    if (p.score < 0.34 || usedA.has(p.i) || usedB.has(p.j)) continue;
    mapping.set(p.i, { j: p.j, score: p.score });
    usedA.add(p.i); usedB.add(p.j);
  }
  if (mapping.size !== a.headers.length) return null;
  for (const [i, m] of mapping) {
    const rivals = scores[i].filter((_, j) => j !== m.j);
    const ranked = [...scores.map((row) => row[m.j])].filter((_, k) => k !== i);
    if (Math.max(0, ...rivals) > m.score - 0.1 || Math.max(0, ...ranked) > m.score - 0.1) return null;
  }

  const lines = [
    'Pemetaan kolom tabel pertama → tabel kedua, berdasarkan kemiripan himpunan nilai (Jaccard) dan jenis data, bukan nama kolom:',
    ...a.headers.map((h, i) => `- ${h} → ${b.headers[mapping.get(i)!.j]} (kemiripan nilai ${Math.round(Math.min(1, mapping.get(i)!.score) * 100)}%)`),
  ];
  const left = b.headers.filter((_, j) => !usedB.has(j));
  if (left.length) lines.push(`Kolom tabel kedua tanpa pasangan: ${left.join(', ')}`);
  return result(lines.join('\n'), 'table-column-mapping', {
    status: 'simulation',
    confidence: { input: 'complete', formula: 'ambiguous', verification: 'not_run' },
    values: { columns: a.headers.length },
  });
}

/* ---------- entry point ---------- */

/** Berjalan pada setiap pesan chat: kegagalan apa pun berarti "bukan urusan handler ini", bukan error rute. */
export function tryBuildTableAnswer(question: string): TableAnswer | null {
  if (!question || question.length > 200_000 || !/\r?\n/.test(question)) return null;
  try {
    const { instruction, blocks } = extractBlocks(question);
    if (!blocks.length) return null;
    return tryMapping(instruction, blocks) ?? tryGrowth(instruction, blocks) ?? tryReformat(instruction, blocks);
  } catch {
    return null;
  }
}
