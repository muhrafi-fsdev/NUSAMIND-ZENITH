# Checkpoint fondasi N2, bukan release N2.0

Status: **BLOCKED / P0 PARTIAL**. Target enam kemampuan dalam upgrade pack belum selesai dan tidak boleh diberi label RC/GA N2.0. Jalur eksekusi lama yang belum memiliki sandbox dan approval terikat payload diblokir secara sengaja. Ini adalah source untuk direview dan dilanjutkan.

Baseline: `d10904602ced92443ae055cb87f258a9c01e820c`, repository `muhrafi-fsdev/NUSAMIND-ZENITH`. Branch `feat/zenith-n2-agentic-workbench`. Pada 20 Oktober 2026 pengguna memberi persetujuan eksplisit untuk commit dan push ke repository tersebut. Checkpoint ini disiapkan untuk draft PR; merge dan deployment belum dilakukan. Paket sumber dari pengguna disimpan tanpa perubahan di `docs/upgrade-n2/`.

## Perubahan yang dapat dijalankan

- Lockfile npm, ESLint CLI, gate fondasi, dan konfigurasi CI Windows/Linux. Typecheck native dan compatibility tetap tersedia; build kembali menegakkan pemeriksaan TypeScript.
- Auth Basic untuk browser memakai username `nusamind` dan `ADMIN_TOKEN`, serta Bearer/header token untuk API/CLI. Semua halaman aplikasi dan API dilindungi proxy. Token kosong/contoh ditolak, origin dibandingkan dengan konfigurasi server, server dev/start bind ke `127.0.0.1`, rate limit memakai identitas kredensial.
- Dispatcher lama coding, autonomy, dan desktop menolak aksi berisiko dengan `423 LEGACY_EXECUTION_BLOCKED`. Membaca status, perencanaan, chat, file analysis, dan Quran tetap tersedia setelah autentikasi.
- Inspeksi dan panggilan MCP tidak membuat proses child sama sekali; konfigurasi wrapper dari request tidak dipercaya sebagai isolasi OS.
- Approval SQLite single-use/expiry dengan hash identitas, run, tool, argumen, origin, dan workspace. Ini baru library, belum ada issuer/API/UI untuk alur approval produk.
- Perbaikan realpath pada trusted workspace, pembatasan code index, penolakan tool tanpa approval, cancellation kooperatif, batas capture output, dan kegagalan cleanup proses yang eksplisit.
- Evaluasi 79 benchmark lama kini `NOT_RUN`, bukan `PASS` otomatis. Routing N1 diberi label routing saja.
- Bug chat JSON yang memakai model sebelum deklarasi diperbaiki. Referensi file Quran diarahkan ke corpus yang benar-benar dikirim, tanpa mengubah ayat/terjemahan. Label halaman diperbaiki menjadi Zenith; layout ChatShell dipertahankan.
- Next.js `16.4.2`, MySQL2 `3.24.6`, dan SheetJS CE `0.20.3` dari distribusi resmi. Hasil ekstraksi spreadsheet dipindai lagi setelah dekompresi agar credential yang baru terlihat ikut dimasking/dikarantina.

## Verifikasi

Hasil perintah dan exit code aktual ada di [TEST_EVIDENCE.md](TEST_EVIDENCE.md) serta `evidence/commands.json`. Screenshot berasal dari render browser aktual pada 390 dan 1440 px. Hasil ini membuktikan skenario yang disebutkan, bukan sertifikasi keamanan, aksesibilitas penuh, atau kelengkapan N2.

## Memakai dan melanjutkan

Baca [MIGRATION.md](MIGRATION.md), [LIMITATIONS.md](LIMITATIONS.md), [THREAT_MODEL.md](THREAT_MODEL.md), [ARCHITECTURE.md](ARCHITECTURE.md), dan [ROADMAP.md](ROADMAP.md). Jangan membuka executor/network worker sebelum P0 yang masih terbuka ditutup dan acceptance negatif/positifnya diuji.
