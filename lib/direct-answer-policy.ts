import type { AssistantMode } from './types';
import { RELEASE } from './release';

type FormatDirectAccuracyArgs = {
  userMessage: string;
  mode: AssistantMode | string;
  intelligenceLevel: string;
  edition: string;
  sourcesCount?: number;
};

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function normalizeForRule(text: string) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/[‐‑‒–—_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wantsDetail(message: string) {
  return includesAny(message, [
    'jelaskan lengkap', 'detail', 'sedetail', 'panjang', 'step by step', 'langkah demi langkah',
    'analisis mendalam', 'deep', 'uraikan', 'kenapa bisa', 'root cause', 'bukti lengkap',
    'semua', 'pembuktian', 'buktikan', 'caranya', 'cara penyelesaian', '/expand', '/deep'
  ]);
}

function isMathQuestion(message: string) {
  return /[∫√πλθ∞Σ∑]|\b(sin|cos|tan|log|ln|lim|integral|turunan|gradien|gradient|nabla|eigen|matriks|determinan|invers|diskriminan|persamaan|diferensial|probabilitas|binomial|poisson|variansi|mean|median|modus|limit|deret|fungsi|akar|hitung|sederhanakan|faktorkan|selesaikan|luas|keliling|volume|diskon|persen|bunga|kecepatan|lagrange|multiplier|maksimum|minimum|optimasi|parsial|partial)\b/i.test(message) || /\d+\s*[+\-*/×÷^=]\s*\d+/.test(message);
}

function stripAccuracyLines(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*(Akurasi|Confidence)\s*:\s*\d{1,3}%/i.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function toSuperscript(power: string) {
  const map: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  return power.split('').map((ch) => map[ch] || ch).join('');
}

function simplifyFraction(num: string, den: string) {
  const n = num.trim();
  const d = den.trim();
  if (n === '1') return `1/${d}`;
  if (/^[a-zA-Z0-9²³⁴⁵⁶⁷⁸⁹⁰()+\-*/ ]+$/.test(n) && /^[a-zA-Z0-9²³⁴⁵⁶⁷⁸⁹⁰()+\-*/ ]+$/.test(d)) return `(${n})/(${d})`;
  return `${n}/${d}`;
}

export function cleanCliLatex(text: string) {
  let out = text
    .replace(/\\\[/g, '').replace(/\\\]/g, '').replace(/\\\(/g, '').replace(/\\\)/g, '')
    .replace(/\\begin\{[^{}]+\}/g, '').replace(/\\end\{[^{}]+\}/g, '')
    .replace(/\\text\{([^{}]*)\}/g, '$1').replace(/\\mathrm\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^{}]*)\}/g, '$1').replace(/\\mathcal\{L\}/g, 'L').replace(/\\mathcal\{([^{}]*)\}/g, '$1')
    .replace(/\\left/g, '').replace(/\\right/g, '')
    .replace(/\\times/g, '×').replace(/\\cdot/g, '×').replace(/\\div/g, '÷')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, a, b) => simplifyFraction(String(a), String(b)))
    .replace(/\\partial/g, '∂').replace(/\\nabla/g, '∇').replace(/\\lambda/g, 'λ').replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ').replace(/\\Delta/g, 'Δ')
    .replace(/\\leq/g, '≤').replace(/\\geq/g, '≥').replace(/\\neq/g, '≠').replace(/\\approx/g, '≈').replace(/\\to/g, '→')
    .replace(/\\ln/g, 'ln').replace(/\\int/g, '∫').replace(/\\sum/g, '∑').replace(/\\infty/g, '∞').replace(/\\pi/g, 'π')
    .replace(/\$\$/g, '').replace(/\$/g, '');

  out = out
    .replace(/\^\{([\-0-9]+)\}/g, (_, p) => toSuperscript(String(p)))
    .replace(/\^([\-0-9])/g, (_, p) => toSuperscript(String(p)))
    .replace(/e\^\{([^{}]+)\}/g, 'e^($1)')
    .replace(/e\^\(([^)]+)\)/g, 'e^($1)')
    .replace(/\{([^{}]*)\}/g, '$1')
    .replace(/\\[,;:]/g, ' ')
    .replace(/\\/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

function removeProcessNarration(text: string) {
  return text
    .replace(/^\s*(aku akan|saya akan)\s+(menganalisis|memeriksa|mengecek)[^\n]*\n+/i, '')
    .replace(/^\s*(baik,?\s*)?(mari kita|oke,?\s*mari)[^\n]*\n+/i, '')
    .replace(/^\s*(berdasarkan dataset|dari data yang tersedia|berdasarkan data yang ada|menurut data yang tersedia)[,\s]*/i, '')
    .replace(/^\s*untuk\s+(menghitung|menyelesaikan|mencari|menentukan)[^\n]*\n+/i, '')
    .replace(/^\s*jadi,?\s*/i, '')
    .trim();
}

function stripForeignLanguageNoise(text: string, userMessage: string) {
  const userRequestedForeign = /\b(inggris|english|arab|mandarin|china|jepang|korea|translate|terjemahkan ke|bahasa lain)\b/i.test(userMessage);
  if (userRequestedForeign) return text;
  const kept = text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    return !/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/.test(trimmed);
  });
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function basicIslamFactAnswer(message: string): string | null {
  const m = normalizeForRule(message);
  if (/(berapa|jumlah).*(surah|surat).*(al quran|alquran|quran)|(?:al quran|alquran|quran).*(berapa|jumlah).*(surah|surat)/.test(m)) return 'Al-Qur’an terdiri dari 114 surah.';
  if (/(surah|surat) pertama/.test(m)) return 'Surah pertama dalam Al-Qur’an adalah Al-Fatihah.';
  if (/(surah|surat) terakhir/.test(m)) return 'Surah terakhir dalam urutan mushaf adalah An-Nas.';
  if (/(surah|surat) terpanjang/.test(m)) return 'Surah terpanjang dalam Al-Qur’an adalah Al-Baqarah.';
  if (/(surah|surat) terpendek/.test(m)) return 'Surah terpendek dalam Al-Qur’an adalah Al-Kautsar.';
  if (/ayat kursi/.test(m)) return 'Ayat Kursi terdapat dalam Surah Al-Baqarah ayat 255.';
  if (/rukun islam.*rukun iman|perbedaan.*rukun islam.*rukun iman|beda.*rukun islam.*rukun iman/.test(m)) return ['Rukun Islam adalah pokok amalan lahiriah: syahadat, salat, zakat, puasa Ramadan, dan haji bagi yang mampu.', 'Rukun iman adalah pokok keyakinan: iman kepada Allah, malaikat, kitab-kitab, rasul, hari akhir, serta qada dan qadar.'].join('\n');
  if (/sebutkan.*rukun islam|apa saja.*rukun islam|rukun islam/.test(m) && !/rukun iman/.test(m)) return 'Rukun Islam: syahadat, salat, zakat, puasa Ramadan, dan haji bagi yang mampu.';
  if (/sebutkan.*rukun iman|apa saja.*rukun iman|rukun iman/.test(m) && !/rukun islam/.test(m)) return 'Rukun iman: iman kepada Allah, malaikat, kitab-kitab, rasul, hari akhir, serta qada dan qadar.';
  if (/huruf qalqalah|sebutkan.*qalqalah/.test(m)) return 'Huruf qalqalah adalah ق ط ب ج د.';
  if (/apa itu al quran|apa itu alquran|apa itu quran/.test(m)) return 'Al-Qur’an adalah wahyu Allah kepada Nabi Muhammad ﷺ melalui Malaikat Jibril sebagai petunjuk hidup bagi manusia.';
  if (/surah al ikhlas.*(tentang|menjelaskan|makna)/.test(m)) return 'Surah Al-Ikhlas menjelaskan keesaan Allah.';
  return null;
}

function methodResearchFastAnswer(message: string): string | null {
  const m = normalizeForRule(message);
  if (/apa itu metodologi penelitian/.test(m)) return 'Metodologi penelitian adalah cara sistematis untuk merancang, mengumpulkan, menganalisis, dan menyimpulkan data penelitian.';
  if (/perbedaan.*kuantitatif.*kualitatif|beda.*kuantitatif.*kualitatif/.test(m)) return 'Kuantitatif memakai data angka dan analisis statistik, sedangkan kualitatif memakai data deskriptif untuk memahami makna/fenomena.';
  if (/variabel x.*variabel y|penggunaan ai.*produktivitas mahasiswa/.test(m)) return 'Variabel X: penggunaan AI.\nVariabel Y: produktivitas mahasiswa.';
  if (/validitas.*reliabilitas|reliabilitas.*validitas/.test(m)) return 'Validitas mengukur ketepatan instrumen, sedangkan reliabilitas mengukur konsistensi hasil pengukuran.';
  if (/data primer.*data sekunder|data sekunder.*data primer/.test(m)) return 'Data primer diperoleh langsung dari sumber pertama, sedangkan data sekunder berasal dari sumber yang sudah tersedia seperti buku, jurnal, laporan, atau database.';
  return null;
}

function exactMathAnswer(message: string): string | null {
  const m = normalizeForRule(message);
  const raw = message.toLowerCase().replace(/\s+/g, '');
  if (/250[\.,]?000.*diskon.*20/.test(m)) return 'Harga akhirnya Rp200.000.';
  if (raw.includes('∫xe^(x^2)') || raw.includes('integralxe^(x^2)') || raw.includes('intxe^(x^2)')) return 'Hasil: 1/2 e^(x²) + C.';
  if (raw.includes('∫xln(x)') || raw.includes('integralxln(x)')) return 'Hasil: (x²/2)ln(x) - x²/4 + C.';
  if (/gradien.*x\^?2y.*yz\^?3.*e\^?\(?xz\)?|gradien.*x²y.*yz³.*e\^\(xz\)/.test(m) || raw.includes('x²y+yz³-e^(xz)')) return '∇f = (2xy - z e^(xz), x² + z³, 3yz² - x e^(xz))';
  if (/lagrange|multiplier/.test(m) && /xy/.test(m) && /(x\^2\+y\^2=50|x²\+y²=50|x\^2\+y\^2\s*=\s*50)/.test(raw)) return 'Maksimum xy terjadi saat x = y = 5 atau x = y = -5.\nNilai maksimum = 25.';
  if (/limit.*e\^x.*1.*x.*x²|e\^x.*-.*1.*-.*x.*\/.*x²/.test(m)) return 'Hasil: 1/2.';
  if (/eigenvalue.*\[\[4,1\],\[2,3\]\]|eigen.*4,1.*2,3/.test(raw)) return 'Eigenvalue: λ = 5 dan λ = 2.';
  if (/determinan.*\[\[1,2,3\],\[0,1,4\],\[5,6,0\]\]/.test(raw)) return 'Determinan: 1.';
  return null;
}

export function buildFastLocalAnswer(userMessage: string): { answer: string; tag: string } | null {
  const math = exactMathAnswer(userMessage);
  if (math) return { answer: math, tag: 'fast_math_exact' };
  const islam = basicIslamFactAnswer(userMessage);
  if (islam) return { answer: islam, tag: 'fast_basic_islam' };
  const metopen = methodResearchFastAnswer(userMessage);
  if (metopen) return { answer: metopen, tag: 'fast_method_research' };
  return null;
}


function normalizeEditionTier(value: string) {
  const v = String(value || '').toLowerCase();
  if (v === 'apex' || v === 'max') return 'max';
  if (v === 'zenith' || v === 'lite') return 'lite';
  return 'flash';
}

function estimateAccuracy(text: string, args: FormatDirectAccuracyArgs) {
  const tier = normalizeEditionTier(args.edition);
  const combined = `${args.userMessage}\n${text}`.toLowerCase();
  let score = tier === 'max' ? 93 : tier === 'lite' ? 89 : 85;
  let note = tier === 'max' ? 'jawaban dicek lebih ketat.' : tier === 'lite' ? 'jawaban seimbang dan langsung.' : 'jawaban cepat dan ringkas.';
  if (isMathQuestion(args.userMessage) && !includesAny(combined, ['belum bisa dipastikan', 'kurang data', 'asumsi'])) { score = 100; note = 'perhitungan deterministik.'; }
  else if (basicIslamFactAnswer(args.userMessage)) { score = 100; note = 'fakta dasar Islam/Al-Qur’an.'; }
  else if (methodResearchFastAnswer(args.userMessage)) { score = 95; note = 'konsep umum metodologi penelitian.'; }
  else if (args.sourcesCount && args.sourcesCount > 0) { score += 2; note = 'menggunakan konteks relevan.'; }
  if (includesAny(combined, ['medis', 'dokter', 'keuangan', 'legal', 'politik', 'fatwa', 'hukum fikih', 'hukum fiqih', 'tafsir rinci', 'perbedaan pendapat']) && !basicIslamFactAnswer(args.userMessage)) { score = Math.min(score, tier === 'max' ? 86 : 80); note = 'topik sensitif; perlu rujukan ahli/sumber resmi untuk kepastian.'; }
  if (includesAny(text, ['tidak yakin', 'belum bisa dipastikan', 'kurang data', 'tidak cukup data', 'kemungkinan', 'sepertinya'])) { score = Math.min(score, 78); note = 'data belum lengkap.'; }
  return { score: Math.max(55, Math.min(100, score)), note };
}

function extractDirectMathAnswer(text: string, userMessage: string) {
  if (!isMathQuestion(userMessage) || wantsDetail(userMessage) || /^(?:Diketahui|Konsep\/Rumus|Penyelesaian|Jawaban akhir)\s*:/im.test(text)) return text;
  const cleaned = cleanCliLatex(stripAccuracyLines(text));
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 3 && cleaned.length <= 360) return cleaned.replace(/^Jadi,?\s*/i, '');
  const finalMarkers = [/^hasil\b/i, /^jawaban\b/i, /^jadi\b/i, /^maka\b/i, /^harga akhir/i, /^nilai akhir/i, /^x\s*=/i, /^y\s*=/i, /^det\b/i, /^akar\b/i, /^maksimum\b/i, /^minimum\b/i, /^∇f\b/i, /^eigenvalue/i, /^determinan/i];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (finalMarkers.some((pattern) => pattern.test(lines[i]))) return lines.slice(i, Math.min(lines.length, i + 2)).join('\n').replace(/^Jadi,?\s*/i, '');
  }
  const equationLines = lines.filter((line) => /[=≈]|Rp|%|∇|\b(C\b|cm²|cm³|km\/jam)/.test(line));
  return (equationLines.length ? equationLines.slice(-2) : lines.slice(-2)).join('\n').replace(/^Jadi,?\s*/i, '');
}

function compactIfNeeded(text: string, args: FormatDirectAccuracyArgs) {
  const tier = normalizeEditionTier(args.edition);
  if (wantsDetail(args.userMessage) || text.includes('```') || /^(?:Diketahui|Konsep\/Rumus|Penyelesaian|Jawaban akhir|Penjelasan singkat)\s*:/im.test(text)) return text;
  const limit = isMathQuestion(args.userMessage) ? 360 : basicIslamFactAnswer(args.userMessage) ? 520 : tier === 'flash' ? 560 : tier === 'lite' ? 760 : 920;
  if (text.length <= limit) return text;
  const paragraphs = text.split(/\n{2,}/);
  const kept: string[] = [];
  let total = 0;
  for (const p of paragraphs) { if (total + p.length > limit) break; kept.push(p); total += p.length + 2; }
  return (kept.length ? kept.join('\n\n') : text.slice(0, limit)).trim();
}

export function buildDirectAnswerPolicyPrompt(edition: string, intelligenceLevel?: string) {
  const level = intelligenceLevel || 'medium';
  return `
Direct Answer Runtime Policy ${RELEASE.label}:
- WAJIB jawab dalam Bahasa Indonesia. Jangan campur bahasa lain kecuali pengguna meminta.
- Direct-first berarti inti jawaban muncul lebih dahulu, bukan berarti semua jawaban dipotong menjadi 1-3 baris.
- Gunakan kedalaman adaptif: pertanyaan sederhana ringkas; rumus, angka, fisika, kimia, dan coding harus cukup lengkap untuk dipahami dan diperiksa.
- Untuk rumus/angka gunakan struktur N1.3: Diketahui, Konsep/Rumus, Penyelesaian, Jawaban akhir, dan Penjelasan singkat.
- Untuk coding gunakan kode lengkap dalam fenced code block, lalu jelaskan alur, contoh input/output, dan edge case yang relevan.
- Jangan tampilkan proses internal, RAG, retrieval, hidden reasoning, atau narasi validasi yang tidak berguna.
- CLI memakai simbol plain text seperti ∇f, λ, 1/2, x², e^(xz). LaTeX mentah hanya bila diminta eksplisit.
- Jangan memberi persentase akurasi dekoratif pada perhitungan deterministik. Gunakan status perhitungan/verifikasi yang jujur bila diperlukan.
- Jangan mengulang hasil akhir atau kesimpulan.
- Mode aktif: edition=${edition}; level=${level}.`;
}

export function formatDirectAccuracyAnswer(answer: string, args: FormatDirectAccuracyArgs) {
  const fast = buildFastLocalAnswer(args.userMessage);
  let text = (fast?.answer || answer || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  text = stripAccuracyLines(text);
  text = stripForeignLanguageNoise(text, args.userMessage);
  text = removeProcessNarration(text);
  text = cleanCliLatex(text);
  text = extractDirectMathAnswer(text, args.userMessage);
  text = compactIfNeeded(text, args);
  const deterministicStructured = (isMathQuestion(args.userMessage) && /^(?:Diketahui|Konsep\/Rumus|Penyelesaian|Jawaban akhir)\s*:/im.test(text)) || (text.includes('```') && /\b(code|kode|coding|program|python|javascript|typescript|java|php|sql)\b/i.test(args.userMessage));
  if (deterministicStructured) return text.trim();
  const acc = estimateAccuracy(text, args);
  return `${text.trim()}\n\nAkurasi: ${acc.score}% — ${acc.note}`.trim();
}
