# NusaMind N1.5.1 — Defensive Security Partner

N1.5.1 menjadikan Zenith mitra keamanan yang bekerja langsung pada sistem Anda: ia dapat **mencari celah pada kode dan konfigurasi milik Anda**, menjelaskannya, dan menyarankan perbaikan minimal. Patch ini juga memperbaiki celah nyata yang ditemukan pemindai pada repositori NusaMind sendiri.

## Dua bagian

### 1. Pemindai statis pasif (`lib/security-audit.ts`)

Membaca berkas, mencocokkan aturan, dan melaporkan temuan dengan lokasi, bukti, klasifikasi, alasan, dan perbaikan.

```powershell
npm run security:audit -- . --format markdown
npm run security:audit -- . --format sarif --out storage/laporan.sarif
npm run security:audit -- . --fail-on high
```

- **Cakupan (56 aturan):** JavaScript/TypeScript, Python, shell, PowerShell, batch, Dockerfile, Compose, GitHub Actions, nginx, `sshd_config`, `package.json`, `next.config`, rute API Next.js, serta rahasia tertanam di semua berkas teks.
- **Klasifikasi:** tiap temuan membawa CWE (judulnya dicocokkan satu per satu ke cwe.mitre.org) dan kategori **OWASP Top 10:2025**. Edisi 2025 adalah yang berlaku sekarang; SSRF digabung ke A01 dan ada kategori baru A03 Software Supply Chain Failures serta A10 Mishandling of Exceptional Conditions.
- **Format:** Markdown, JSON, dan SARIF 2.1.0 (OASIS) yang dapat diunggah ke GitHub code scanning.
- **API:** `GET /api/n1/security` (status) dan `POST /api/n1/security` (audit). POST memerlukan header `x-desktop-token` (master) atau `x-nusamind-permission` dengan scope `repo.scan`. Path harus berada di dalam proyek atau workspace tepercaya yang terdaftar (`.nusamind/trusted-workspaces.json`); realpath diperiksa agar symlink tidak dapat dipakai keluar. Dibatasi 6 audit per menit dan dicatat sebagai security event.

**Yang tidak dilakukan pemindai, dan sengaja:**

| Sifat | Keterangan |
|---|---|
| Pasif | Hanya membaca berkas. Kode yang dipindai tidak dijalankan. |
| Tanpa jaringan | Tidak memindai host, port, atau URL, dan tidak mengunduh apa pun. |
| `.env` asli tidak dibaca | Hanya keberadaannya dan status `.gitignore` yang diperiksa. `.env.example` dibaca. |
| Symlink tidak diikuti | Dihitung pada `coverage.skipped.symlink`. |
| Rahasia disamarkan | Nilai kredensial diganti `[REDACTED]` pada snippet laporan. |
| Penekanan transparan | Penanda `nusamind-audit-ignore` (baris), `-next-line`, dan `-ignore-file` (10 baris pertama) menekan temuan, tetapi setiap penekanan **dilaporkan** di `suppressions` dan di bagian "Penekanan" laporan Markdown, agar tidak dapat dipakai menyembunyikan sesuatu diam-diam. |

### 2. Mitra keamanan di chat (`lib/cyber-partner.ts`)

Bila pesan menyangkut keamanan (kerentanan, hardening, threat modeling, respons insiden, kriptografi, infrastruktur, dan sebagainya), konteks model diperkaya dengan cara kerja seorang praktisi: aset dan ancaman, celah beserta bukti, dampak, perbaikan minimal dalam blok kode, cara memverifikasi, dan risiko tersisa. Jawaban dipetakan ke CWE dan OWASP 2025 bila yakin, tanpa mengarang nomor CVE atau tautan.

Bila Anda menempelkan kode dan menanyakan keamanannya, kode itu juga dipindai dengan aturan yang sama dan hasilnya ditambahkan sebagai petunjuk untuk model. Model tetap menelaah logika bisnis dan otorisasi yang tidak dapat ditangkap pola.

Modul ini **tidak menolak permintaan berdasarkan kata kunci**; ia hanya menambah konteks. Basis pengetahuan pendukung ada di `data/knowledge/security-partner.json` (16 rekaman). Hanya rekaman yang dicek ke sumbernya hari ini yang berlabel "diverifikasi"; sisanya berlabel pengetahuan praktisi umum.

## Hasil audit pada repositori ini

Audit pertama menemukan 46 temuan. Setelah triase, aturan diperbaiki dan temuan nyata ditangani:

| Temuan | Status | Bukti |
|---|---|---|
| `.env` tidak diabaikan `.gitignore` (padahal README menyuruh menyalin `.env.example` ke `.env`) | **Diperbaiki** | `git check-ignore -v .env` kini menunjuk `.gitignore:3` |
| Server statis hasil generate `coding-agent` membaca berkas di luar root dan menyajikan `.env` | **Diperbaiki** | Sebelum: `/..%2foutside-secret.txt` dan `/.env` mengembalikan 200 berisi berkas. Sesudah: 403, sementara halaman normal, query string, dan 404 tetap bekerja |
| `POST /api/admin/reindex` terbuka bila `ADMIN_TOKEN` kosong, dan membandingkan token dengan `!==` | **Diperbaiki** | Produksi gagal tertutup (503) bila token kosong atau memakai nilai placeholder publik; perbandingan memakai `timingSafeEqual`. Matriks 11 skenario lulus |
| Tidak ada security headers | **Diperbaiki sebagian** | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, dan `poweredByHeader: false`. CSP dan HSTS sengaja belum (lihat di bawah) |
| `docker-compose.yml` memakai token admin bawaan yang publik, dan port 3000 dipublikasikan ke semua antarmuka | **Diusulkan, belum diterapkan** | Perlu uji Docker yang tidak dapat dilakukan di lingkungan ini |
| Dockerfile berjalan sebagai root | **Diusulkan, belum diterapkan** | Beralih ke non-root dapat membuat volume `./storage` tidak bisa ditulis; perlu uji |
| Tidak ada `package-lock.json` | **Sengaja dibiarkan** | Dihapus di N1.4.1 dan `eval-typescript-n1.4.1` justru mewajibkan ketiadaannya. Buat dengan `npm install` di mesin Anda |
| `-ExecutionPolicy Bypass` pada empat peluncur `.bat` | **Diterima** | `RemoteSigned` memblokir skrip ber-Mark-of-the-Web dari unduhan ZIP sehingga peluncur gagal; skrip itu milik Anda sendiri |
| 18 rute API tanpa pemeriksaan autentikasi yang terlihat | **Informasi** | Keyakinan rendah; wajar untuk aplikasi lokal. Tinjau bila port dibuka ke jaringan |
| `js-sql-injection` di `lib/knowledge-center.ts` | **False positive** | Yang disisipkan adalah klausa tetap buatan kode sendiri dengan placeholder `?` |
| `js-weak-hash` (sha1) pada id dan deduplikasi | **Risiko rendah** | Dipakai untuk identitas, bukan keamanan |

False positive yang dihilangkan dari aturan: `RegExp.exec` terbaca sebagai `exec` shell, `DownloadString` terbaca sebagai eksekusi, `fetch` ke path relatif terbaca sebagai SSRF, dan pola mitigasi `env: X: ${{ ... }}` pada workflow terbaca sebagai injeksi.

### Usulan patch yang belum diterapkan

Terapkan setelah mengujinya di Docker Anda:

```dockerfile
# Dockerfile, tahap runner
RUN chown -R node:node /app
USER node
```

```yaml
# docker-compose.yml
ports:
  - "127.0.0.1:3000:3000"
environment:
  ADMIN_TOKEN: ${ADMIN_TOKEN:?isi ADMIN_TOKEN di .env}
```

Untuk CSP, mulai dengan `Content-Security-Policy-Report-Only`, uji terhadap UI (ada skrip inline), lalu perketat. HSTS sebaiknya dipasang di reverse proxy HTTPS.

## Batasan yang harus Anda ketahui

- **Analisis statis berbasis pola.** Ada false positive dan false negative. Ia tidak memahami logika bisnis, otorisasi lintas berkas, atau alur data yang panjang. Contoh nyata: kode di dalam string literal atau dokumentasi dapat terbaca sebagai kode (itu sebabnya berkas yang memuat contoh kerentanan memakai penanda penekanan).
- **Tidak ada pemeriksaan CVE.** Kerentanan dependensi memerlukan `npm audit` atau OSV-Scanner dengan jaringan.
- **Tidak ada uji dinamis.** Validasi aktif (misalnya menguji endpoint) dilakukan Anda sendiri di lingkungan milik sendiri atau berizin; NusaMind menjelaskan langkahnya tetapi tidak memindai jaringan.
- **Tidak adanya temuan bukan bukti aman.**
- NusaMind tidak dirancang membuat malware atau alat serang terhadap sistem pihak lain, dan itu di luar cakupan patch ini.

## Validasi

```powershell
npm run security:audit:benchmark
npm run table:n15:benchmark
npm run suites:n142:benchmark
npm run model:n14:benchmark
npm run answer:benchmark
```

`security:audit:benchmark` menjalankan 79 kasus snippet (positif dan negatif), 12 proyek sintetis, 7 kasus konteks chat, integritas metadata aturan, validasi laporan Markdown dan SARIF, serta gerbang regresi pada repositori ini (tidak boleh ada temuan kritis atau tinggi, dan tiga perbaikan di atas tidak boleh kembali). Ekspektasi diturunkan manual dari definisi aturan. Benchmark memuat modul `.ts` langsung dan memerlukan Node 22.18 atau lebih baru.
