import { RELEASE } from './release';

export type InsuranceFinanceMode =
  | 'insurance_finance'
  | 'insurance_finance_claim'
  | 'insurance_finance_premium'
  | 'insurance_finance_underwriting'
  | 'insurance_finance_reserve'
  | 'insurance_finance_reinsurance'
  | 'insurance_finance_capital'
  | 'insurance_finance_investment'
  | 'insurance_finance_scenario'
  | 'insurance_finance_artifact'
  | 'insurance_finance_result_view'
  | 'insurance_finance_security';

export type InsuranceFinanceIntent =
  | 'claim'
  | 'premium'
  | 'underwriting'
  | 'reserve'
  | 'reinsurance'
  | 'capital'
  | 'investment'
  | 'scenario'
  | 'unknown';

export type FinanceInput = Record<string, unknown>;

export type FinanceResult = {
  ok: boolean;
  intent: InsuranceFinanceIntent;
  formula?: string;
  values?: Record<string, number | string | Array<Record<string, number | string>>>;
  missing: string[];
  assumptions: string[];
  evidence: string[];
  confidence: number;
  warning: string;
};

export const INSURANCE_FINANCE_FEATURES = Object.freeze([{"id":"SHARED-1336-001","category":"CLI Menu","name":"Insurance Finance Chat Mode","risk":"Medium","limit":"Kemampuan mengikuti Swift, Zenith, atau Apex.","guardrail":"Mode baru tidak menaikkan izin akses data secara otomatis."},{"id":"SHARED-1336-002","category":"Routing","name":"Insurance Financial Intent Router","risk":"Medium","limit":"Swift menerima intent dasar; Zenith/Apex menerima intent lebih kompleks.","guardrail":"Pertanyaan ambigu harus diklarifikasi sebelum menghitung."},{"id":"SHARED-1336-003","category":"Calculation","name":"Deterministic Insurance Calculator","risk":"Critical","limit":"Depth calculator berbeda menurut version.","guardrail":"Jangan menggunakan floating-point mentah untuk nilai finansial penting."},{"id":"SHARED-1336-004","category":"Formula Governance","name":"Insurance Financial Formula Registry","risk":"High","limit":"Swift memakai formula dasar; Apex dapat memakai model analitis kompleks.","guardrail":"Formula regulasi harus mempunyai yurisdiksi dan tanggal berlaku."},{"id":"SHARED-1336-005","category":"Input Validation","name":"Financial Input and Locale Normalizer","risk":"High","limit":"Semua version memakai normalizer yang sama.","guardrail":"Interpretasi angka ambigu harus ditampilkan sebelum perhitungan."},{"id":"SHARED-1336-006","category":"Input Completeness","name":"Missing Financial Data Detector","risk":"Critical","limit":"Swift meminta input minimum; Apex dapat menawarkan beberapa scenario.","guardrail":"Default tidak boleh dibuat untuk variabel yang dapat mengubah hasil material."},{"id":"SHARED-1336-007","category":"Claim Finance","name":"Claim Payment Breakdown Engine","risk":"Critical","limit":"Swift dasar; Zenith multi-komponen; Apex cross-document.","guardrail":"Simulasi tidak boleh ditampilkan sebagai keputusan pembayaran resmi."},{"id":"SHARED-1336-008","category":"Premium","name":"Premium Pricing Engine","risk":"High","limit":"Swift satu skenario; Zenith beberapa komponen; Apex sensitivity/portfolio.","guardrail":"Bukan penetapan tarif aktuaria resmi."},{"id":"SHARED-1336-009","category":"Underwriting","name":"Insurance Financial Ratio Analyzer","risk":"High","limit":"Swift ratio dasar; Apex sustainability analysis.","guardrail":"Jangan menyimpulkan kesehatan perusahaan hanya dari combined ratio."},{"id":"SHARED-1336-010","category":"Reserve","name":"Reserve and IBNR Intelligence","risk":"High","limit":"Swift hanya konsep dasar; Apex mendapat triangle/sensitivity.","guardrail":"Tidak menggantikan estimasi resmi aktuaris."},{"id":"SHARED-1336-011","category":"Reinsurance","name":"Reinsurance Financial Calculator","risk":"High","limit":"Swift quota share/XoL sederhana; Apex struktur kompleks dan gap.","guardrail":"Recovery lebih kecil dari premi satu tahun bukan bukti reasuransi buruk."},{"id":"SHARED-1336-012","category":"Capital","name":"Solvency and Liquidity Analyzer","risk":"High","limit":"Swift penjelasan konsep; Apex stress testing.","guardrail":"Angka regulasi harus sesuai yurisdiksi dan tanggal berlaku."},{"id":"SHARED-1336-013","category":"Investment","name":"Insurance Investment and ALM Analyzer","risk":"High","limit":"Swift pengetahuan dasar; Apex ALM multi-scenario.","guardrail":"Tidak memberikan instruksi investasi nyata atau transaksi otomatis."},{"id":"SHARED-1336-014","category":"Scenario Analysis","name":"Insurance Financial Scenario Engine","risk":"High","limit":"Swift satu skenario; Zenith beberapa; Apex stress/sensitivity kompleks.","guardrail":"Skenario bukan prediksi pasti."},{"id":"SHARED-1336-015","category":"Evidence","name":"Financial Evidence and Source Separation","risk":"Critical","limit":"Semua version wajib memisahkan sumber.","guardrail":"Data pelanggan lain tidak boleh menjadi evidence."},{"id":"SHARED-1336-016","category":"Confidence","name":"Insurance Financial Confidence Calibration","risk":"Critical","limit":"Swift menampilkan status sederhana; Apex breakdown komponen.","guardrail":"Confidence tidak berarti keputusan resmi atau peluang klaim diterima."},{"id":"SHARED-1336-017","category":"Response Design","name":"Insurance Financial Answer Templates","risk":"Medium","limit":"Swift ringkas; Zenith detail operasional; Apex analitis.","guardrail":"Penyederhanaan tidak boleh mengubah makna formula atau polis."},{"id":"SHARED-1336-018","category":"Spreadsheet","name":"Insurance Financial Spreadsheet QA","risk":"High","limit":"Swift file kecil; Zenith workbook standar; Apex multi-workbook.","guardrail":"Jangan mengubah spreadsheet tanpa preview, backup, dan izin."},{"id":"SHARED-1336-019","category":"Evaluation","name":"Insurance Financial Benchmark","risk":"Critical","limit":"Threshold disesuaikan per version.","guardrail":"Data benchmark harus sintetis atau sudah dimasking."},{"id":"SHARED-1336-020","category":"Release","name":"V13.36 Release Gate","risk":"Critical","limit":"Semua version mengikuti gate yang relevan.","guardrail":"Keberadaan file/module bukan bukti fitur sudah selesai."},{"id":"APEX-1336-001","category":"Chat Mode","name":"Apex Insurance Financial Expert","risk":"High","limit":"Tidak menandatangani laporan atau membuat keputusan resmi.","guardrail":"Tidak menggantikan aktuaris, auditor, atau regulator."},{"id":"APEX-1336-002","category":"Pricing","name":"Apex Premium Adequacy and Sensitivity","risk":"High","limit":"Tidak menetapkan tarif final.","guardrail":"Bias dan regulatory pricing constraints harus disebut bila relevan."},{"id":"APEX-1336-003","category":"Underwriting","name":"Apex Underwriting Profitability Analysis","risk":"High","limit":"Tidak mengabaikan basis gross/net dan periode.","guardrail":"Laba investasi harus dipisahkan dari underwriting."},{"id":"APEX-1336-004","category":"Reserve","name":"Apex Reserve Development and Triangle Analysis","risk":"Critical","limit":"Tidak menghasilkan official reserve sign-off.","guardrail":"Metode dan limitation harus ditampilkan."},{"id":"APEX-1336-005","category":"Reinsurance","name":"Apex Reinsurance Program Analysis","risk":"Critical","limit":"Tidak mengambil keputusan accept/reject risiko.","guardrail":"Treaty wording aktual dan exclusions harus diperiksa."},{"id":"APEX-1336-006","category":"Capital","name":"Apex Solvency and Liquidity Stress Testing","risk":"Critical","limit":"Tidak menyatakan compliance resmi.","guardrail":"Regulatory thresholds harus sourced dan jurisdiction-aware."},{"id":"APEX-1336-007","category":"Investment","name":"Apex Insurance ALM and Investment Risk","risk":"High","limit":"Tidak memberikan transaksi investasi.","guardrail":"Expected returns harus dipisahkan dari guaranteed cash flows."},{"id":"APEX-1336-008","category":"Scenario","name":"Apex Advanced Financial Scenario and Sensitivity","risk":"High","limit":"Tidak melakukan probabilistic prediction tanpa model/data memadai.","guardrail":"Scenario adalah analisis kemungkinan, bukan kepastian."},{"id":"APEX-1336-009","category":"Anomaly","name":"Apex Insurance Financial Anomaly Detection","risk":"High","limit":"Tidak menyimpulkan fraud atau misconduct.","guardrail":"Data quality issue harus diperiksa sebelum business conclusion."},{"id":"APEX-1336-010","category":"Reconciliation","name":"Apex Claim Payment Reconciliation","risk":"Critical","limit":"Tidak menjalankan transaksi finansial.","guardrail":"Handoff ke authorized finance officer wajib."},{"id":"APEX-1336-011","category":"Cross-Document","name":"Apex Financial Claim Evidence Graph","risk":"Critical","limit":"Role internal dan customer verification wajib.","guardrail":"Source salah pelanggan adalah insiden privacy kritis."},{"id":"APEX-1336-012","category":"Financial Health","name":"Apex Insurance Financial Health Framework","risk":"High","limit":"Bukan audit opinion atau credit rating resmi.","guardrail":"Perbedaan period, accounting basis, dan data quality harus disebut."},{"id":"APEX-1336-013","category":"Confidence","name":"Apex Financial Confidence Decomposition","risk":"Critical","limit":"Confidence bukan probabilitas keputusan regulator/klaim.","guardrail":"Tidak boleh menggunakan angka confidence dekoratif."},{"id":"APEX-1336-014","category":"Report","name":"Apex Insurance Financial Supervisor Report","risk":"High","limit":"Draft harus ditinjau manusia sebelum dipakai resmi.","guardrail":"Tidak menandatangani laporan atau mengklaim audit opinion."},{"id":"APEX-1336-015","category":"Security","name":"Apex Financial Data Security","risk":"Critical","limit":"Hanya role terverifikasi.","guardrail":"Nomor rekening, identitas, dan health data wajib dimasking."},{"id":"APEX-1336-016","category":"Evaluation","name":"Apex Insurance Financial Expert Benchmark","risk":"Critical","limit":"Tidak menguji atau mengizinkan transaksi nyata.","guardrail":"Human review wajib untuk seluruh critical expert cases."}]);
export const INSURANCE_FINANCE_LIMITS = Object.freeze({"maxScenarios":8,"maxWorkbookFiles":10,"maxDocuments":20,"detail":"expert-supervisor","reserveMethod":"triangle-sensitivity"});

const FINANCE_MODES = new Set<InsuranceFinanceMode>([
  'insurance_finance',
  'insurance_finance_claim',
  'insurance_finance_premium',
  'insurance_finance_underwriting',
  'insurance_finance_reserve',
  'insurance_finance_reinsurance',
  'insurance_finance_capital',
  'insurance_finance_investment',
  'insurance_finance_scenario',
  'insurance_finance_artifact',
  'insurance_finance_result_view',
  'insurance_finance_security',
]);

const REQUIRED: Record<Exclude<InsuranceFinanceIntent, 'unknown'>, string[]> = {
  claim: ['loss'],
  premium: ['exposure', 'rate'],
  underwriting: ['incurredClaims', 'earnedPremium'],
  reserve: ['expectedUltimate', 'paidClaims', 'caseReserve'],
  reinsurance: ['loss'],
  capital: ['availableCapital', 'requiredCapital'],
  investment: ['assetDuration', 'liabilityDuration', 'assets', 'liabilities'],
  scenario: ['baseValue', 'shockRate'],
};

function finite(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  return parseHumanNumber(value);
}

export function parseHumanNumber(value: string): number | undefined {
  const raw = value.trim().toLowerCase().replace(/rp\s*/g, '').replace(/\s+/g, '');
  const match = raw.match(/^(-?[0-9][0-9.,]*)(ribu|rb|juta|jt|miliar|milyar|m|%|persen)?$/i);
  if (!match) return undefined;
  let numberText = match[1];
  const suffix = match[2] || '';
  const hasComma = numberText.includes(',');
  const hasDot = numberText.includes('.');
  if (hasComma && hasDot) {
    if (numberText.lastIndexOf(',') > numberText.lastIndexOf('.')) {
      numberText = numberText.replace(/\./g, '').replace(',', '.');
    } else {
      numberText = numberText.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = numberText.split(',');
    numberText = parts.length === 2 && parts[1].length <= 2 ? `${parts[0].replace(/\./g, '')}.${parts[1]}` : numberText.replace(/,/g, '');
  } else if (hasDot) {
    const parts = numberText.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) numberText = numberText.replace(/\./g, '');
  }
  let out = Number(numberText);
  if (!Number.isFinite(out)) return undefined;
  if (/^(ribu|rb)$/.test(suffix)) out *= 1_000;
  if (/^(juta|jt)$/.test(suffix)) out *= 1_000_000;
  if (/^(miliar|milyar|m)$/.test(suffix)) out *= 1_000_000_000;
  if (/^(%|persen)$/.test(suffix)) out /= 100;
  return out;
}

function rate(value: unknown): number | undefined {
  const parsed = finite(value);
  if (parsed == null) return undefined;
  return parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
}

function get(input: FinanceInput, key: string, fallback?: number): number | undefined {
  const value = key === 'rate' || key === 'cededRate' || key === 'shockRate'
    ? rate(input[key])
    : finite(input[key]);
  return value == null ? fallback : value;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 2 }).format(value);
}

export function isInsuranceFinanceMode(value?: string): value is InsuranceFinanceMode {
  return FINANCE_MODES.has(String(value || '') as InsuranceFinanceMode);
}

export function normalizeInsuranceFinanceMode(value?: string): InsuranceFinanceMode {
  return isInsuranceFinanceMode(value) ? value : 'insurance_finance';
}

export function classifyInsuranceFinanceIntent(message: string): InsuranceFinanceIntent {
  const text = message.toLowerCase();
  if (/ibnr|cadangan|reserve|triangle|ultimate claim/.test(text)) return 'reserve';
  if (/reasuransi|reinsurance|quota share|excess of loss|\bxol\b|retensi/.test(text)) return 'reinsurance';
  if (/solvabilitas|solvency|rbc|modal tersedia|modal minimum|likuiditas/.test(text)) return 'capital';
  if (/\balm\b|duration gap|durasi aset|durasi liabilitas|hasil investasi|investment/.test(text)) return 'investment';
  if (/scenario|skenario|sensitivitas|stress test|shock/.test(text)) return 'scenario';
  if (/loss ratio|expense ratio|combined ratio|underwriting|rasio klaim/.test(text)) return 'underwriting';
  if (/premi|refund|pengembalian premi|tarif|rate premi|diskon premi/.test(text)) return 'premium';
  if (/pembayaran klaim|hitung klaim|nilai klaim|deductible|risiko sendiri|underinsurance|klaim dibayar/.test(text)) return 'claim';
  return 'unknown';
}

function modeIntent(mode?: string): InsuranceFinanceIntent {
  const value = String(mode || '');
  if (value.endsWith('_claim')) return 'claim';
  if (value.endsWith('_premium')) return 'premium';
  if (value.endsWith('_underwriting')) return 'underwriting';
  if (value.endsWith('_reserve')) return 'reserve';
  if (value.endsWith('_reinsurance')) return 'reinsurance';
  if (value.endsWith('_capital')) return 'capital';
  if (value.endsWith('_investment')) return 'investment';
  if (value.endsWith('_scenario')) return 'scenario';
  return 'unknown';
}

function extract(message: string, labels: string[]): number | undefined {
  const label = labels.join('|');
  const regex = new RegExp(`(?:${label})\\s*(?:sebesar|senilai|adalah|=|:)?\\s*(?:rp\\s*)?(-?[0-9][0-9.,]*)(?:\\s*(ribu|rb|juta|jt|miliar|milyar|m|%|persen))?`, 'i');
  const found = message.match(regex);
  return found ? parseHumanNumber(`${found[1]}${found[2] || ''}`) : undefined;
}

export function extractFinanceInputs(message: string): Record<string, number> {
  const out: Record<string, number> = {};
  const specs: Record<string, string[]> = {
    loss: ['nilai kerugian', 'kerugian', 'loss'],
    deductible: ['risiko sendiri', 'deductible', 'own risk'],
    policyLimit: ['batas polis', 'policy limit', 'limit pertanggungan', 'limit'],
    sumInsured: ['nilai pertanggungan', 'sum insured', 'tsi'],
    valueAtRisk: ['nilai aktual', 'value at risk', 'nilai objek'],
    exposure: ['exposure', 'nilai eksposur', 'dasar premi'],
    rate: ['tarif premi', 'premium rate', 'rate', 'tarif'],
    loading: ['loading', 'biaya tambahan'],
    discount: ['diskon', 'discount'],
    tax: ['pajak', 'tax'],
    paidPremium: ['premi dibayar', 'paid premium'],
    unusedDays: ['sisa hari', 'unused days'],
    termDays: ['masa polis hari', 'term days', 'total hari'],
    fee: ['biaya pembatalan', 'cancellation fee', 'fee'],
    incurredClaims: ['incurred claims', 'klaim terjadi', 'beban klaim'],
    earnedPremium: ['earned premium', 'premi diperoleh'],
    expenses: ['expenses', 'beban operasional', 'biaya operasional'],
    expectedUltimate: ['expected ultimate', 'ultimate claim', 'estimasi ultimate'],
    paidClaims: ['paid claims', 'klaim dibayar'],
    caseReserve: ['case reserve', 'cadangan kasus'],
    cededRate: ['ceded rate', 'porsi reasuransi', 'quota share'],
    retention: ['retention', 'retensi'],
    xolLimit: ['xol limit', 'limit xol'],
    availableCapital: ['available capital', 'modal tersedia'],
    requiredCapital: ['required capital', 'modal minimum'],
    liquidAssets: ['liquid assets', 'aset likuid'],
    shortTermLiabilities: ['short term liabilities', 'liabilitas jangka pendek'],
    assetDuration: ['asset duration', 'durasi aset'],
    liabilityDuration: ['liability duration', 'durasi liabilitas'],
    assets: ['total aset', 'assets'],
    liabilities: ['total liabilitas', 'liabilities'],
    baseValue: ['nilai dasar', 'base value', 'base'],
    shockRate: ['shock rate', 'tingkat shock', 'sensitivitas'],
  };
  for (const [key, labels] of Object.entries(specs)) {
    const value = extract(message, labels);
    if (value != null) out[key] = value;
  }
  return out;
}

export function calculateInsuranceFinance(intent: InsuranceFinanceIntent, input: FinanceInput): FinanceResult {
  if (intent === 'unknown') return {
    ok: false, intent, missing: ['tujuan perhitungan'], assumptions: [], evidence: [],
    confidence: 0.2, warning: 'Pilih jenis perhitungan: klaim, premi, underwriting, reserve, reasuransi, capital, investasi, atau skenario.'
  };

  const required = REQUIRED[intent];
  const missing = required.filter((key) => get(input, key) == null);
  if (missing.length) return {
    ok: false, intent, missing, assumptions: [], evidence: [],
    confidence: 0.45, warning: 'Data minimum belum lengkap. Jangan mengisi angka yang tidak diberikan.'
  };

  const assumptions: string[] = [];
  const evidence = Object.keys(input).filter((key) => get(input, key) != null);
  let formula = '';
  let values: FinanceResult['values'] = {};

  if (intent === 'claim') {
    const loss = get(input, 'loss', 0)!;
    const deductible = get(input, 'deductible', 0)!;
    const policyLimit = get(input, 'policyLimit', Number.POSITIVE_INFINITY)!;
    const sumInsured = get(input, 'sumInsured');
    const valueAtRisk = get(input, 'valueAtRisk');
    const underinsuranceFactor = sumInsured != null && valueAtRisk != null && valueAtRisk > 0
      ? Math.min(1, sumInsured / valueAtRisk)
      : 1;
    if (sumInsured == null || valueAtRisk == null) assumptions.push('Underinsurance factor dianggap 100% karena sum insured/value at risk belum lengkap.');
    const adjustedLoss = loss * underinsuranceFactor;
    const afterDeductible = Math.max(adjustedLoss - deductible, 0);
    const payableClaim = Math.min(afterDeductible, policyLimit);
    formula = 'min(max(loss × underinsuranceFactor − deductible, 0), policyLimit)';
    values = { loss, underinsuranceFactor, adjustedLoss, deductible, policyLimit: Number.isFinite(policyLimit) ? policyLimit : 'tidak diberikan', payableClaim };
  } else if (intent === 'premium') {
    const exposure = get(input, 'exposure', 0)!;
    const premiumRate = rate(input.rate) ?? 0;
    const loading = get(input, 'loading', 0)!;
    const discount = get(input, 'discount', 0)!;
    const tax = get(input, 'tax', 0)!;
    const basePremium = exposure * premiumRate;
    const grossPremium = Math.max(basePremium + loading - discount + tax, 0);
    formula = 'exposure × rate + loading − discount + tax';
    values = { exposure, rate: premiumRate, basePremium, loading, discount, tax, grossPremium };
    const paidPremium = get(input, 'paidPremium');
    const unusedDays = get(input, 'unusedDays');
    const termDays = get(input, 'termDays');
    if (paidPremium != null && unusedDays != null && termDays != null && termDays > 0) {
      const fee = get(input, 'fee', 0)!;
      values.estimatedRefund = Math.max(paidPremium * unusedDays / termDays - fee, 0);
    }
  } else if (intent === 'underwriting') {
    const incurredClaims = get(input, 'incurredClaims', 0)!;
    const earnedPremium = get(input, 'earnedPremium', 0)!;
    const expenses = get(input, 'expenses', 0)!;
    const lossRatio = earnedPremium > 0 ? incurredClaims / earnedPremium : 0;
    const expenseRatio = earnedPremium > 0 ? expenses / earnedPremium : 0;
    const combinedRatio = lossRatio + expenseRatio;
    formula = '(incurredClaims + expenses) / earnedPremium';
    values = { incurredClaims, earnedPremium, expenses, lossRatio, expenseRatio, combinedRatio };
  } else if (intent === 'reserve') {
    const expectedUltimate = get(input, 'expectedUltimate', 0)!;
    const paidClaims = get(input, 'paidClaims', 0)!;
    const caseReserve = get(input, 'caseReserve', 0)!;
    const ibnr = Math.max(expectedUltimate - paidClaims - caseReserve, 0);
    formula = 'max(expectedUltimate − paidClaims − caseReserve, 0)';
    values = { expectedUltimate, paidClaims, caseReserve, ibnr };
  } else if (intent === 'reinsurance') {
    const loss = get(input, 'loss', 0)!;
    const cededRate = rate(input.cededRate);
    const retention = get(input, 'retention');
    const xolLimit = get(input, 'xolLimit');
    if (cededRate != null) {
      const ceded = loss * cededRate;
      formula = 'ceded = loss × cededRate; net = loss − ceded';
      values = { loss, cededRate, ceded, net: loss - ceded };
    } else if (retention != null && xolLimit != null) {
      const ceded = Math.min(Math.max(loss - retention, 0), xolLimit);
      formula = 'ceded = min(max(loss − retention, 0), xolLimit)';
      values = { loss, retention, xolLimit, ceded, net: loss - ceded };
    } else {
      return { ok:false, intent, missing:['cededRate atau retention+xolLimit'], assumptions:[], evidence, confidence:0.45, warning:'Struktur reasuransi belum lengkap.' };
    }
  } else if (intent === 'capital') {
    const availableCapital = get(input, 'availableCapital', 0)!;
    const requiredCapital = get(input, 'requiredCapital', 0)!;
    const solvencyRatio = requiredCapital > 0 ? availableCapital / requiredCapital : 0;
    formula = 'availableCapital / requiredCapital';
    values = { availableCapital, requiredCapital, solvencyRatio };
    const liquidAssets = get(input, 'liquidAssets');
    const shortTermLiabilities = get(input, 'shortTermLiabilities');
    if (liquidAssets != null && shortTermLiabilities != null && shortTermLiabilities > 0) values.liquidityRatio = liquidAssets / shortTermLiabilities;
  } else if (intent === 'investment') {
    const assetDuration = get(input, 'assetDuration', 0)!;
    const liabilityDuration = get(input, 'liabilityDuration', 0)!;
    const assets = get(input, 'assets', 0)!;
    const liabilities = get(input, 'liabilities', 0)!;
    const durationGap = assets > 0 ? assetDuration - liabilityDuration * liabilities / assets : 0;
    formula = 'assetDuration − liabilityDuration × liabilities/assets';
    values = { assetDuration, liabilityDuration, assets, liabilities, durationGap };
  } else if (intent === 'scenario') {
    const baseValue = get(input, 'baseValue', 0)!;
    const shockRate = rate(input.shockRate) ?? 0;
    const requested = Math.max(1, Math.floor(get(input, 'scenarioCount', INSURANCE_FINANCE_LIMITS.maxScenarios) || 1));
    const count = Math.min(requested, INSURANCE_FINANCE_LIMITS.maxScenarios);
    const scenarios = Array.from({ length: count }, (_, index) => {
      const multiplier = index === 0 ? 0 : index;
      return { name: index === 0 ? 'base' : `shock-${index}`, rate: multiplier * shockRate, value: baseValue * (1 + multiplier * shockRate) };
    });
    formula = 'baseValue × (1 + scenarioIndex × shockRate)';
    values = { baseValue, shockRate, scenarios };
  }

  return {
    ok: true,
    intent,
    formula,
    values,
    missing: [],
    assumptions,
    evidence,
    confidence: assumptions.length ? 0.72 : 0.9,
    warning: 'Simulasi informatif. Gunakan polis, data keuangan, treaty, dan otorisasi resmi sebelum keputusan final.'
  };
}

function valueLines(result: FinanceResult): string[] {
  if (!result.values) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(result.values)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: ${value.map((item) => `${item.name}=${money(Number(item.value))}`).join(', ')}`);
    } else if (typeof value === 'number') {
      const ratioKey = /ratio|rate|factor/i.test(key);
      lines.push(`${key}: ${ratioKey ? pct(value) : money(value)}`);
    } else lines.push(`${key}: ${value}`);
  }
  return lines;
}

export function tryBuildInsuranceFinanceAnswer(message: string, mode?: string): { answer: string; result: FinanceResult } | null {
  const intent = modeIntent(mode) !== 'unknown' ? modeIntent(mode) : classifyInsuranceFinanceIntent(message);
  if (!isInsuranceFinanceMode(mode) && intent === 'unknown') return null;
  const input = extractFinanceInputs(message);
  const result = calculateInsuranceFinance(intent, input);
  if (!result.ok) {
    return {
      result,
      answer: `Perhitungan ${intent === 'unknown' ? 'keuangan asuransi' : intent} belum dapat dijalankan. Data yang masih diperlukan: ${result.missing.join(', ')}.\nKirim angka beserta satuan dan basisnya. AI tidak akan menebak angka yang belum diberikan.`
    };
  }
  const assumptions = result.assumptions.length ? `\nAsumsi: ${result.assumptions.join(' ')}` : '';
  return {
    result,
    answer: `Hasil simulasi ${result.intent}:\n${valueLines(result).map((line) => `- ${line}`).join('\n')}\nFormula: ${result.formula}${assumptions}\nCatatan: ${result.warning}`
  };
}

export function buildInsuranceFinancePrompt(mode?: string): string {
  if (!isInsuranceFinanceMode(mode)) return 'Insurance finance router: aktif hanya saat intent keuangan asuransi terdeteksi; jangan mencampur context dengan finance pasar umum.';
  return `Insurance Finance Mode: ${normalizeInsuranceFinanceMode(mode)} pada ${RELEASE.name} ${RELEASE.label}.
- Gunakan calculator deterministik dan formula registry untuk aritmetika; jangan menyerahkan hitungan dasar kepada model bahasa.
- Pisahkan angka bersumber, asumsi, formula, hasil, confidence, dan unresolved input.
- Jangan mengarang tarif, limit, deductible, reserve, treaty, modal, nilai investasi, atau status pembayaran.
- Klaim/premi personal memerlukan verifikasi; laporan internal memerlukan role dan audit.
- Hasil bukan keputusan klaim, tarif resmi, reserve sign-off, opini audit, sertifikasi regulator, atau rekomendasi transaksi.
- Batas edition: detail=${INSURANCE_FINANCE_LIMITS.detail}, scenario=${INSURANCE_FINANCE_LIMITS.maxScenarios}, workbook=${INSURANCE_FINANCE_LIMITS.maxWorkbookFiles}.`;
}

export function insuranceFinanceSummary() {
  return {
    release: RELEASE.label,
    edition: RELEASE.edition,
    features: INSURANCE_FINANCE_FEATURES.length,
    limits: INSURANCE_FINANCE_LIMITS,
    modes: [...FINANCE_MODES],
  };
}
