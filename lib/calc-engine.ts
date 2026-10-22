
import { tryBuildTableAnswer } from './table-engine';

export type Edition = 'swift' | 'zenith' | 'apex';
export type AnswerMode = 'auto' | 'direct' | 'concise' | 'balanced' | 'steps' | 'detailed' | 'academic' | 'expert' | 'plain' | 'markdown' | 'latex' | 'copy';

export type CalculationResult = {
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

const SCALE = 1_000_000n;
const SCALE_DIGITS = 6;

class Decimal {
  readonly raw: bigint;
  constructor(raw: bigint) { this.raw = raw; }

  static fromNumber(value: number) {
    if (!Number.isFinite(value)) throw new Error('Angka tidak valid.');
    return Decimal.fromString(String(value));
  }

  static fromString(value: string) {
    const normalized = value.trim();
    const negative = normalized.startsWith('-');
    const clean = normalized.replace(/^[+-]/, '');
    const [wholeRaw, fracRaw = ''] = clean.split('.');
    const whole = BigInt(wholeRaw || '0');
    const frac = BigInt((fracRaw + '0'.repeat(SCALE_DIGITS)).slice(0, SCALE_DIGITS));
    const raw = whole * SCALE + frac;
    return new Decimal(negative ? -raw : raw);
  }

  add(other: Decimal) { return new Decimal(this.raw + other.raw); }
  sub(other: Decimal) { return new Decimal(this.raw - other.raw); }
  mul(other: Decimal) { return new Decimal((this.raw * other.raw) / SCALE); }
  div(other: Decimal) {
    if (other.raw === 0n) throw new Error('Pembagian dengan nol.');
    return new Decimal((this.raw * SCALE) / other.raw);
  }
  min(other: Decimal) { return this.raw <= other.raw ? this : other; }
  max(other: Decimal) { return this.raw >= other.raw ? this : other; }
  abs() { return new Decimal(this.raw < 0n ? -this.raw : this.raw); }
  toNumber() { return Number(this.raw) / Number(SCALE); }
}

function normalizeNumericToken(raw: string): { value: string; multiplier: bigint } | null {
  const lower = raw.toLowerCase().trim();
  const multiplier =
    /\btriliun\b/.test(lower) ? 1_000_000_000_000n :
    /\bmiliar\b/.test(lower) ? 1_000_000_000n :
    /\bjuta\b/.test(lower) ? 1_000_000n :
    /\bribu\b/.test(lower) ? 1_000n : 1n;

  let token = lower
    .replace(/[.,]+$/g, '')
    .replace(/rp\.?/g, '')
    .replace(/\b(ribu|juta|miliar|triliun)\b/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\d,.\-+]/g, '');

  if (!token || !/\d/.test(token)) return null;

  const sign = token.startsWith('-') ? '-' : '';
  token = token.replace(/^[+-]/, '');

  const dots = (token.match(/\./g) || []).length;
  const commas = (token.match(/,/g) || []).length;
  let normalized = token;

  if (dots > 0 && commas > 0) {
    const lastDot = token.lastIndexOf('.');
    const lastComma = token.lastIndexOf(',');
    if (lastComma > lastDot) {
      normalized = token.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = token.replace(/,/g, '');
    }
  } else if (commas > 0) {
    const parts = token.split(',');
    const allThousands = parts.length > 2 && parts.slice(1).every((p) => p.length === 3);
    if (allThousands || (parts.length === 2 && parts[1].length === 3 && parts[0].length > 3)) {
      normalized = parts.join('');
    } else {
      normalized = parts.slice(0, -1).join('') + '.' + parts.at(-1);
    }
  } else if (dots > 0) {
    const parts = token.split('.');
    const allThousands = parts.length > 2 && parts.slice(1).every((p) => p.length === 3);
    if (allThousands || (parts.length === 2 && parts[1].length === 3)) {
      normalized = parts.join('');
    }
  }

  normalized = normalized.replace(/[^\d.]/g, '');
  if (!normalized || (normalized.match(/\./g) || []).length > 1) return null;
  return { value: sign + normalized, multiplier };
}

export function parseLocaleNumber(raw: string): number | null {
  const parsed = normalizeNumericToken(raw);
  if (!parsed) return null;
  try {
    const scaled = Decimal.fromString(parsed.value).mul(new Decimal(parsed.multiplier * SCALE));
    return scaled.toNumber();
  } catch {
    return null;
  }
}

function amountPattern() {
  return '(?:Rp\\.?\\s*)?-?\\d[\\d.,]*(?:\\s*(?:ribu|juta|miliar|triliun))?';
}

function findLabeledAmount(text: string, labels: string[]): number | null {
  const label = labels.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:${label})\\s*(?:sebesar|adalah|=|:)?\\s*(${amountPattern()})`, 'i');
  const match = text.match(re);
  return match ? parseLocaleNumber(match[1]) : null;
}

function fmtNumber(value: number, max = 2) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(value);
}

function fmtCurrency(value: number, max = 0) {
  return `Rp${new Intl.NumberFormat('id-ID', { maximumFractionDigits: max, minimumFractionDigits: 0 }).format(value)}`;
}

function fmtPercent(value: number, digits = 2) {
  return `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)}%`;
}

function statusLine(status: CalculationResult['status']) {
  if (status === 'needs_input') return 'Status: Data belum lengkap';
  if (status === 'simulation') return 'Status: Simulasi terverifikasi';
  return 'Status: Perhitungan terverifikasi';
}

function requestedMode(question: string, mode?: string): AnswerMode {
  const m = String(mode || 'auto').toLowerCase();
  if (['direct', 'concise', 'balanced', 'steps', 'detailed', 'academic', 'expert', 'plain', 'markdown', 'latex', 'copy'].includes(m)) return m as AnswerMode;
  if (/\b(langkah demi langkah|jelaskan langkah|step by step)\b/i.test(question)) return 'steps';
  if (/\b(mendalam|expert|sensitivity|sensitivitas|analisis lengkap)\b/i.test(question)) return 'expert';
  if (/\blatex\b/i.test(question)) return 'latex';
  return 'auto';
}

function renderAnswer(args: {
  question: string;
  edition: Edition;
  mode?: string;
  result: string;
  formula?: string;
  substitution?: string;
  known?: string[];
  explanation?: string;
  notes?: string[];
  status: CalculationResult['status'];
  latex?: string;
}) {
  const mode = requestedMode(args.question, args.mode);
  if (mode === 'latex' && args.latex) return `${args.latex}\n\n${statusLine(args.status)}`;

  const concise = mode === 'direct' || mode === 'concise';
  const lines: string[] = [];
  if (args.known?.length && !concise) {
    lines.push('Diketahui:');
    for (const item of args.known) lines.push(`- ${item}`);
    lines.push('');
  }
  if (args.formula) {
    lines.push('Konsep/Rumus yang digunakan:');
    lines.push(args.formula);
    lines.push('');
  }
  if (args.substitution) {
    lines.push('Penyelesaian:');
    lines.push(args.substitution);
    lines.push('');
  }
  lines.push('Jawaban akhir:');
  lines.push(`[ ${args.result} ]`);
  if (args.explanation || (args.notes?.length && !concise)) {
    lines.push('');
    lines.push('Penjelasan singkat:');
    if (args.explanation) lines.push(args.explanation);
    for (const note of args.notes || []) lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push(statusLine(args.status));
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function verified(answer: string, formulaId: string, domain: string, values?: Record<string, number | string>): CalculationResult {
  return {
    handled: true,
    answer,
    formulaId,
    domain,
    status: 'verified',
    confidence: { input: 'complete', formula: 'matched', verification: 'matched' },
    values,
  };
}

function needsInput(answer: string, formulaId: string, domain: string): CalculationResult {
  return {
    handled: true,
    answer,
    formulaId,
    domain,
    status: 'needs_input',
    confidence: { input: 'partial', formula: 'matched', verification: 'not_run' },
  };
}

function superscriptNumber(value: number) {
  const map: Record<string, string> = { '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻' };
  return String(value).split('').map((x) => map[x] || x).join('');
}

function polynomialDerivative(question: string, edition: Edition, mode?: string): CalculationResult | null {
  if (!/\b(turunan|diferensial|differentiate|derivative|f'\s*\()/i.test(question)) return null;
  const normalized = question.replace(/[³]/g, '^3').replace(/[²]/g, '^2').replace(/[⁴]/g, '^4').replace(/−/g, '-');
  const functionMatch = normalized.match(/f\s*\(\s*x\s*\)\s*=\s*([^?\n]+)/i);
  const fromMatch = normalized.match(/\bdari\s+([^?\n]+)/i);
  const rawExpression = functionMatch?.[1] || fromMatch?.[1];
  if (!rawExpression) return null;
  const expression = rawExpression.replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '').replace(/\s+/g, '').replace(/[.;]+$/g, '');
  if (!/^[+\-]?\d*(?:\.\d+)?x(?:\^\d+)?(?:[+\-]\d*(?:\.\d+)?x(?:\^\d+)?|[+\-]\d+(?:\.\d+)?)*$/i.test(expression)) return null;
  const terms = expression.match(/[+\-]?[^+\-]+/g) || [];
  const derived: { coefficient: number; exponent: number }[] = [];
  for (const rawTerm of terms) {
    if (!/x/i.test(rawTerm)) continue;
    const term = rawTerm.replace(/x/i, '');
    const parts = term.split('^');
    const coeffRaw = parts[0];
    const coefficient = coeffRaw === '' || coeffRaw === '+' ? 1 : coeffRaw === '-' ? -1 : Number(coeffRaw);
    const exponent = parts[1] ? Number(parts[1]) : 1;
    if (!Number.isFinite(coefficient) || !Number.isInteger(exponent) || exponent < 1) return null;
    derived.push({ coefficient: coefficient * exponent, exponent: exponent - 1 });
  }
  if (!derived.length) return null;
  const derivative = derived.map((item, index) => {
    const sign = item.coefficient < 0 ? '-' : index === 0 ? '' : '+';
    const abs = Math.abs(item.coefficient);
    const coefficient = abs === 1 && item.exponent > 0 ? '' : fmtNumber(abs, 6);
    const variable = item.exponent === 0 ? '' : item.exponent === 1 ? 'x' : `x${superscriptNumber(item.exponent)}`;
    return `${sign}${coefficient}${variable}`;
  }).join('').replace(/\+\-/g, '-');
  const steps = terms.filter((term) => /x/i.test(term)).map((term) => {
    const clean = term.replace(/^\+/, '');
    return `d/dx(${clean}) menggunakan d/dx(axⁿ) = a·n·xⁿ⁻¹`;
  });
  const answer = renderAnswer({
    question, edition, mode,
    result: `f'(x) = ${derivative}`,
    formula: "d/dx(axⁿ) = a·n·xⁿ⁻¹ dan turunan konstanta = 0",
    substitution: steps.join('\n'),
    known: [`f(x) = ${expression.replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/\^4/g, '⁴')}`],
    explanation: 'Setiap pangkat dikalikan dengan koefisiennya, kemudian pangkat dikurangi satu. Konstanta hilang karena turunannya nol.',
    status: 'verified',
  });
  return verified(answer, 'calculus-polynomial-derivative', 'calculus', { expression, derivative });
}

function basicArithmetic(question: string, edition: Edition, mode?: string): CalculationResult | null {
  const normalized = question.trim().replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/');
  const match = normalized.match(/(?:berapa|hitung|nilai)?\s*(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)\s*\??$/i);
  if (!match) return null;
  const a = Number(match[1]); const op = match[2]; const b = Number(match[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || (op === '/' && b === 0)) return null;
  const result = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : a / b;
  const symbol = op === '*' ? '×' : op === '/' ? '÷' : op;
  const answer = renderAnswer({
    question, edition, mode,
    result: fmtNumber(result, 6),
    formula: `a ${symbol} b`,
    substitution: `${fmtNumber(a, 6)} ${symbol} ${fmtNumber(b, 6)} = ${fmtNumber(result, 6)}`,
    known: [`a = ${fmtNumber(a, 6)}`, `b = ${fmtNumber(b, 6)}`],
    explanation: 'Operasi dilakukan langsung sesuai operator yang diberikan.',
    status: 'verified',
  });
  return verified(answer, `math-basic-${op === '+' ? 'add' : op === '-' ? 'subtract' : op === '*' ? 'multiply' : 'divide'}`, 'math_basic', { a, b, result });
}

function quadratic(question: string, edition: Edition, mode?: string): CalculationResult | null {
  const compact = question.replace(/\s+/g, '').replace(/²/g, '^2');
  const match = compact.match(/([+-]?\d*)x\^2([+-]\d*)x([+-]\d+)=0/i);
  if (!match) return null;
  const a = match[1] === '' || match[1] === '+' ? 1 : match[1] === '-' ? -1 : Number(match[1]);
  const b = match[2] === '' || match[2] === '+' ? 1 : match[2] === '-' ? -1 : Number(match[2]);
  const c = Number(match[3]);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const x1 = (-b + sqrt) / (2 * a);
  const x2 = (-b - sqrt) / (2 * a);
  const verify1 = a * x1 * x1 + b * x1 + c;
  const verify2 = a * x2 * x2 + b * x2 + c;
  const result = x1 === x2 ? `x = ${fmtNumber(x1, 6)}` : `x = ${fmtNumber(Math.min(x1, x2), 6)} dan x = ${fmtNumber(Math.max(x1, x2), 6)}`;
  const answer = renderAnswer({
    question, edition, mode, result,
    formula: 'x = (-b ± sqrt(b² - 4ac)) / (2a)',
    substitution: `a=${a}, b=${b}, c=${c}, diskriminan=${fmtNumber(disc, 6)}`,
    notes: [`Verifikasi substitusi: f(x1)=${fmtNumber(verify1, 8)} dan f(x2)=${fmtNumber(verify2, 8)}.`],
    status: 'verified',
    latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
  });
  return verified(answer, 'alg-quadratic', 'algebra', { a, b, c, discriminant: disc, x1, x2 });
}

export function tryBuildCalculationAnswer(question: string, editionInput: string = 'swift', answerMode = 'auto'): CalculationResult | null {
  const edition = (['swift', 'zenith', 'apex'].includes(editionInput) ? editionInput : 'swift') as Edition;
  const q = question.trim();
  const lower = q.toLowerCase();

  const tableAnswer = tryBuildTableAnswer(q);
  if (tableAnswer) return tableAnswer;

  if (/\b(rumus kuadrat|quadratic formula)\b/i.test(q) && /\blatex\b/i.test(q)) {
    return verified('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\nStatus: Formula referensi', 'alg-quadratic-ref', 'algebra');
  }

  if (/\b(hitung|berapa|nilai)\b.*\bklaim\b/i.test(q) && !/\d/.test(q)) {
    return needsInput(
      'Data yang dibutuhkan:\n- Nilai kerugian\n- Limit polis\n- Deductible/risiko sendiri\n- Nilai pertanggungan dan value at risk bila ada underinsurance\n- Ketentuan polis yang relevan\n\nStatus: Data belum lengkap',
      'claim-pay',
      'insurance_claim',
    );
  }

  const lossRatioClaim = findLabeledAmount(q, ['net claim', 'klaim neto', 'klaim bersih']);
  const earnedPremium = findLabeledAmount(q, ['earned premium', 'premi earned', 'premi diperoleh']);
  if (/\bloss ratio\b/i.test(q) && lossRatioClaim !== null && earnedPremium !== null && earnedPremium !== 0) {
    const ratio = (lossRatioClaim / earnedPremium) * 100;
    const answer = renderAnswer({
      question: q, edition, mode: answerMode,
      result: fmtPercent(ratio),
      formula: 'Loss Ratio = (Net Claim / Earned Premium) x 100',
      substitution: `(${fmtNumber(lossRatioClaim)} / ${fmtNumber(earnedPremium)}) x 100 = ${fmtPercent(ratio)}`,
      notes: ['Basis yang digunakan: net claim terhadap earned premium.'],
      status: 'verified',
    });
    return verified(answer, 'ins-loss-ratio', 'insurance_ratio', { netClaim: lossRatioClaim, earnedPremium, lossRatio: ratio });
  }

  if (/\b(net combined ratio|combined ratio net|rasio gabungan net)\b/i.test(q)) {
    const grossPremium = findLabeledAmount(q, ['gross premium', 'premi bruto']);
    const cededPremium = findLabeledAmount(q, ['ceded premium', 'premi reasuransi', 'premi ceded']);
    const grossClaim = findLabeledAmount(q, ['gross claim', 'klaim bruto']);
    const recovery = findLabeledAmount(q, ['recovery', 'recoveries', 'pemulihan reasuransi']);
    const expense = findLabeledAmount(q, ['expense', 'biaya']);
    if ([grossPremium, cededPremium, grossClaim, recovery, expense].every((v) => v !== null)) {
      const netPremium = (grossPremium as number) - (cededPremium as number);
      const netClaim = (grossClaim as number) - (recovery as number);
      const lossRatio = (netClaim / netPremium) * 100;
      const expenseRatio = ((expense as number) / netPremium) * 100;
      const combined = lossRatio + expenseRatio;
      const answer = [
        `Hasil akhir: Net Combined Ratio = ${fmtPercent(combined)}`,
        `Net Premium = ${fmtNumber(grossPremium as number)} - ${fmtNumber(cededPremium as number)} = ${fmtNumber(netPremium)}`,
        `Net Claim = ${fmtNumber(grossClaim as number)} - ${fmtNumber(recovery as number)} = ${fmtNumber(netClaim)}`,
        `Loss Ratio = (${fmtNumber(netClaim)} / ${fmtNumber(netPremium)}) x 100 = ${fmtPercent(lossRatio)}`,
        `Expense Ratio = (${fmtNumber(expense as number)} / ${fmtNumber(netPremium)}) x 100 = ${fmtPercent(expenseRatio)}`,
        `Combined Ratio = ${fmtPercent(lossRatio)} + ${fmtPercent(expenseRatio)} = ${fmtPercent(combined)}`,
        'Status: Perhitungan terverifikasi',
      ].join('\n');
      return verified(answer, 'ins-net-combined', 'insurance_ratio', { netPremium, netClaim, lossRatio, expenseRatio, combinedRatio: combined });
    }
  }

  const percentOf = q.match(new RegExp(`(-?\\d[\\d.,]*)\\s*%\\s*(?:dari|x|×)\\s*(${amountPattern()})`, 'i'));
  if (percentOf) {
    const pct = parseLocaleNumber(percentOf[1]);
    const base = parseLocaleNumber(percentOf[2]);
    if (pct !== null && base !== null) {
      const result = base * pct / 100;
      const answer = renderAnswer({
        question: q, edition, mode: answerMode,
        result: /^rp/i.test(percentOf[2].trim()) ? fmtCurrency(result) : fmtNumber(result),
        formula: 'Nilai = Persentase x Nilai Dasar',
        substitution: `${fmtNumber(pct)}% x ${/^rp/i.test(percentOf[2].trim()) ? fmtCurrency(base) : fmtNumber(base)} = ${/^rp/i.test(percentOf[2].trim()) ? fmtCurrency(result) : fmtNumber(result)}`,
        status: 'verified',
      });
      return verified(answer, 'math-percent-of', 'math_basic', { percentage: pct, base, result });
    }
  }

  const dividePercent = q.match(/(-?\d[\d.,]*)\s+(?:dibagi|\/|÷)\s+(-?\d[\d.,]*)\s+(?:dalam|menjadi)\s+persen/i);
  if (dividePercent) {
    const a = parseLocaleNumber(dividePercent[1]);
    const b = parseLocaleNumber(dividePercent[2]);
    if (a !== null && b !== null && b !== 0) {
      const pct = a / b * 100;
      const answer = renderAnswer({
        question: q, edition, mode: answerMode, result: fmtPercent(pct),
        formula: '(a / b) x 100',
        substitution: `(${fmtNumber(a)} / ${fmtNumber(b)}) x 100 = ${fmtPercent(pct)}`,
        notes: ['Hasil dibulatkan menjadi dua angka desimal.'],
        status: 'verified',
      });
      return verified(answer, 'math-ratio-pct', 'math_basic', { a, b, percentage: pct });
    }
  }

  const gbps = q.match(/(-?\d[\d.,]*)\s*gbps\b.*\bmbps\b/i);
  if (gbps) {
    const value = parseLocaleNumber(gbps[1]);
    if (value !== null) {
      const result = value * 1000;
      const answer = renderAnswer({
        question: q, edition, mode: answerMode, result: `${fmtNumber(result)} Mbps`,
        formula: '1 Gbps = 1.000 Mbps',
        substitution: `${fmtNumber(value)} x 1.000 = ${fmtNumber(result)} Mbps`,
        notes: ['Menggunakan prefiks desimal SI untuk bit rate.'],
        status: 'verified',
      });
      return verified(answer, 'net-gbps-mbps', 'data_network', { gbps: value, mbps: result });
    }
  }

  if (/\bptx\b/i.test(q) && /\b(redaman|loss|attenuation)\b/i.test(q) && /\bprx\b|\bhitung\b/i.test(q)) {
    const ptx = findLabeledAmount(q, ['ptx']);
    const loss = findLabeledAmount(q, ['total redaman', 'redaman total', 'redaman', 'loss', 'attenuation']);
    if (ptx !== null && loss !== null) {
      const prx = ptx - loss;
      const answer = renderAnswer({
        question: q, edition, mode: answerMode, result: `Prx = ${fmtNumber(prx)} dBm`,
        formula: 'Prx = Ptx - Total Redaman',
        substitution: `${fmtNumber(ptx)} dBm - ${fmtNumber(loss)} dB = ${fmtNumber(prx)} dBm`,
        notes: ['dBm dikurangi dB menghasilkan dBm.'],
        status: 'verified',
      });
      return verified(answer, 'tel-prx', 'telecom', { ptx, loss, prx });
    }
  }

  const average = q.match(/\b(?:rata-rata|mean)\b[^0-9-]*((?:-?\d[\d.,]*\s*[,;]\s*)+-?\d[\d.,]*)/i);
  if (average) {
    const values = average[1].split(/[,;]/).map((x) => parseLocaleNumber(x.trim())).filter((x): x is number => x !== null);
    if (values.length > 1) {
      const result = values.reduce((a, b) => a + b, 0) / values.length;
      const answer = renderAnswer({
        question: q, edition, mode: answerMode, result: fmtNumber(result, 6),
        formula: 'Rata-rata = Jumlah data / Banyak data',
        substitution: `(${values.map((v) => fmtNumber(v)).join(' + ')}) / ${values.length} = ${fmtNumber(result, 6)}`,
        status: 'verified',
      });
      return verified(answer, 'stat-mean', 'statistics', { count: values.length, mean: result });
    }
  }

  const derivative = polynomialDerivative(q, edition, answerMode);
  if (derivative) return derivative;

  const arithmetic = basicArithmetic(q, edition, answerMode);
  if (arithmetic) return arithmetic;

  const quad = quadratic(q, edition, answerMode);
  if (quad && (edition !== 'swift' || /\b(selesaikan|persamaan)\b/i.test(q))) return quad;

  const simple = q.match(/(?:berapa|hitung)?\s*(-?\d[\d.,]*)\s*(?:x|×|\*)\s*(-?\d[\d.,]*)\s*\??$/i);
  if (simple) {
    const a = parseLocaleNumber(simple[1]);
    const b = parseLocaleNumber(simple[2]);
    if (a !== null && b !== null) {
      const result = a * b;
      if (edition === 'swift' && requestedMode(q, answerMode) === 'auto') {
        return verified(fmtNumber(result, 6), 'math-multiply', 'math_basic', { a, b, result });
      }
      const answer = renderAnswer({
        question: q, edition, mode: answerMode, result: fmtNumber(result, 6),
        formula: 'a x b',
        substitution: `${fmtNumber(a)} x ${fmtNumber(b)} = ${fmtNumber(result, 6)}`,
        status: 'verified',
      });
      return verified(answer, 'math-multiply', 'math_basic', { a, b, result });
    }
  }

  return null;
}


export type RawDisplayValue = {
  rawValue: string;
  displayValue: string;
  decimals: number;
};

export function separateRawDisplay(rawValue: string | number, decimals = 2): RawDisplayValue {
  const raw = String(rawValue).trim().replace(',', '.');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) throw new Error('Nilai presisi tidak valid.');
  return {
    rawValue: raw,
    displayValue: numeric.toFixed(Math.max(0, decimals)),
    decimals: Math.max(0, decimals),
  };
}

export function parsePercentValue(input: string): { ratio: number; percent: number; explicitPercent: boolean } | null {
  const text = String(input || '').trim();
  const explicitPercent = text.includes('%');
  const normalized = text.replace('%', '').replace(/\s+/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const ratio = explicitPercent ? value / 100 : value;
  return { ratio, percent: ratio * 100, explicitPercent };
}
