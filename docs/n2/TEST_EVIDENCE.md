# Bukti verifikasi checkpoint

Lingkungan aktual: Windows x64, Node v22.21.1, Next.js 16.4.2, Playwright 1.64.1, Edge 155.0.4283.62. Hasil command tersimpan dengan exit code dan SHA-256 pada [evidence/commands.json](evidence/commands.json). Perintah yang diperbarui setelah perbaikan fixture memiliki `refreshedAt`; satu rerun unit mempunyai runtime TAP, bukan durasi npm total.

## Hasil inti

- **23/23 unit/integration checks lulus**: auth, origin, identity rate key, approval expiry/replay/scope/reopen, dispatcher denial, junction/path, worker environment, timeout/cancellation/live-parent tree stop, explicit parent-exit cleanup failure, exact verifier, Quran corpus, XLSX parsing, dan redaction setelah dekompresi.
- **8 skenario HTTP lulus** melalui server produksi nyata; Node melaporkan 9 tests termasuk parent suite. Mencakup 10 endpoint mutasi dan 5 private/page routes tanpa auth, Origin palsu, Basic browser entry, developer PLAN, legacy execution denial, 79 NOT_RUN, Quran, chat kalkulasi, dan upload CSV.
- **2 UI tests lulus**, 390 dan 1440 px. Input kalkulasi, hasil 20, fokus keyboard, no horizontal overflow, dan no pageerror pada skenario itu. Screenshot: [390 px](evidence/chat-390.png), [1440 px](evidence/chat-1440.png).
- **Cold install lulus**: `npm ci --ignore-scripts --no-audit --no-fund` lalu `npm run gate:n2`, keduanya exit 0 pada folder sementara tanpa node_modules/.next/.env/storage lama. Log: [cold-install.txt](evidence/cold-install.txt).
- `check:dual`, build, lint, lock check, CLI menu checker, UI checksum, Quran checks, distribution check, dan TypeScript migration checker lulus. Empat file PowerShell lolos parser syntax; ini bukan interaksi seluruh menu CLI.
- Audit produksi pada level high exit 0: **0 critical/high, 3 moderate**. Jangan menyebut semua advisory sudah hilang.

## Kegagalan dan NOT_RUN yang dipertahankan

- `health:test` **FAILED, exit 1**. Checker teks lama mencari literal dalam file facade yang sekarang memanggil modul health. Checker dan logika health tidak diubah. Ini tetap penghalang verifikasi release, bukan PASS tersirat.
- `benchmark:n1` **NOT_RUN, exit 2**. API mengembalikan 79 kasus tanpa bukti sebagai NOT_RUN, pass=0. Script tidak lagi membuat gate palsu hijau.
- `verify:n2` keseluruhan exit 1 karena health checker. Gate fondasi yang hijau tidak menggantikan acceptance P0/P1 dan keenam kemampuan.
- Live Ollama, ML, MySQL, live web research, runtime MCP, OS sandbox, full browser perimeter, Linux/CI, dan complete six-domain E2E: **NOT_RUN / NOT_IMPLEMENTED**.
- Lint menyisakan 4 warning legacy ChatShell, sengaja tidak merefaktor lifecycle/state komponen yang dipreservasi. Build mencatat 4 warning dynamic tracing legacy. ESLint 9 menghasilkan warning deprecation; ESLint 10 terbukti tidak cocok dengan plugin React yang sekarang dipakai.

## Riwayat perbaikan fixture

Tes baseline pertama 0/5 mendemonstrasikan bug sebelum patch. Regresi HTTP pertama menemukan path Quran yang salah, lalu source pembaca diperbaiki. Chromium cache gagal spawn; Edge dengan profil temporary dipakai dan versi aktual dicatat.

Token fixture Playwright dibuat sekali pada environment runner lalu diwariskan ke worker, sehingga kredensial config tidak berubah saat config dievaluasi ulang. Itu perbaikan fixture, bukan klaim bahwa auth boleh dibypass.

Tes timeout lama mengasumsikan grandchild sudah sempat startup dalam 700ms. Saat cold install paralel, proses sudah benar dihentikan sebelum PID tercetak sehingga assertion fixture gagal. Fixture diperbaiki menjadi tes timeout terpisah dan tes penghentian tree setelah readiness dari stdout; hasil gagal terdahulu dipertahankan di `evidence/history/`. Parent-exits-first memastikan kegagalan taskkill tidak dianggap sukses; ini tetap bukan bukti universal Windows orphan isolation.

## Mapping acceptance

| ID | Status checkpoint | Batas praktis |
|---|---|---|
| P0-01 | PASSED untuk instalasi lokal | Lockfile belum di-commit; tidak ada remote CI |
| P0-02 | PASSED dengan warnings | ESLint CLI nyata; 4 warning legacy |
| P0-03 | PARTIAL | Typecheck/build/CLI checker hijau; health checker gagal, full CLI NOT_RUN |
| P0-04 | PASSED pada route yang diuji | HTTP denial sebelum dispatch; bukan audit semua handler internal |
| P0-05 | PARTIAL | Origin dan approval store diuji; issuer/UI belum ada |
| P0-06 | PARTIAL | Trusted resolver/code-index dibatasi; belum semua legacy I/O |
| P0-07 | PASSED untuk deny | MCP tidak dieksekusi; legitimate server tidak tersedia |
| P0-08 | PARTIAL | Dispatcher denial; MCP protocol/schema/output integration belum ada |
| P0-09 | BLOCKED | Deny IP/local preflight; DNS/redirect/subresource enforcement belum ada |
| P0-10 | PASSED | Missing evidence menghasilkan NOT_RUN |
| P0-11 | PARTIAL | Timeout/cancel/live-parent tree stop; orphan/OS isolation belum tertutup |
| P0-12 | PARTIAL | Negative schema/scope; semantic live-model injection belum diuji |
| P0-13 | PARTIAL | Environment dan XLSX secret fixtures; belum seluruh sink |
| P0-14 | PARTIAL | Zenith defaults dan legacy production denial; belum seluruh caller audit |
| A/C/B/D/R/U full N2 verticals | NOT_IMPLEMENTED | Lihat ROADMAP; regression parser/chat bukan vertical N2 |

Status release tetap **BLOCKED**, meskipun skenario fondasi yang disebutkan lulus.
