// nusamind-audit-ignore-file: memuat contoh teks permintaan keamanan untuk deteksi topik
import { auditSnippet } from './security-audit';
import type { Finding } from './security-audit';

const SECURITY_TOPICS: Array<[string, RegExp]> = [
  ['kerentanan', /\b(celah|kerentanan|vulnerab\w*|exploit\w*|eksploit\w*|cve-\d{4}-\d+|zero[- ]?day|patch management|hardening|harden)\b/i],
  ['pengujian', /\b(pentest\w*|penetration test\w*|red team|blue team|purple team|bug bounty|threat model\w*|pemodelan ancaman|stride|attack surface|permukaan serangan)\b/i],
  ['serangan-web', /\b(xss|sql ?injection|csrf|ssrf|rce|idor|lfi|rfi|xxe|path traversal|command injection|prototype pollution|clickjacking|open redirect|deserialis\w+)\b/i],
  ['owasp', /\b(owasp|cwe-\d+|asvs|sast|dast|sca|sbom|supply chain|rantai pasok perangkat lunak)\b/i],
  ['kriptografi-auth', /\b(enkripsi|dekripsi|kriptograf\w*|tls|ssl|jwt|oauth|oidc|saml|sso|mfa|2fa|hash(?:ing)? password|bcrypt|argon2|secret management|vault|rotasi (?:kunci|secret|token))\b/i],
  ['infrastruktur', /\b(firewall|waf|ids|ips|siem|edr|iptables|nftables|ufw|ssh|sshd|fail2ban|zero trust|least privilege|hak akses minimum|segmentasi jaringan|vpn|bastion|dmz)\b/i],
  ['operasi-keamanan', /\b(incident response|respons insiden|forensik\w*|forensic\w*|threat hunting|ioc|indicator of compromise|log analysis|analisis log|malware analysis|analisis malware|ransomware|phishing|soc|keamanan siber|cyber ?security|keamanan (?:aplikasi|sistem|jaringan|server|api|cloud|web|data|informasi))\b/i],
  ['audit', /\b(audit keamanan|security review|code review keamanan|secure coding|kebocoran (?:data|secret|kredensial)|credential leak|secret leak|dependency (?:audit|scan)|npm audit)\b/i],
];

const REVIEW_INTENT = /\b(celah|kerentanan|vulnerab\w*|aman(?:kah)?|keamanan|security|audit|review|cek|periksa|analisis|analyze|bug|risiko|risk|hardening)\b/i;

export type SecurityPartnerContext = {
  active: boolean;
  topics: string[];
  snippetFindings: Finding[];
  context: string;
};

export function extractCodeBlocks(message: string): Array<{ lang: string; code: string }> {
  const blocks: Array<{ lang: string; code: string }> = [];
  for (const m of message.matchAll(/```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)```/g)) blocks.push({ lang: m[1] ?? '', code: m[2] ?? '' });
  return blocks;
}

const INSTRUCTION = `NusaMind Security Partner (N1.5.1):
- Peran: mitra keamanan hands-on untuk aplikasi, server, jaringan, cloud, dan pipeline milik pengguna. Anggap pengguna adalah pemilik atau penguji berizin kecuali ada tanda sebaliknya, dan jawab selengkap yang berguna.
- Bekerja seperti praktisi: konkret, berbasis bukti, tanpa ceramah. Urutan: (1) aset dan model ancaman singkat, (2) celah atau risiko beserta lokasi/buktinya, (3) dampak dan tingkat keparahan, (4) perbaikan minimal berupa kode atau konfigurasi dalam fenced code block berlabel bahasa, (5) cara memverifikasi bahwa perbaikan bekerja, (6) risiko yang tersisa.
- Klasifikasikan dengan CWE dan OWASP Top 10:2025 bila yakin. Jangan mengarang nomor CVE, versi rentan, atau tautan; bila tidak yakin, katakan perlu diperiksa.
- Bedakan fakta yang terlihat di kode dari dugaan, dan sebut kemungkinan false positive.
- Untuk validasi aktif, arahkan ke lingkungan milik sendiri atau lab dengan alat standar dan jelaskan langkahnya. NusaMind sendiri tidak memindai jaringan dan tidak punya akses web, jadi jangan mengaku sudah mengecek CVE terbaru.`;

function describe(f: Finding, offset = 0) {
  return `- [${f.severity}/${f.confidence}] ${f.ruleId} baris ${f.line + offset}: ${f.title}${f.cwe ? ` (CWE-${f.cwe}, ${f.owasp})` : ` (${f.owasp})`}. Perbaikan: ${f.fix}`;
}

/** Konteks tambahan untuk model; string kosong bila pesan tidak berkaitan dengan keamanan. Tidak pernah menolak permintaan. */
export function buildSecurityPartnerContext(message: string): SecurityPartnerContext {
  const text = String(message || '');
  const blocks = extractCodeBlocks(text);
  const prose = text.replace(/```[\s\S]*?```/g, ' ');
  const topics = SECURITY_TOPICS.filter(([, re]) => re.test(prose)).map(([name]) => name);
  const reviewingCode = blocks.length > 0 && REVIEW_INTENT.test(prose);
  if (!topics.length && !reviewingCode) return { active: false, topics: [], snippetFindings: [], context: '' };

  const snippetFindings: Finding[] = [];
  if (reviewingCode) {
    for (const block of blocks.slice(0, 6)) {
      if (block.code.length > 200_000) continue;
      const found = auditSnippet(block.code, block.lang);
      if (found) snippetFindings.push(...found.filter((f) => f.severity !== 'info'));
    }
  }
  const parts = [INSTRUCTION];
  if (reviewingCode) {
    parts.push(snippetFindings.length
      ? `HASIL PEMINDAI ATURAN STATIS (pasif, dari kode yang ditempel; petunjuk, bukan kesimpulan):\n${snippetFindings.slice(0, 15).map((f) => describe(f)).join('\n')}\nVerifikasi tiap butir pada kode, jelaskan dampaknya, tambahkan celah logika yang tidak dapat ditangkap pola, dan jangan menyatakan sisanya aman.`
      : 'Pemindai aturan statis tidak menemukan pola pada kode yang ditempel. Itu bukan bukti kode aman; lakukan telaah manual atas validasi input, otorisasi, penanganan rahasia, dan alur data.');
  }
  return { active: true, topics, snippetFindings, context: parts.join('\n\n') };
}
