# NusaMind Zenith N1.5 Upgrade Report

## Minor

- Handler tabel deterministik (`lib/table-engine.ts`): konversi CSV/TSV/JSON/JSONL/Markdown/HTML, runtutan pertumbuhan berturut-turut dengan tanggal berformat campuran, dan pemetaan kolom berdasarkan kemiripan nilai.
- Handler menolak (null) bila parse ambigu; asumsi ditulis di jawaban.
- Kerangka laporan riset untuk brief hukum, pajak, dan regulasi, dengan larangan mengarang sumber.
- Perbaikan `terminalSafeTables`: blok kode berpagar tidak lagi diubah menjadi daftar.
- `npm run table:n15:benchmark`: 37 kasus engine, 7 kasus klasifikasi, dan uji integrasi.
- README diperbarui; berkas panduan dan placeholder usang dihapus.

## Batas validasi

- Kasus uji buatan sendiri; benchmark suite live `NOT_RUN`, tidak ada skor yang diklaim.
- Kepatuhan model terhadap kerangka riset adalah instruksi prompt dan belum diukur.
- `npm run check`, `build`, dan `gate` belum dijalankan di lingkungan pengembangan ini karena dependency belum terpasang.

# NusaMind Zenith N1.4.2 Upgrade Report

## Patch

- Pengetahuan tujuh suite evaluasi (Agentic, Reasoning, Coding, Browser Use, Data Analysis, Research, Design) beserta aturan skor dan biayanya.
- Peta kemampuan Zenith per suite berbasis audit kode statis.
- Modul `lib/suite-scoring.ts` dan benchmark `npm run suites:n142:benchmark`.
- Sinkronisasi metadata rilis dengan `package.json` dan benchmark N1.3/N1.4/N1.4.1 diterima untuk seluruh garis patch.
- Tidak ada perubahan UI, runtime model, atau perilaku jawaban.

## Batas validasi

- Sumber taksonomi diberikan pengembang dan belum diverifikasi.
- Benchmark suite live: `NOT_RUN`. Tidak ada skor yang diklaim.
- Browser Use dan Design berstatus `NOT_SUPPORTED`; lihat `docs/benchmark-suites-n1.4.2.md`.

# NusaMind Zenith N1.4.1 Upgrade Report

## Patch

- TypeScript 7 native sebagai compiler utama.
- TypeScript 6 compatibility fallback.
- Dual compiler validation.
- Tidak ada perubahan UI atau model runtime.

# NusaMind Zenith N1.0 Upgrade Report

## Applied scope
- Migrated V13.49.2 foundation and N1.0 significant upgrades: **124 items**.
- Status distribution: {'ACTIVE': 47, 'BENCHMARKED': 56, 'PROTOTYPE': 21}.
- All existing Top Category scores increased by **+900**; 124 N1.0 categories added.
- Canonical release identity changed to **N1.0 / 1.0.0**.
- Stable N1 API and compatibility adapters added.
- Unified orchestrator, reasoning, reliability, evidence, lineage, reference governance, and edition runtime foundations added.
- Defensive cybersecurity from R13.49.1 retained.

## Locked exclusions
- Windows EXE/Electron: **CANCELLED**.
- n8n: **POSTPONED**.
- Main UI redesign: **LOCKED / checksum protected**.

## Honest validation boundary
TypeScript, production build, source/policy checks, JSON naming, UI checksum, distribution, exclusions, and local API contract benchmarks are release-gated. Live model, live browser, hardware, and real-world accuracy benchmarks are not claimed in this offline package build.


## N1.1 Developer Intelligence

- Edition: **Zenith**
- Modes: ASK, PLAN, BUILD, REVIEW, REPAIR
- Permissioned tool runtime, project mapping, checkpoint/rollback, selective LSP, and evidence-based verification.
- OpenCode patterns were studied and reimplemented; no source was copied.


## N1.2 — Advanced Autonomy & Deployment

NusaMind Zenith now includes controlled Git push, force-with-lease backup workflow, destructive-action gates, encrypted credential references, trusted multi-workspace access, MCP quarantine, deployment orchestration, and extended bounded autonomy. See `docs/autonomy-n1.2.md`.


## N1.3 Answer Quality & Academic Response Engine

- Adaptive depth per edition: detailed.
- Formula/numeric answers use known data, formula, solution, final answer, and concise explanation.
- Coding answers require complete fenced code, explanation, input/output example, and relevant edge cases.
- Polynomial derivative and basic arithmetic deterministic handlers added.
- Raw LaTeX remains opt-in; UI remains unchanged.

## N1.4 Adaptive Qwen3 Model Runtime
- Main model: `qwen3:8b`
- Coding model: `qwen2.5-coder:7b`
- Fallback: `qwen2.5:7b`
- Heavy coder opt-in: `qwen3-coder:30b`
- Thinking policy: `auto`
- Installed-model probe and fallback routing added.
- Main UI unchanged.
