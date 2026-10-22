
const superscript: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
};

function sup(value: string) {
  return value.split('').map((x) => superscript[x] || x).join('');
}

function fractions(text: string) {
  let out = text;
  for (let i = 0; i < 12; i += 1) {
    const next = out.replace(/\\(?:d?frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1) / ($2)');
    if (next === out) break;
    out = next;
  }
  return out;
}

function renderMatrix(body: string) {
  const rows = body.split(/\\\\/).map((row) => row.split('&').map((cell) => cell.trim()).join(' | '));
  return rows.map((row) => `[ ${row} ]`).join('\n');
}

function cleanMathSegment(input: string) {
  let out = input
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\\\[([\s\S]*?)\\\]/g, '$1')
    .replace(/\\\((.*?)\\\)/g, '$1')
    .replace(/\\begin\{(?:bmatrix|pmatrix|matrix)\}([\s\S]*?)\\end\{(?:bmatrix|pmatrix|matrix)\}/g, (_, body) => renderMatrix(String(body)))
    .replace(/\\begin\{(?:align\*?|aligned|equation\*?)\}/g, '')
    .replace(/\\end\{(?:align\*?|aligned|equation\*?)\}/g, '')
    .replace(/\\\\/g, '\n');

  out = fractions(out);

  out = out
    .replace(/\\sqrt\[([^\]]+)\]\{([^{}]+)\}/g, 'root_$1($2)')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
    .replace(/\\(?:text|mathrm|mathbf|operatorname)\{([^{}]+)\}/g, '$1')
    .replace(/\\(?:times|cdot)/g, ' x ')
    .replace(/\\div/g, ' / ')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\(?:rightarrow|to)/g, '→')
    .replace(/\\sum/g, 'Σ')
    .replace(/\\prod/g, 'Π')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi/g, 'π')
    .replace(/\\partial/g, '∂')
    .replace(/\\nabla/g, '∇')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\left|\\right/g, '')
    .replace(/\\%/g, '%')
    .replace(/\\[,;:!]/g, ' ');

  out = out
    .replace(/([A-Za-z0-9)])\^\{([0-9+\-=()]+)\}/g, (_, a, b) => a + sup(b))
    .replace(/([A-Za-z0-9)])\^([0-9])/g, (_, a, b) => a + sup(b))
    .replace(/_\{([^{}]+)\}/g, '_$1')
    .replace(/\\[A-Za-z]+/g, '')
    .replace(/\{([^{}]+)\}/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return out;
}

type ProtectedBlock = { token: string; value: string };

function protectNonMathBlocks(input: string): { masked: string; blocks: ProtectedBlock[] } {
  let masked = String(input || '');
  const blocks: ProtectedBlock[] = [];
  const protect = (pattern: RegExp) => {
    masked = masked.replace(pattern, (value) => {
      const token = `@@NM_BLOCK_${blocks.length}@@`;
      blocks.push({ token, value });
      return token;
    });
  };

  protect(/```[\s\S]*?```/g);
  protect(/`[^`\n]+`/g);
  protect(/https?:\/\/[^\s<>()]+/gi);
  protect(/\b[A-Za-z]:\\(?:[^\\\r\n:*?"<>|]+\\)*[^\\\r\n:*?"<>|]*/g);
  protect(/\/(?:\\.|[^\/\r\n])+\/[gimsuy]*/g);
  protect(/^[ \t]*[\{\[](?=[^\r\n]*["'][^"']+["']\s*:)[^\r\n]*$/gm);
  protect(/^[^\r\n]*[\u0600-\u06FF][^\r\n]*$/gm);
  return { masked, blocks };
}

function restoreNonMathBlocks(masked: string, blocks: ProtectedBlock[]): string {
  let output = masked;
  for (const block of blocks) output = output.replaceAll(block.token, block.value);
  return output;
}

export function stripRawLatex(input: string) {
  const protectedInput = protectNonMathBlocks(String(input || ''));
  const cleaned = cleanMathSegment(protectedInput.masked);
  return restoreNonMathBlocks(cleaned, protectedInput.blocks).trim();
}

export function wantsLatex(question: string, answerMode = '') {
  const q = `${question} ${answerMode}`;
  return /(?:format|gunakan|pakai|tampilkan|output).{0,28}latex|latex.{0,28}(?:format|gunakan|pakai|tampilkan|output)|\banswer_mode_latex\b/i.test(q);
}

function isCodingQuestion(question: string) {
  return /\b(code|kode|coding|program|python|javascript|typescript|java|php|c\+\+|sql|html|css|react|next(?:\.js)?|node(?:\.js)?|function|class|algoritma|debug|error|bug)\b|```/i.test(question);
}

function hasStructuredAcademicAnswer(text: string) {
  const hits = ['Diketahui', 'Konsep/Rumus', 'Penyelesaian', 'Jawaban akhir', 'Penjelasan singkat']
    .filter((label) => new RegExp(`^\\s*(?:#{1,6}\\s*)?${label}\\s*:?`, 'im').test(text)).length;
  return hits >= 2;
}

function hasBalancedCodeFence(text: string) {
  return (text.match(/```/g) || []).length % 2 === 0;
}

function codingLanguage(question: string) {
  if (/\bpython\b/i.test(question)) return 'python';
  if (/\btypescript|\btsx\b/i.test(question)) return 'typescript';
  if (/\bjavascript|\bnode(?:\.js)?|\breact\b/i.test(question)) return 'javascript';
  if (/\bphp\b/i.test(question)) return 'php';
  if (/\bjava\b/i.test(question)) return 'java';
  if (/\bc\+\+|\bcpp\b/i.test(question)) return 'cpp';
  if (/\bc#|\bcsharp\b/i.test(question)) return 'csharp';
  if (/\bsql\b/i.test(question)) return 'sql';
  if (/\bhtml\b/i.test(question)) return 'html';
  if (/\bcss\b/i.test(question)) return 'css';
  if (/\bbash|\bshell|\bpowershell\b/i.test(question)) return 'bash';
  return 'text';
}

function normalizeCodingBlocks(text: string, question: string) {
  if (!isCodingQuestion(question)) return text;
  let output = text;
  if (!hasBalancedCodeFence(output)) output = `${output.trim()}\n\n\`\`\``;
  const language = codingLanguage(question);
  output = output.replace(/```(?=\r?\n)/, `\`\`\`${language}`);
  return output;
}

function formulaQuestion(question: string) {
  return /(?:hitung|berapa|rumus|persamaan|probabilitas|integral|turunan|matriks|daya|gain|ber|bandwidth|premi|klaim|rasio|persen|%|=|dibagi|dikali|rata-rata|mean)/i.test(question);
}

function findResultLine(text: string) {
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return [...lines].reverse().find((line) =>
    /(?:hasil akhir|hasil|jawaban|jadi|maka|total|nilai|=)/i.test(line) &&
    /\d/.test(line) &&
    line.length < 240,
  );
}

function normalizeStatus(text: string) {
  return text
    .replace(/^\s*(Akurasi|Confidence)\s*:\s*\d{1,3}%\s*$/gim, '')
    .replace(/^\s*Status\s*:\s*(Verified Calculation|Calculation Verified)\s*$/gim, 'Status: Perhitungan terverifikasi')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function terminalSafeTables(text: string, width = 80) {
  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let table: string[] = [];

  const flush = () => {
    if (!table.length) return;
    const tooWide = table.some((line) => line.length > width);
    if (!tooWide) {
      output.push(...table);
    } else {
      const rows = table.filter((line) => !/^\s*\|?\s*:?-{3,}/.test(line));
      const cells = rows.map((line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
      const header = cells[0] || [];
      for (const row of cells.slice(1)) {
        row.forEach((cell, index) => output.push(`${header[index] || `Kolom ${index + 1}`}: ${cell}`));
        output.push('');
      }
    }
    table = [];
  };

  let fenced = false;
  for (const line of lines) {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      flush();
      fenced = !fenced;
      output.push(line);
    } else if (fenced) output.push(line);
    else if (line.includes('|') && line.split('|').length >= 3) table.push(line);
    else {
      flush();
      output.push(line);
    }
  }
  flush();
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function directTrim(text: string, edition: string) {
  if (text.includes('```') || hasStructuredAcademicAnswer(text)) return text;
  const max = edition === 'swift' ? 16 : edition === 'zenith' ? 28 : 40;
  const lines = text.split(/\r?\n/);
  return lines.slice(0, Math.min(lines.length, max)).join('\n');
}

export function formatFinalAnswer(answer: string, question = '', edition = 'swift', answerMode = 'auto') {
  if (wantsLatex(question, answerMode)) return String(answer || '').trim();

  let out = normalizeStatus(stripRawLatex(answer));
  const mode = String(answerMode || 'auto').toLowerCase();
  out = normalizeCodingBlocks(out, question);

  if (formulaQuestion(question) && !hasStructuredAcademicAnswer(out)) {
    const result = findResultLine(out);
    if (result && !/^\s*(?:hasil akhir|jawaban akhir)\s*:/im.test(out)) {
      const clean = result.replace(/^(?:hasil akhir|jawaban akhir|hasil|jawaban|jadi|maka)\s*:?-?\s*/i, '');
      out = `Jawaban akhir: ${clean}\n\n${out}`;
    }
  }

  const mayTrim = !isCodingQuestion(question) && !hasStructuredAcademicAnswer(out) && !/(steps|detailed|expert|academic|deep)/.test(mode);
  if (mayTrim && mode === 'direct') out = directTrim(out, edition);

  if (mode === 'copy') {
    out = out.replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*]\s+/gm, '- ');
  }

  out = terminalSafeTables(out, 88);
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function formatTextResponse(response: Response, question: string, edition: string, answerMode = 'auto') {
  if (!response.body) return response;
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  const transformed = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk) { buffer += decoder.decode(chunk, { stream: true }); },
    flush(controller) {
      buffer += decoder.decode();
      controller.enqueue(encoder.encode(formatFinalAnswer(buffer, question, edition, answerMode)));
    },
  }));

  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export const formulaTemplates = {
  math: ['Hasil akhir', 'Rumus', 'Substitusi', 'Status'],
  finance: ['Hasil akhir', 'Basis angka', 'Perhitungan', 'Asumsi', 'Status'],
  insurance: ['Hasil akhir', 'Gross/Net basis', 'Formula ID', 'Perhitungan', 'Guardrail', 'Status'],
  statistics: ['Hasil akhir', 'Data', 'Metode', 'Asumsi', 'Status'],
  telecom: ['Hasil akhir', 'Parameter', 'Rumus', 'Satuan', 'Kelayakan', 'Status'],
  engineering: ['Hasil akhir', 'Input', 'Rumus', 'Unit check', 'Status'],
};
