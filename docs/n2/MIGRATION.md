# Setup Windows, migrasi, dan rollback

Paket ini adalah source checkpoint yang belum layak release N2.0. Gunakan folder baru; jangan timpa instalasi N1 atau storage pengguna. Tidak ada migrasi otomatis data lama atau penghapusan database.

## Setup

Node.js >=22 diperlukan. Pada PowerShell, dari folder source:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
Copy-Item .env.example .env
# Isi konfigurasi lokal sendiri bila diperlukan. Jangan pakai token contoh.
$nusaTokenBytes = New-Object byte[] 32
$nusaRandom = [Security.Cryptography.RandomNumberGenerator]::Create()
$nusaRandom.GetBytes($nusaTokenBytes)
$env:ADMIN_TOKEN = [Convert]::ToBase64String($nusaTokenBytes)
$nusaRandom.Dispose()
$env:NUSAMIND_APP_ORIGIN = 'http://localhost:3000'
npm run gate:n2
npm run start
```

Browser: buka `http://localhost:3000`; username `nusamind`, password nilai ADMIN_TOKEN dari lingkungan pribadi Anda. Token tidak ditulis dalam source/deliverable. Pakai terminal yang sama untuk CLI agar ADMIN_TOKEN diwariskan. Jika menyimpan token sendiri di .env, file itu sudah di-ignore Git. ADMIN_TOKEN yang tidak diisi membuat akses aplikasi ditolak.

`NUSAMIND_APP_ORIGIN` harus sama persis dengan URL browser yang dipakai. Contoh default `localhost` berbeda dengan `127.0.0.1`; ini disengaja. Jangan memakai bind publik atau reverse proxy sebelum audit deployment tersendiri.

## Kontrak yang berubah

- Seluruh app/API memerlukan auth. Main CLI memakai Bearer ADMIN_TOKEN; coding/autonomy juga menerima header token domain yang kuat. Role token tidak memberi akses ke API domain lain.
- Mutasi browser Basic memerlukan Origin yang tepat. Request Bearer/header dari CLI dapat tanpa Origin; Origin yang dikirim tetap diperiksa.
- Coding create/apply/build/start/rollback, autonomy execution, dan protected desktop mutation mengembalikan 423 sampai sandbox dan approval end-to-end selesai. Boolean/frasa lama bukan izin.
- Evaluasi N1 kini 79 NOT_RUN; `benchmark:n1` exit 2, sehingga gate release lama tidak akan memberi kelulusan palsu.
- Sumber Quran memakai nama corpus yang dikirim: `ayah-index.json` dan `topic-index.json`. Isi corpus tidak diubah.
- Lockfile dipulihkan. Jangan menghapusnya untuk mengikuti instruksi N1.4.1 lama di README historis.

## Approval storage

Tabel baru hanya dibuat secara lazy ketika library approval dipakai: `storage/n2-approvals.db`, schema v1, tanpa menyentuh tabel N1. Tidak ada nilai credential/payload mentah di tabel; hanya hash binding/token dan waktu. Belum ada issuer/UI, sehingga library ini belum mengaktifkan side effect produk.

## QA opsional

```powershell
npm run test:n2:http
# Jika Chromium Playwright tersedia:
npm run test:n2:ui
# Atau pilih browser milik instalasi Anda sendiri, memakai profil sementara:
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:n2:ui
npm run verify:n2
```

Browser binary tidak dikirim dan tidak diunduh otomatis. `verify:n2` saat ini exit 1 karena checker health historis yang gagal, dan melaporkan benchmark N1 NOT_RUN. `gate:n2` merupakan gate fondasi source/fixture; keberhasilannya bukan izin release N2.0.

## Rollback

Instalasi utama tidak disentuh. Berhenti memakai folder checkpoint dan kembali ke folder N1 yang disimpan. Jika patch diterapkan ke clone baseline, gunakan branch terpisah dan review `git apply --reverse --check` sebelum melakukan reverse patch. Jangan menjalankan reset/clean pada workspace yang mempunyai perubahan pengguna.

Approval database baru tidak dibaca N1; boleh disimpan untuk audit. Tidak ada perintah penghapusan otomatis. Model, layanan produksi, .env, vault, dan database pengguna tetap milik instalasi awal.
