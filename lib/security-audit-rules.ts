// nusamind-audit-ignore-file: berisi pola dan contoh kerentanan untuk pemindai ini sendiri
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'high' | 'medium' | 'low';
export type FileKind =
  | 'js' | 'python' | 'shell' | 'powershell' | 'batch' | 'dockerfile' | 'compose' | 'workflow'
  | 'nginx' | 'sshd' | 'package' | 'nextconfig' | 'env-example' | 'text';

/** Nama kategori mengikuti OWASP Top 10:2025 (owasp.org/Top10/2025/); SSRF digabung ke A01 pada edisi ini. */
export const OWASP = {
  A01: 'A01:2025 Broken Access Control',
  A02: 'A02:2025 Security Misconfiguration',
  A03: 'A03:2025 Software Supply Chain Failures',
  A04: 'A04:2025 Cryptographic Failures',
  A05: 'A05:2025 Injection',
  A06: 'A06:2025 Insecure Design',
  A07: 'A07:2025 Authentication Failures',
  A08: 'A08:2025 Software or Data Integrity Failures',
  A09: 'A09:2025 Security Logging & Alerting Failures',
  A10: 'A10:2025 Mishandling of Exceptional Conditions',
} as const;

/** Judul CWE yang dipakai, diverifikasi ke cwe.mitre.org (v4.20). */
export const CWE_TITLES: Record<number, string> = {
  22: "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
  78: "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
  79: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
  89: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
  94: "Improper Control of Generation of Code ('Code Injection')",
  95: "Improper Neutralization of Directives in Dynamically Evaluated Code ('Eval Injection')",
  200: 'Exposure of Sensitive Information to an Unauthorized Actor',
  208: 'Observable Timing Discrepancy',
  209: 'Generation of Error Message Containing Sensitive Information',
  250: 'Execution with Unnecessary Privileges',
  295: 'Improper Certificate Validation',
  306: 'Missing Authentication for Critical Function',
  319: 'Cleartext Transmission of Sensitive Information',
  321: 'Use of Hard-coded Cryptographic Key',
  327: 'Use of a Broken or Risky Cryptographic Algorithm',
  328: 'Use of Weak Hash',
  338: 'Use of Cryptographically Weak Pseudo-Random Number Generator (PRNG)',
  489: 'Active Debug Code',
  494: 'Download of Code Without Integrity Check',
  502: 'Deserialization of Untrusted Data',
  532: 'Insertion of Sensitive Information into Log File',
  548: 'Exposure of Information Through Directory Listing',
  614: "Sensitive Cookie in HTTPS Session Without 'Secure' Attribute",
  732: 'Incorrect Permission Assignment for Critical Resource',
  798: 'Use of Hard-coded Credentials',
  829: 'Inclusion of Functionality from Untrusted Control Sphere',
  918: 'Server-Side Request Forgery (SSRF)',
  942: 'Permissive Cross-domain Security Policy with Untrusted Domains',
  1004: "Sensitive Cookie Without 'HttpOnly' Flag",
  1321: "Improperly Controlled Modification of Object Prototype Attributes ('Prototype Pollution')",
};

export type LineRule = {
  id: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  cwe?: number;
  owasp: string;
  kinds: FileKind[];
  pattern: RegExp;
  /** Baris yang cocok dengan pola ini dilewati (mitigasi yang terlihat pada baris yang sama). */
  unless?: RegExp;
  check?: (line: string, match: RegExpExecArray) => boolean;
  /** Menyesuaikan severity/keyakinan menurut konteks baris (mis. nilai sensitif atau input permintaan terlihat). */
  adjust?: (line: string, match: RegExpExecArray) => { severity?: Severity; confidence?: Confidence };
  why: string;
  fix: string;
};

const CODE: FileKind[] = ['js'];
const PLACEHOLDER = /(?:ganti|change[-_]?(?:me|this|it)|replace[-_]?me|example|contoh|your[_-]|xxxx|<[^>]+>|process\.env|\$\{|\$\(|os\.environ|getenv|\*{3,}|placeholder|dummy|sample|redacted)/i;
/** Bentuk akses ke data permintaan (bukan sekadar kata "query" atau "input" sebagai nama parameter). */
const REQUEST_INPUT = /\b(?:req|request)\.(?:url|query|params|body|headers|nextUrl)\b|\bsearchParams\b|\bparams\.\w+|\b(?:body|query|formData)\.\w+|\bawait\s+(?:req|request)\.(?:json|text|formData)\s*\(/;

/** Teks argumen pertama dari pemanggilan fungsi yang kurung buka-nya berada di openIndex. */
export function firstArgument(line: string, openIndex: number): string {
  let depth = 0;
  let quote = '';
  for (let i = openIndex + 1; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) {
      if (depth === 0) return line.slice(openIndex + 1, i);
      depth -= 1;
    } else if (ch === ',' && depth === 0) return line.slice(openIndex + 1, i);
  }
  return line.slice(openIndex + 1);
}

export const SECRET_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  { id: 'private-key', label: 'private key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { id: 'aws-access-key', label: 'AWS access key ID', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'github-token', label: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { id: 'slack-token', label: 'Slack token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: 'google-api-key', label: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'stripe-live-key', label: 'Stripe live key', pattern: /\b[sr]k_live_[0-9a-zA-Z]{20,}\b/ },
  { id: 'openai-style-key', label: 'API key bergaya sk-', pattern: /\bsk-[A-Za-z0-9_-]{32,}\b/ },
  { id: 'jwt', label: 'JSON Web Token', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

export const LINE_RULES: LineRule[] = [
  /* ---------- secrets (semua jenis berkas teks) ---------- */
  {
    id: 'secret-private-key', title: 'Private key tertanam di berkas', severity: 'critical', confidence: 'high', cwe: 321, owasp: OWASP.A04,
    kinds: ['js', 'python', 'shell', 'powershell', 'batch', 'dockerfile', 'compose', 'workflow', 'nginx', 'sshd', 'package', 'nextconfig', 'env-example', 'text'],
    pattern: SECRET_PATTERNS[0].pattern,
    why: 'Siapa pun yang dapat membaca repositori dapat memakai kunci ini untuk menyamar atau mendekripsi data. Riwayat git menyimpannya selamanya.',
    fix: 'Cabut dan buat ulang kunci, simpan di secret manager atau variabel lingkungan, lalu hapus dari riwayat git (git filter-repo) dan anggap kunci lama bocor.',
  },
  {
    id: 'secret-provider-token', title: 'Token atau API key penyedia layanan tertanam', severity: 'critical', confidence: 'high', cwe: 798, owasp: OWASP.A04,
    kinds: ['js', 'python', 'shell', 'powershell', 'batch', 'dockerfile', 'compose', 'workflow', 'nginx', 'sshd', 'package', 'nextconfig', 'env-example', 'text'],
    pattern: /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|[sr]k_live_[0-9a-zA-Z]{20,}|sk-[A-Za-z0-9_-]{32,})\b/,
    why: 'Pola ini cocok dengan format kredensial penyedia layanan. Kredensial di dalam kode ikut tersalin ke setiap clone, fork, dan cache CI.',
    fix: 'Cabut token di dashboard penyedia sekarang, buat yang baru, dan muat dari variabel lingkungan. Aktifkan secret scanning di repositori.',
  },
  {
    id: 'secret-jwt', title: 'JSON Web Token tertanam', severity: 'medium', confidence: 'medium', cwe: 798, owasp: OWASP.A04,
    kinds: ['js', 'python', 'shell', 'powershell', 'batch', 'compose', 'workflow', 'text'],
    pattern: SECRET_PATTERNS[7].pattern,
    why: 'JWT yang masih berlaku dapat dipakai ulang oleh siapa pun yang memilikinya sampai kedaluwarsa.',
    fix: 'Pastikan ini bukan token sungguhan. Bila sungguhan, cabut sesinya dan jangan simpan token di berkas.',
  },
  {
    id: 'secret-assigned-credential', title: 'Kredensial literal pada penugasan variabel', severity: 'high', confidence: 'medium', cwe: 798, owasp: OWASP.A04,
    kinds: ['js', 'python', 'shell', 'powershell', 'batch', 'compose', 'workflow', 'package', 'nextconfig', 'text'],
    pattern: /\b[\w.-]*(?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key)[\w-]*["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i,
    unless: PLACEHOLDER,
    check: (_line, m) => {
      const value = m[1] ?? '';
      return (/\d/.test(value) && /[A-Za-z]/.test(value)) || value.length >= 24;
    },
    why: 'Nilai yang tampak seperti rahasia ditulis langsung di berkas sumber.',
    fix: 'Pindahkan ke variabel lingkungan atau secret manager. Bila nilainya sudah pernah ter-commit, ganti nilainya.',
  },

  /* ---------- JavaScript / TypeScript ---------- */
  {
    id: 'js-command-injection', title: 'Perintah OS dibangun dari string dinamis', severity: 'high', confidence: 'medium', cwe: 78, owasp: OWASP.A05,
    kinds: CODE, pattern: /(?:(?<![.\w$])exec|\b(?:child_process|childProcess|cp)\.exec|\bexecSync)\s*\(\s*(?:`[^`]*\$\{|[^)'"`]*["'`][^)]*\+|[A-Za-z_$][\w$.]*\s*[,)])/,
    unless: /execFile|execFileSync/,
    why: 'Bila bagian string berasal dari input pengguna, penyerang dapat menambahkan perintah lewat karakter shell seperti ; | & $( ).',
    fix: 'Pakai execFile/spawn dengan array argumen tanpa shell, validasi input dengan allowlist, dan jangan menyusun perintah dengan interpolasi.',
  },
  {
    id: 'js-shell-true', title: 'Proses anak dijalankan dengan shell: true', severity: 'medium', confidence: 'high', cwe: 78, owasp: OWASP.A05,
    kinds: CODE, pattern: /\bshell\s*:\s*true\b/,
    why: 'Opsi ini membuat argumen ditafsirkan shell sehingga injeksi perintah menjadi mungkin.',
    fix: 'Hapus shell: true dan berikan argumen sebagai array. Di Windows, panggil .cmd secara eksplisit bila perlu.',
  },
  {
    id: 'js-eval', title: 'Eksekusi kode dinamis (eval / new Function)', severity: 'high', confidence: 'high', cwe: 95, owasp: OWASP.A05,
    kinds: CODE, pattern: /(?<![.\w$])(?:eval\s*\(|new\s+Function\s*\()/,
    why: 'Kode yang dibangun saat runtime dapat dikendalikan penyerang bila ada bagian yang berasal dari input.',
    fix: 'Ganti dengan parser data (JSON.parse), peta fungsi (allowlist), atau logika eksplisit.',
  },
  {
    id: 'js-sql-injection', title: 'Query SQL dibangun dengan interpolasi string', severity: 'high', confidence: 'medium', cwe: 89, owasp: OWASP.A05,
    kinds: CODE,
    pattern: /\.(?:query|execute|run|prepare|all|get|exec|raw|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*(?:`[^`]*\b(?:select|insert|update|delete|where|from)\b[^`]*\$\{|["'][^"']*\b(?:select|insert|update|delete|where|from)\b[^"']*["']\s*\+)/i,
    adjust: (line) => (REQUEST_INPUT.test(line) ? { severity: 'high', confidence: 'high' } : { severity: 'medium', confidence: 'low' }),
    why: 'Nilai yang disisipkan langsung ke SQL dapat mengubah makna query (SQL injection). Bila yang disisipkan hanya klausa tetap yang dibuat kode sendiri (bukan dari input), ini false positive; verifikasi asal nilainya.',
    fix: 'Pakai parameterized query / prepared statement (placeholder ?, $1, atau :nama) dan jangan menyambung string.',
  },
  {
    id: 'js-xss-sink', title: 'Penulisan HTML mentah ke DOM', severity: 'medium', confidence: 'medium', cwe: 79, owasp: OWASP.A05,
    kinds: CODE, pattern: /\bdangerouslySetInnerHTML\b|\.(?:innerHTML|outerHTML)\s*=(?!=)|\bdocument\.write(?:ln)?\s*\(|\binsertAdjacentHTML\s*\(/,
    why: 'Bila isinya mengandung data pengguna yang tidak disanitasi, skrip penyerang berjalan di browser korban (XSS).',
    fix: 'Render sebagai teks (textContent atau JSX biasa). Bila HTML memang perlu, sanitasi dengan pustaka seperti DOMPurify dan terapkan Content-Security-Policy.',
  },
  {
    id: 'js-tls-verification-off', title: 'Verifikasi sertifikat TLS dimatikan', severity: 'high', confidence: 'high', cwe: 295, owasp: OWASP.A04,
    kinds: CODE, pattern: /\brejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED["']?\s*[=:]\s*["']?0/,
    why: 'Koneksi HTTPS menjadi rentan terhadap penyadapan dan pengubahan lalu lintas (man-in-the-middle).',
    fix: 'Hapus opsi ini. Untuk CA internal, tambahkan CA ke trust store (NODE_EXTRA_CA_CERTS) alih-alih mematikan verifikasi.',
  },
  {
    id: 'js-weak-hash', title: 'Hash lemah (MD5 / SHA-1)', severity: 'medium', confidence: 'medium', cwe: 328, owasp: OWASP.A04,
    kinds: CODE, pattern: /createHash\(\s*["'](?:md5|sha-?1)["']\s*\)/i,
    adjust: (line) => (/(?:password|passwd|token|secret|signature|hmac|auth|verify|integrity)/i.test(line) ? { severity: 'medium', confidence: 'high' } : { severity: 'low', confidence: 'low' }),
    why: 'MD5 dan SHA-1 rentan terhadap tabrakan, sehingga tidak layak untuk tanda tangan, integritas, atau penyimpanan kata sandi. Untuk id, cache key, atau deduplikasi non-keamanan, risikonya rendah.',
    fix: 'Pakai SHA-256 atau lebih untuk integritas, dan argon2id/scrypt/bcrypt untuk kata sandi. Untuk checksum non-keamanan, abaikan temuan ini.',
  },
  {
    id: 'js-weak-cipher', title: 'Algoritma enkripsi usang atau tanpa IV', severity: 'high', confidence: 'high', cwe: 327, owasp: OWASP.A04,
    kinds: CODE, pattern: /\bcreate(?:Cipher|Decipher)\s*\(|["'](?:aes-\d+-ecb|des(?:-ede3)?(?:-\w+)?|rc4)["']/i,
    why: 'createCipher tidak memakai IV acak, sedangkan ECB, DES, dan RC4 tidak aman untuk menyembunyikan pola data.',
    fix: 'Pakai AES-256-GCM dengan createCipheriv, IV acak 12 byte per pesan, dan kunci dari KDF atau secret manager.',
  },
  {
    id: 'js-insecure-random', title: 'Math.random dipakai untuk nilai sensitif', severity: 'medium', confidence: 'low', cwe: 338, owasp: OWASP.A04,
    kinds: CODE, pattern: /\bMath\.random\s*\(\)/,
    check: (line) => /(?:token|secret|password|passwd|session|nonce|otp|csrf|apikey|api_key|salt|reset)/i.test(line),
    why: 'Math.random dapat diprediksi sehingga token atau kode yang dihasilkannya dapat ditebak.',
    fix: 'Pakai crypto.randomBytes, crypto.randomUUID, atau crypto.randomInt.',
  },
  {
    id: 'js-secret-timing-compare', title: 'Perbandingan rahasia dengan === (timing attack)', severity: 'low', confidence: 'low', cwe: 208, owasp: OWASP.A07,
    kinds: CODE, pattern: /\b[\w.]*(?:token|secret|signature|hmac|apikey|api_key|password)\w*\s*(?:===|!==)\s*(?!undefined\b|null\b|typeof\b|true\b|false\b|["'`\d]|process\.env)[A-Za-z_$]/i,
    unless: /timingSafeEqual/,
    why: 'Perbandingan biasa berhenti pada karakter pertama yang berbeda, sehingga waktu respons dapat membocorkan nilai rahasia sedikit demi sedikit.',
    fix: 'Bandingkan dengan crypto.timingSafeEqual setelah memastikan panjang buffer sama.',
  },
  {
    id: 'js-cors-wildcard', title: 'CORS mengizinkan semua origin', severity: 'medium', confidence: 'medium', cwe: 942, owasp: OWASP.A02,
    kinds: CODE, pattern: /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']|\borigin\s*:\s*["']\*["']|\bcors\(\s*\)/i,
    why: 'Situs mana pun dapat membaca respons API dari browser pengguna. Berbahaya bila API memakai cookie atau data pribadi.',
    fix: 'Batasi ke daftar origin yang dikenal (allowlist) dan jangan menggabungkan wildcard dengan kredensial.',
  },
  {
    id: 'js-cookie-httponly-off', title: 'Cookie tanpa HttpOnly', severity: 'medium', confidence: 'high', cwe: 1004, owasp: OWASP.A07,
    kinds: CODE, pattern: /\bhttpOnly\s*:\s*false\b/,
    why: 'Skrip di halaman (misalnya lewat XSS) dapat membaca cookie sesi.',
    fix: 'Setel httpOnly: true untuk cookie sesi dan autentikasi.',
  },
  {
    id: 'js-cookie-secure-off', title: 'Cookie tanpa atribut Secure', severity: 'medium', confidence: 'high', cwe: 614, owasp: OWASP.A07,
    kinds: CODE, pattern: /\bsecure\s*:\s*false\b/,
    why: 'Cookie dapat terkirim lewat koneksi HTTP tanpa enkripsi.',
    fix: 'Setel secure: true di produksi dan tambahkan sameSite: "lax" atau "strict".',
  },
  {
    id: 'js-prototype-pollution', title: 'Penulisan langsung ke __proto__', severity: 'medium', confidence: 'medium', cwe: 1321, owasp: OWASP.A08,
    kinds: CODE, pattern: /\.__proto__\s*=|\[\s*["']__proto__["']\s*\]\s*=/,
    why: 'Mengubah prototipe objek dapat mengubah perilaku seluruh aplikasi dan membuka jalan ke eksekusi kode atau bypass otorisasi.',
    fix: 'Gunakan Object.create(null) atau Map, dan tolak kunci __proto__, constructor, dan prototype pada merge data tak tepercaya.',
  },
  {
    id: 'js-path-traversal', title: 'Operasi berkas memakai path dari input permintaan', severity: 'medium', confidence: 'low', cwe: 22, owasp: OWASP.A01,
    kinds: CODE,
    pattern: /\b(?:fs(?:\.promises)?\.|fsp\.)?(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream|createWriteStream|unlink|unlinkSync|rm|rmSync|readdir|readdirSync|copyFile|rename)\s*\(/,
    check: (line) => REQUEST_INPUT.test(line),
    unless: /assertAllowedPath|safeJoin|isSafeUploadName|resolveTrustedTarget|basename\(/,
    why: 'Path yang berasal dari permintaan dapat memuat ../ atau path absolut sehingga membaca atau menimpa berkas di luar folder yang diizinkan.',
    fix: 'Normalisasi dengan path.resolve lalu pastikan hasilnya berada di dalam root yang diizinkan (realpath), atau terima hanya nama berkas dari allowlist.',
  },
  {
    id: 'js-ssrf', title: 'Permintaan HTTP keluar memakai URL dari input', severity: 'medium', confidence: 'low', cwe: 918, owasp: OWASP.A01,
    kinds: CODE,
    pattern: /\b(?:fetch|axios(?:\.\w+)?|got|http\.get|https\.get|http\.request|https\.request)\s*\(/,
    check: (line, m) => {
      const arg = firstArgument(line, m.index + m[0].length - 1);
      return REQUEST_INPUT.test(arg) && !/^\s*["'][/#]/.test(arg);
    },
    unless: /validateUrl|isPrivateHost|allowlist|allowedHosts|safeFetch/i,
    why: 'Penyerang dapat membuat server mengakses layanan internal, metadata cloud (169.254.169.254), atau localhost.',
    fix: 'Validasi skema dan host dengan allowlist, blokir IP privat dan loopback setelah resolusi DNS, nonaktifkan redirect otomatis, dan beri timeout.',
  },
  {
    id: 'js-cleartext-http', title: 'Permintaan ke URL http:// non-lokal', severity: 'medium', confidence: 'medium', cwe: 319, owasp: OWASP.A04,
    kinds: CODE, pattern: /\b(?:fetch|axios(?:\.\w+)?|got)\s*\(\s*["'`]http:\/\/(?!localhost\b|127\.|0\.0\.0\.0|\[::1\]|host\.docker\.internal)/i,
    why: 'Data dan kredensial yang dikirim lewat HTTP polos dapat disadap atau diubah di jaringan.',
    fix: 'Gunakan https:// dan aktifkan HSTS pada sisi server.',
  },
  {
    id: 'js-public-env-secret', title: 'Nama variabel NEXT_PUBLIC_ memuat rahasia', severity: 'medium', confidence: 'medium', cwe: 200, owasp: OWASP.A02,
    kinds: ['js', 'env-example', 'nextconfig'], pattern: /\bNEXT_PUBLIC_\w*(?:SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE)\w*/i,
    why: 'Semua variabel berawalan NEXT_PUBLIC_ disisipkan ke bundel JavaScript yang dapat dibaca siapa saja.',
    fix: 'Hapus awalan NEXT_PUBLIC_ dan akses nilainya hanya di sisi server.',
  },
  {
    id: 'js-error-detail-leak', title: 'Stack trace atau detail error dikirim ke klien', severity: 'low', confidence: 'medium', cwe: 209, owasp: OWASP.A10,
    kinds: CODE, pattern: /\b(?:json|send|end)\s*\([^)]*\b(?:error|err|e)\.stack\b/,
    why: 'Stack trace membocorkan struktur kode, path server, dan versi pustaka yang membantu penyerang.',
    fix: 'Kirim pesan generik dan id korelasi ke klien, simpan detail hanya di log server.',
  },
  {
    id: 'js-sensitive-log', title: 'Data sensitif ditulis ke log', severity: 'low', confidence: 'low', cwe: 532, owasp: OWASP.A09,
    kinds: CODE, pattern: /\bconsole\.(?:log|info|debug|warn|error)\s*\(/,
    check: (line) => /\b(?:password|passwd|secret|api[_-]?key|authorization|bearer|access[_-]?token)\b/i.test(line) && !/["'`][^"'`]*(?:password|secret|token)[^"'`]*["'`]\s*\)/i.test(line),
    why: 'Log sering disimpan lama, dikirim ke layanan pihak ketiga, dan dibaca banyak orang.',
    fix: 'Jangan mencatat kredensial. Redaksi nilai sensitif sebelum logging dan batasi akses ke log.',
  },

  /* ---------- Python ---------- */
  {
    id: 'py-eval-exec', title: 'Eksekusi kode dinamis (eval / exec)', severity: 'high', confidence: 'high', cwe: 95, owasp: OWASP.A05,
    kinds: ['python'], pattern: /(?<![.\w])(?:eval|exec)\s*\(/,
    why: 'Kode yang dibangun dari string dapat dikendalikan penyerang bila ada bagian yang berasal dari input.',
    fix: 'Pakai ast.literal_eval untuk literal, atau peta fungsi dengan allowlist.',
  },
  {
    id: 'py-unsafe-deserialization', title: 'Deserialisasi tidak aman (pickle / marshal / yaml.load)', severity: 'high', confidence: 'high', cwe: 502, owasp: OWASP.A08,
    kinds: ['python'], pattern: /\b(?:pickle|cPickle|marshal|shelve|dill)\.loads?\s*\(|\byaml\.load\s*\(/,
    unless: /SafeLoader|safe_load/,
    why: 'Memuat data tak tepercaya lewat pickle atau yaml.load dapat mengeksekusi kode sembarang.',
    fix: 'Pakai JSON, yaml.safe_load, atau format data murni. Jangan pernah unpickle data dari luar.',
  },
  {
    id: 'py-command-injection', title: 'Perintah OS lewat shell', severity: 'high', confidence: 'medium', cwe: 78, owasp: OWASP.A05,
    kinds: ['python'], pattern: /\bos\.(?:system|popen)\s*\(|\bsubprocess\.\w+\([^)]*\bshell\s*=\s*True/,
    why: 'Argumen yang ditafsirkan shell memungkinkan injeksi perintah bila ada bagian dari input pengguna.',
    fix: 'Pakai subprocess.run([...]) dengan list argumen dan shell=False, serta validasi input.',
  },
  {
    id: 'py-sql-injection', title: 'Query SQL dibangun dengan format string', severity: 'high', confidence: 'medium', cwe: 89, owasp: OWASP.A05,
    kinds: ['python'], pattern: /\.execute(?:many)?\s*\(\s*(?:f["']|["'][^"']*["']\s*(?:%|\+|\.format\())/,
    why: 'Nilai yang disisipkan langsung ke SQL dapat mengubah makna query.',
    fix: 'Pakai parameter terikat: cursor.execute("... WHERE id = %s", (id,)).',
  },
  {
    id: 'py-tls-verification-off', title: 'Verifikasi sertifikat TLS dimatikan', severity: 'high', confidence: 'high', cwe: 295, owasp: OWASP.A04,
    kinds: ['python'], pattern: /\bverify\s*=\s*False\b|ssl\._create_unverified_context|CERT_NONE/,
    why: 'Koneksi HTTPS menjadi rentan terhadap man-in-the-middle.',
    fix: 'Hapus verify=False; untuk CA internal, arahkan ke bundle CA dengan verify="/path/ca.pem".',
  },
  {
    id: 'py-weak-hash', title: 'Hash lemah (MD5 / SHA-1)', severity: 'medium', confidence: 'medium', cwe: 328, owasp: OWASP.A04,
    kinds: ['python'], pattern: /\bhashlib\.(?:md5|sha1)\s*\(/,
    unless: /usedforsecurity\s*=\s*False/,
    adjust: (line) => (/(?:password|passwd|token|secret|signature|hmac|auth|verify|integrity)/i.test(line) ? { severity: 'medium', confidence: 'high' } : { severity: 'low', confidence: 'low' }),
    why: 'MD5 dan SHA-1 rentan tabrakan dan tidak layak untuk keamanan. Untuk id atau deduplikasi non-keamanan, risikonya rendah.',
    fix: 'Pakai hashlib.sha256 atau lebih, dan argon2/bcrypt/scrypt untuk kata sandi.',
  },
  {
    id: 'py-cors-wildcard', title: 'CORS mengizinkan semua origin', severity: 'medium', confidence: 'medium', cwe: 942, owasp: OWASP.A02,
    kinds: ['python'], pattern: /allow_origins\s*=\s*\[\s*["']\*["']\s*\]/,
    why: 'Situs mana pun dapat memanggil API dari browser pengguna.',
    fix: 'Isi allow_origins dengan daftar origin yang dikenal; jangan gabungkan "*" dengan allow_credentials=True.',
  },
  {
    id: 'py-debug-enabled', title: 'Mode debug aktif', severity: 'medium', confidence: 'medium', cwe: 489, owasp: OWASP.A02,
    kinds: ['python'], pattern: /\b(?:app\.run|uvicorn\.run)\s*\([^)]*\bdebug\s*=\s*True|\bDEBUG\s*=\s*True\b/,
    why: 'Debugger interaktif dan halaman error rinci dapat memberi penyerang eksekusi kode atau informasi internal.',
    fix: 'Nonaktifkan debug di luar mesin pengembangan dan atur lewat variabel lingkungan.',
  },
  {
    id: 'py-insecure-random', title: 'Modul random dipakai untuk nilai sensitif', severity: 'medium', confidence: 'low', cwe: 338, owasp: OWASP.A04,
    kinds: ['python'], pattern: /\brandom\.(?:random|randint|choice|choices|randrange)\s*\(/,
    check: (line) => /(?:token|secret|password|session|nonce|otp|csrf|api_?key|salt|reset)/i.test(line),
    why: 'Modul random tidak dirancang untuk kriptografi sehingga outputnya dapat diprediksi.',
    fix: 'Pakai modul secrets (secrets.token_urlsafe, secrets.choice).',
  },

  /* ---------- shell / PowerShell / batch ---------- */
  {
    id: 'shell-pipe-to-shell', title: 'Mengunduh lalu langsung mengeksekusi skrip', severity: 'high', confidence: 'high', cwe: 494, owasp: OWASP.A03,
    kinds: ['shell', 'batch', 'dockerfile', 'workflow', 'package'], pattern: /\b(?:curl|wget)\b[^\n|;]*\|\s*(?:sudo\s+)?(?:ba|z|da)?sh\b/,
    why: 'Isi yang diunduh dijalankan tanpa verifikasi integritas; bila sumber atau jalur jaringan dikompromikan, kode penyerang berjalan dengan hak Anda.',
    fix: 'Unduh ke berkas, verifikasi checksum atau tanda tangan, tinjau isinya, baru jalankan. Pin versi dan hash.',
  },
  {
    id: 'shell-world-writable', title: 'Izin berkas 777', severity: 'medium', confidence: 'high', cwe: 732, owasp: OWASP.A02,
    kinds: ['shell', 'dockerfile', 'workflow', 'package'], pattern: /\bchmod\s+(?:-R\s+)?0?777\b/,
    why: 'Semua pengguna di sistem dapat membaca, mengubah, dan mengeksekusi berkas ini.',
    fix: 'Berikan izin minimum, misalnya 750 untuk direktori dan 640 untuk berkas, dengan pemilik yang tepat.',
  },
  {
    id: 'ps-invoke-expression', title: 'PowerShell mengeksekusi string (Invoke-Expression / iex / EncodedCommand)', severity: 'high', confidence: 'medium', cwe: 94, owasp: OWASP.A05,
    kinds: ['powershell', 'batch'], pattern: /\bInvoke-Expression\b|(?<![\w-])iex\s+[$(]|\|\s*iex\b|-EncodedCommand\b|\s-enc\s/i,
    why: 'Kode dari string, unduhan, atau perintah ter-encode sulit diaudit dan sering dipakai untuk menyembunyikan muatan.',
    fix: 'Panggil cmdlet atau skrip secara langsung dengan parameter, dan tanda-tangani skrip bila perlu.',
  },
  {
    id: 'ps-execution-policy-bypass', title: 'Execution policy dilewati (Bypass / Unrestricted)', severity: 'low', confidence: 'high', owasp: OWASP.A02,
    kinds: ['powershell', 'batch'], pattern: /-ExecutionPolicy\s+(?:Bypass|Unrestricted)\b|Set-ExecutionPolicy\s+(?:Bypass|Unrestricted)\b/i,
    why: 'Menonaktifkan pagar eksekusi skrip menghilangkan lapisan perlindungan terhadap skrip yang tidak dikenal.',
    fix: 'Pakai -ExecutionPolicy RemoteSigned atau AllSigned, atau jalankan skrip yang sudah Anda tinjau dengan scope Process saja.',
  },

  /* ---------- Dockerfile & Compose ---------- */
  {
    id: 'docker-add-remote-url', title: 'ADD mengunduh dari URL', severity: 'medium', confidence: 'high', cwe: 494, owasp: OWASP.A03,
    kinds: ['dockerfile'], pattern: /^\s*ADD\s+https?:\/\//i,
    why: 'Isi dari URL tidak diverifikasi integritasnya dan dapat berubah antar build.',
    fix: 'Gunakan curl dengan --fail dan verifikasi checksum SHA-256, atau salin artefak yang sudah diverifikasi.',
  },
  {
    id: 'docker-secret-in-env', title: 'Rahasia pada instruksi ENV/ARG', severity: 'high', confidence: 'medium', cwe: 798, owasp: OWASP.A04,
    kinds: ['dockerfile'], pattern: /^\s*(?:ENV|ARG)\s+\w*(?:PASSWORD|SECRET|TOKEN|API_?KEY|PRIVATE_?KEY)\w*(?:\s*=\s*|\s+)(?!["']?\$\{?)\S{4,}/i,
    unless: PLACEHOLDER,
    why: 'Nilai ENV dan ARG tersimpan di layer image dan terlihat lewat docker history.',
    fix: 'Pakai BuildKit secret mounts (RUN --mount=type=secret) atau injeksi saat runtime dari secret manager.',
  },
  {
    id: 'compose-privileged', title: 'Kontainer berjalan privileged', severity: 'high', confidence: 'high', cwe: 250, owasp: OWASP.A02,
    kinds: ['compose'], pattern: /^\s*privileged\s*:\s*true\b/,
    why: 'Kontainer privileged hampir setara akses root ke host sehingga eskalasi dari kontainer ke host menjadi mudah.',
    fix: 'Hapus privileged dan beri hanya capability yang dibutuhkan (cap_add) dengan no-new-privileges.',
  },
  {
    id: 'compose-docker-socket', title: 'Docker socket dipasang ke kontainer', severity: 'high', confidence: 'high', cwe: 250, owasp: OWASP.A02,
    kinds: ['compose'], pattern: /\/var\/run\/docker\.sock/,
    why: 'Akses ke socket Docker setara kendali penuh atas host.',
    fix: 'Hindari memasang socket; bila wajib, pakai docker-socket-proxy dengan izin terbatas baca-saja.',
  },
  {
    id: 'compose-host-network', title: 'Kontainer memakai jaringan host', severity: 'medium', confidence: 'high', owasp: OWASP.A02,
    kinds: ['compose'], pattern: /^\s*network_mode\s*:\s*["']?host\b/,
    why: 'Isolasi jaringan kontainer hilang sehingga semua port host dapat dijangkau.',
    fix: 'Pakai jaringan bridge dan publikasikan hanya port yang diperlukan.',
  },
  {
    id: 'compose-db-port-public', title: 'Port basis data dipublikasikan ke semua antarmuka', severity: 'medium', confidence: 'medium', owasp: OWASP.A02,
    kinds: ['compose'], pattern: /^\s*-\s*["']?(?:0\.0\.0\.0:)?(?:3306|5432|6379|27017|9200|11211)\s*:\s*\d+/,
    why: 'Basis data yang terbuka ke jaringan menjadi sasaran brute force dan eksploitasi.',
    fix: 'Ikat ke loopback ("127.0.0.1:5432:5432") atau jangan publikasikan port sama sekali.',
  },
  {
    id: 'compose-literal-password', title: 'Kata sandi literal pada konfigurasi Compose', severity: 'medium', confidence: 'medium', cwe: 798, owasp: OWASP.A04,
    kinds: ['compose'], pattern: /^\s*-?\s*\w*(?:PASSWORD|SECRET|TOKEN|API_?KEY)\w*\s*[:=]\s*(?!\$\{)["']?[^\s"'$]{4,}/i,
    unless: PLACEHOLDER,
    why: 'Berkas Compose biasanya masuk repositori sehingga kata sandi ikut tersebar.',
    fix: 'Pakai env_file yang tidak di-commit, Docker secrets, atau variabel ${VAR} dari lingkungan.',
  },

  {
    id: 'compose-default-credential', title: 'Kredensial bawaan yang diketahui publik pada Compose', severity: 'medium', confidence: 'medium', cwe: 798, owasp: OWASP.A07,
    kinds: ['compose'], pattern: /^\s*-?\s*\w*(?:PASSWORD|SECRET|TOKEN|API_?KEY)\w*\s*[:=]\s*["']?(?:change[-_]?(?:me|this|it)[\w-]*|default[\w-]*|admin(?:123)?|password(?:123)?|secret|12345\w*|test(?:ing)?|replace[-_]?me[\w-]*)["']?\s*$/i,
    why: 'Nilai ini adalah placeholder yang tertulis di repositori publik, sehingga siapa pun mengetahuinya. docker compose up menjalankan layanan dengan kredensial itu apa adanya, dan pemeriksaan token yang bergantung padanya praktis tidak melindungi apa pun.',
    fix: 'Ganti dengan nilai acak panjang dari variabel lingkungan atau env_file yang tidak di-commit (mis. ${ADMIN_TOKEN:?wajib diisi}) sehingga compose gagal start bila tidak diisi.',
  },
  {
    id: 'compose-port-all-interfaces', title: 'Port dipublikasikan ke semua antarmuka jaringan', severity: 'low', confidence: 'medium', owasp: OWASP.A02,
    kinds: ['compose'], pattern: /^\s*-\s*["']?(?!(?:127\.0\.0\.1|localhost|\[::1\]):)(?:\d{1,3}(?:\.\d{1,3}){3}:)?\d{2,5}:\d{2,5}(?:\/\w+)?["']?\s*$/,
    unless: /^\s*-\s*["']?(?:3306|5432|6379|27017|9200|11211):/,
    why: 'Tanpa alamat IP, Docker mengikat port ke 0.0.0.0 sehingga layanan dapat dijangkau dari seluruh jaringan (LAN atau internet bila host terbuka). Untuk aplikasi yang dimaksudkan lokal, ini memperluas permukaan serangan.',
    fix: 'Ikat ke loopback ("127.0.0.1:3000:3000") atau letakkan di belakang reverse proxy dengan autentikasi dan TLS.',
  },

  /* ---------- CI (GitHub Actions) ---------- */
  {
    id: 'ci-script-injection', title: 'Data event GitHub disisipkan ke langkah run', severity: 'high', confidence: 'medium', cwe: 94, owasp: OWASP.A05,
    kinds: ['workflow'], pattern: /\$\{\{\s*github\.(?:event\.(?:issue|pull_request|comment|review|head_commit|commits|workflow_run\.head_branch)|head_ref)[^}]*\}\}/,
    why: 'Judul PR, nama branch, atau isi komentar dikendalikan penyerang; bila langsung disisipkan ke skrip shell, perintahnya ikut dieksekusi.',
    fix: 'Teruskan nilai lewat env: dan rujuk sebagai "$NAMA" di dalam skrip, jangan interpolasi ${{ }} langsung di run.',
  },
  {
    id: 'ci-pull-request-target', title: 'Pemicu pull_request_target', severity: 'medium', confidence: 'medium', cwe: 829, owasp: OWASP.A03,
    kinds: ['workflow'], pattern: /^\s*pull_request_target\s*:|\bon\s*:\s*\[?[^\n]*pull_request_target/,
    why: 'Workflow ini berjalan dengan secret repositori; bila ikut mengeksekusi kode dari fork, penyerang dapat mencuri secret.',
    fix: 'Jangan checkout atau menjalankan kode PR di workflow ini. Pakai pull_request, atau pisahkan langkah berhak-akses dari langkah yang membangun kode tak tepercaya.',
  },
  {
    id: 'ci-unpinned-action', title: 'Action pihak ketiga tidak di-pin ke commit SHA', severity: 'low', confidence: 'medium', cwe: 829, owasp: OWASP.A03,
    kinds: ['workflow'], pattern: /^\s*-?\s*uses\s*:\s*(?!actions\/|\.\/|docker:\/\/)[\w.-]+\/[\w./-]+@(?![0-9a-f]{40}\b)\S+/,
    why: 'Tag dan branch dapat dipindahkan; bila pemilik action dikompromikan, kode berbahaya berjalan di pipeline Anda.',
    fix: 'Pin ke SHA commit lengkap (komentari versinya) dan perbarui lewat Dependabot atau Renovate.',
  },
  {
    id: 'ci-write-all', title: 'Workflow meminta izin write-all', severity: 'medium', confidence: 'high', owasp: OWASP.A02,
    kinds: ['workflow'], pattern: /^\s*permissions\s*:\s*write-all\b/,
    why: 'Token GITHUB_TOKEN dengan hak tulis penuh memperbesar dampak bila satu langkah dikompromikan.',
    fix: 'Deklarasikan permissions minimum per job, misalnya contents: read.',
  },

  /* ---------- server config ---------- */
  {
    id: 'nginx-autoindex', title: 'Directory listing nginx aktif', severity: 'medium', confidence: 'high', cwe: 548, owasp: OWASP.A02,
    kinds: ['nginx'], pattern: /^\s*autoindex\s+on\b/,
    why: 'Daftar berkas terbuka sehingga berkas yang tidak dimaksudkan publik dapat ditemukan.',
    fix: 'Setel autoindex off dan sajikan hanya direktori yang memang publik.',
  },
  {
    id: 'nginx-legacy-tls', title: 'Protokol TLS usang diizinkan', severity: 'medium', confidence: 'high', cwe: 327, owasp: OWASP.A04,
    kinds: ['nginx'], pattern: /^\s*ssl_protocols\b[^;]*\b(?:SSLv2|SSLv3|TLSv1|TLSv1\.1)\b(?!\.\d)/i,
    why: 'TLS 1.0 dan 1.1 sudah usang dan memiliki kelemahan yang diketahui.',
    fix: 'Setel ssl_protocols TLSv1.2 TLSv1.3.',
  },
  {
    id: 'nginx-server-tokens', title: 'Versi nginx terlihat di respons', severity: 'info', confidence: 'high', owasp: OWASP.A02,
    kinds: ['nginx'], pattern: /^\s*server_tokens\s+on\b/,
    why: 'Versi server mempermudah penyerang mencocokkan kerentanan yang diketahui.',
    fix: 'Setel server_tokens off.',
  },
  {
    id: 'sshd-root-login', title: 'Login root lewat SSH diizinkan', severity: 'high', confidence: 'high', owasp: OWASP.A07,
    kinds: ['sshd'], pattern: /^\s*PermitRootLogin\s+yes\b/i,
    why: 'Akun root adalah target brute force utama dan satu kata sandi bocor berarti kendali penuh.',
    fix: 'Setel PermitRootLogin no dan masuk sebagai pengguna biasa dengan sudo.',
  },
  {
    id: 'sshd-password-auth', title: 'Autentikasi kata sandi SSH aktif', severity: 'medium', confidence: 'high', owasp: OWASP.A07,
    kinds: ['sshd'], pattern: /^\s*PasswordAuthentication\s+yes\b/i,
    why: 'Kata sandi dapat ditebak atau dicuri; kunci SSH jauh lebih tahan terhadap brute force.',
    fix: 'Pakai kunci publik, setel PasswordAuthentication no, dan tambahkan fail2ban atau pembatas laju.',
  },
  {
    id: 'sshd-empty-passwords', title: 'Kata sandi kosong diizinkan di SSH', severity: 'critical', confidence: 'high', owasp: OWASP.A07,
    kinds: ['sshd'], pattern: /^\s*PermitEmptyPasswords\s+yes\b/i,
    why: 'Akun tanpa kata sandi dapat dimasuki siapa pun.',
    fix: 'Setel PermitEmptyPasswords no.',
  },
];
