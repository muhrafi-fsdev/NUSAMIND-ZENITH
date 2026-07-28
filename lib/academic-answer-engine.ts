export type AcademicDomain = 'mathematics' | 'physics' | 'chemistry' | 'numeric' | 'coding' | 'general';
export type AnswerDepth = 'concise' | 'balanced' | 'detailed' | 'expert';

export type AcademicAnswerProfile = {
  domain: AcademicDomain;
  depth: AnswerDepth;
  deterministic: boolean;
  requiresFormulaStructure: boolean;
  requiresCodeBlock: boolean;
  requestedLanguage?: string;
};

const codingPattern = /\b(code|kode|coding|program|programming|python|javascript|typescript|java|php|c\+\+|c#|golang|rust|sql|html|css|react|next(?:\.js)?|node(?:\.js)?|function|class|array|loop|perulangan|algoritma|debug|error|bug|script)\b|```/i;
const physicsPattern = /\b(fisika|gaya|massa|percepatan|kecepatan|momentum|energi|daya|tegangan|arus|hambatan|frekuensi|gelombang|gravitasi|torsi|kinematika|newton|joule|watt|volt|ampere|ohm)\b/i;
const chemistryPattern = /\b(kimia|mol|molar|molaritas|stoikiometri|reaksi|asam|basa|ph|atom|molekul|unsur|senyawa|oksidasi|reduksi|entalpi|kesetimbangan|konsentrasi)\b/i;
const mathematicsPattern = /[∫√πλθ∞Σ∑∂]|\b(matematika|hitung|rumus|persamaan|fungsi|turunan|integral|limit|matriks|determinan|vektor|probabilitas|statistika|aljabar|trigonometri|logaritma|gradien|eigen|deret|faktorkan|sederhanakan)\b/i;
const numericPattern = /(?:\d[\d.,]*\s*[+\-*/×÷=^%]|[+\-*/×÷=^%]\s*\d)|\b(berapa|nilai|total|rata-rata|persen|rasio|konversi)\b/i;

function explicitDepth(question: string, answerMode = ''): AnswerDepth | null {
  const q = `${question} ${answerMode}`.toLowerCase();
  if (/\b(singkat|ringkas|langsung|concise|direct)\b/.test(q)) return 'concise';
  if (/\b(expert|mendalam|sangat lengkap|deep|analisis lengkap)\b/.test(q)) return 'expert';
  if (/\b(detail|lengkap|step by step|langkah demi langkah|jelaskan cara)\b/.test(q)) return 'detailed';
  if (/\b(seimbang|balanced|normal)\b/.test(q)) return 'balanced';
  return null;
}

export function classifyAcademicRequest(question: string, edition = 'swift', answerMode = 'auto'): AcademicAnswerProfile {
  const q = String(question || '');
  let domain: AcademicDomain = 'general';
  if (codingPattern.test(q)) domain = 'coding';
  else if (physicsPattern.test(q)) domain = 'physics';
  else if (chemistryPattern.test(q)) domain = 'chemistry';
  else if (mathematicsPattern.test(q)) domain = 'mathematics';
  else if (numericPattern.test(q)) domain = 'numeric';

  const editionDefault: AnswerDepth = edition === 'apex' ? 'expert' : edition === 'zenith' ? 'detailed' : 'balanced';
  const depth = explicitDepth(q, answerMode) || editionDefault;
  return {
    domain,
    depth,
    deterministic: domain !== 'general' && (domain !== 'coding' || /\b(output|hasil|trace|kompleksitas|benar|salah|error)\b/i.test(q)),
    requiresFormulaStructure: ['mathematics', 'physics', 'chemistry', 'numeric'].includes(domain),
    requiresCodeBlock: domain === 'coding',
  };
}

function formulaInstruction(depth: AnswerDepth) {
  const detail = depth === 'concise'
    ? 'Gunakan langkah minimum yang tetap dapat diperiksa.'
    : depth === 'balanced'
      ? 'Tunjukkan substitusi dan proses utama tanpa melebar.'
      : depth === 'detailed'
        ? 'Tunjukkan langkah runtut, satuan, dan pemeriksaan hasil.'
        : 'Tunjukkan derivasi, asumsi, satuan, alternatif bila relevan, dan verifikasi independen.';
  return `
FORMAT WAJIB UNTUK RUMUS/ANGKA:
1. Diketahui — tulis data yang diberikan beserta satuannya; lewati bagian ini bila memang tidak ada data numerik.
2. Konsep/Rumus yang digunakan — tulis rumus yang relevan dan arti variabel penting.
3. Penyelesaian — substitusi angka/simbol secara berurutan. Jangan melompati operasi penting.
4. Jawaban akhir — tulis hasil final paling jelas dan mudah ditemukan. Jangan menaruh hasil yang berbeda di tempat lain.
5. Penjelasan singkat — jelaskan makna hasil, satuan, atau alasan jawabannya benar.
${detail}
Gunakan simbol matematika yang terbaca seperti x², √, ∫, ∂, λ. Jangan keluarkan LaTeX mentah kecuali pengguna memintanya.`;
}

function codingInstruction(depth: AnswerDepth) {
  const extra = depth === 'concise'
    ? 'Penjelasan cukup pada logika utama dan satu contoh penggunaan.'
    : depth === 'balanced'
      ? 'Jelaskan alur, validasi input, dan contoh output.'
      : depth === 'detailed'
        ? 'Jelaskan setiap bagian penting, edge case, contoh output, dan kompleksitas bila relevan.'
        : 'Tambahkan alasan desain, edge case, kompleksitas, keamanan, pengujian, dan alternatif implementasi bila bermanfaat.';
  return `
FORMAT WAJIB UNTUK CODING:
1. Tujuan/inti solusi — satu paragraf pendek.
2. Kode lengkap — gunakan fenced code block dengan label bahasa yang benar, misalnya \`\`\`python. Kode harus utuh, konsisten, dan dapat dijalankan dengan perubahan minimum.
3. Cara kerja — jelaskan alur langkah demi langkah dengan bahasa natural, bukan format dataset.
4. Contoh input/output — berikan contoh nyata bila program menerima input atau menghasilkan output.
5. Catatan penting — jelaskan validasi, edge case, kompleksitas, dependency, atau risiko hanya jika relevan.
${extra}
Jangan memotong kode, jangan menaruh kode panjang sebagai teks biasa, dan jangan mengaku sudah menjalankan kode bila belum benar-benar diuji.`;
}

export function buildAcademicAnswerInstruction(question: string, edition = 'swift', answerMode = 'auto') {
  const profile = classifyAcademicRequest(question, edition, answerMode);
  const base = `
N1.3 Answer Quality & Academic Response Engine:
- Jawab natural seperti asisten manusia, bukan dataset atau template kaku.
- Kualitas lebih penting daripada panjang. Kuantitas penjelasan harus cukup untuk membuat jawaban dapat dipahami dan diperiksa.
- Jawaban sederhana tetap ringkas; jawaban akademik/coding wajib memiliki struktur yang sesuai.
- Jangan mengulang kesimpulan, jangan menambah teori yang tidak berhubungan, dan jangan membuat angka/output palsu.
- Bahasa utama: Bahasa Indonesia yang jelas dan mudah dipahami.
- Profil aktif: domain=${profile.domain}; depth=${profile.depth}; edition=${edition}.`;
  if (profile.requiresFormulaStructure) return base + formulaInstruction(profile.depth);
  if (profile.requiresCodeBlock) return base + codingInstruction(profile.depth);
  return base + '\nUntuk pertanyaan umum, jawab inti lebih dulu, lalu detail pendukung secukupnya.';
}

export function answerQualityStatus(edition = 'swift') {
  return {
    release: 'N1.3',
    edition,
    adaptiveDepth: true,
    formulaStructure: ['Diketahui', 'Konsep/Rumus', 'Penyelesaian', 'Jawaban akhir', 'Penjelasan singkat'],
    codingStructure: ['Tujuan', 'Kode lengkap', 'Cara kerja', 'Contoh input/output', 'Catatan penting'],
    rawLatexDefault: false,
    datasetStyleDefault: false,
  };
}
