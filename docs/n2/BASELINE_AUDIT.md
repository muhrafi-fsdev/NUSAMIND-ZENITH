# Baseline dan reproduksi

Tanggal lokal: 20 Oktober 2026, Asia/Jakarta. Commit remote `main` saat diperiksa sama dengan referensi audit: `d10904602ced92443ae055cb87f258a9c01e820c`. Source awal clean. Source N1.4.1 dibaca bersama README, AGENTS, manifest, contoh env, route API, runtime, dan seluruh tujuh dokumen paket.

## CONFIRMED_BY_TEST

1. `clean-install:check` awal exit 1 karena lockfile tidak ada. Setelah dependency dipasang, `lint` awal exit 1 karena `next lint` dianggap nama direktori.
2. Kedua compiler awal exit 1 dengan 19 diagnostik: akses model sebelum deklarasi, duplikasi `ok`, literal edition yang tidak cocok, ProcessEnv tanpa NODE_ENV, dan narrowing optional command.
3. Lima tes regresi awal gagal semuanya: Host `localhost.evil.test` mendapat 200; MCP fixture menjalankan script marker; junction keluar root diterima; 79 benchmark mengaku PASS; IPv6 loopback diterima sebagai URL publik.
4. Regresi HTTP pertama menemukan Quran exact 404. Pembaca memakai `ayah-idx.json`/`topic-map.json` yang tidak ada; corpus yang dikirim bernama `ayah-index.json`/`topic-index.json`.
5. Audit dependency awal mencatat 1 critical, 3 high, 4 moderate. Audit produksi setelah patch mencatat 0 critical/high dan 3 moderate; JSON aktual disimpan dalam evidence verifikasi.
6. Checker UI historis gagal pada checkout Windows karena CRLF. Hash teks LF cocok dengan checksum awal. Pemeriksaan sekarang menormalisasi CRLF dan mempertahankan pemeriksaan file layout, CSS, ChatShell, serta logo; delta page/dashboard dicatat terpisah.

## CONFIRMED_BY_STATIC_CODE

- Coding melindungi hanya daftar action tertentu; `plan` menyimpan job dan `job` mengungkap isi job tanpa auth wajib.
- Otorisasi autonomy/developer/knowledge memakai Host saat token kosong. Admin reindex juga terbuka bila token kosong.
- `body.workspace` autonomy menjadi home registry/vault/audit. Pemeriksaan trusted target bersifat leksikal.
- Registry typed tool memvalidasi schema tanpa menegakkan risiko pada dispatcher.
- MCP inspect spawn langsung sebelum isolasi; flag/argv wrapper tidak membuktikan sandbox.
- Browser hanya policy/manifest. N1 orchestrate hanya routing. Approval lama berupa boolean/frasa dan bukti verifikasi dari caller.
- Default coding dapat menjadi Apex, berbeda dari autonomy/developer. Default/invalid value yang disentuh kini Zenith.

## SUSPECTED / NOT_TESTED

DNS rebinding, redirect/subresource browser egress, seluruh file I/O lama, parser resource exhaustion, seluruh permission-token consumer, dan proses orphan setelah parent keluar belum tertutup sebagai sistem lengkap. Detail batas Windows dicatat dalam THREAT_MODEL/LIMITATIONS.

`health:test` adalah pemeriksa teks lama, bukan tes perilaku. Script dan modul health tidak diubah oleh patch ini; checker masih mencari literal yang sudah dipisahkan ke submodul. Kegagalannya tetap dicatat, tidak dijadikan PASS.

Ollama executable tersedia, tetapi API loopback tidak tersedia saat probe; uji live-model NOT_RUN. Launcher yang sempat dimulai oleh probe dihentikan. Tidak ada model diunduh atau konfigurasi layanan pengguna diubah.
