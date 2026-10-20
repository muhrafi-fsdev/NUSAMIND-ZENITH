# NUSAMIND ZENITH N2.0 | Codex Upgrade Pack

**Repository:** https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH  
**Target:** `main` pada baseline audit `d10904602ced92443ae055cb87f258a9c01e820c` (28 Juli 2026)  
**Disiapkan:** 20 Oktober 2026  
**Tujuan:** peningkatan kemampuan Agentic, Coding, Browser Use, Data Analysis, Research, dan Design secara *real, verified, local-first*, bukan perubahan nama atau daftar fitur.

## Urutan menggunakan paket
1. Buka repository NUSAMIND-ZENITH di Codex (local atau cloud dengan akses repo).
2. Buka **`01_CODEX_MASTER_PROMPT.md`**, tempel keseluruhan sebagai instruksi utama ke Codex. Sertakan isi file lain sebagai konteks, atau simpan pack ini pada folder `docs/upgrade-n2/` di working branch sebelum menjalankan Codex.
3. Jadikan `02_PRODUCT_REQUIREMENTS_PRD.md` persyaratan fungsional, `03_AUDIT_BASELINE.md` temuan untuk direproduksi, `04_ACCEPTANCE_TEST_MATRIX.md` kriteria penerimaan, `05_ARCHITECTURE_AND_ROADMAP.md` panduan implementasi, dan `06_REFERENCES.md` rujukan.
4. Codex harus memulai dengan membaca `AGENTS.md`, memeriksa repo aktual, memastikan hak akses, dan membuat branch `feat/zenith-n2-agentic-workbench` dari branch default terbaru. **Jangan langsung merge ke `main`.**
5. Kerjakan bertahap. P0 security dan build/test harus selesai sebelum mengaktifkan Browser Use, MCP, atau eksekusi code yang berdampak.
6. Wajib menyertakan diff, hasil tes aktual, limitasi, regression report, dan PR berisi rincian. Jika suatu test tidak dapat dijalankan (misalnya Ollama/Chromium tidak tersedia), tulis `NOT_RUN` dan penyebabnya.

## Outcome minimum untuk disebut berhasil
- Main chat/CLI N1.4.1 yang sudah ada tidak regress.
- Perbaikan otorisasi dan jalur MCP tidak dapat dieksploitasi melalui request biasa.
- Ada satu skenario nyata, *end-to-end*, teruji untuk setiap dari enam area, bukan hanya metadata/registry.
- Bisa diulang pada Windows 10/11 + Node >=22 + Ollama (fitur browser dan Python tambahan melalui instalasi opsional yang terdokumentasi).
- Workflow dapat dihentikan, diaudit, di-resume saat aman, dan hasilnya diverifikasi secara deterministik.

## Catatan lingkup
N2.0 adalah **nama target yang diusulkan**, bukan release yang sudah tersedia. Audit ini berasal dari peninjauan kode GitHub, bukan dari build atau uji runtime di komputer pengguna. Beberapa bug membutuhkan reproduksi pada lingkungan kerja Codex sebelum dinyatakan *confirmed*.
