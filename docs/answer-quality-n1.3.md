# NusaMind N1.3 — Answer Quality & Academic Response Engine

N1.3 meningkatkan kualitas sekaligus kuantitas jawaban secara adaptif. Sistem tidak membuat semua jawaban panjang; struktur dan kedalaman dipilih berdasarkan jenis pertanyaan, tingkat kesulitan, mode jawaban, dan edisi.

## Rumus dan angka

Urutan standar:

1. Diketahui
2. Konsep/Rumus yang digunakan
3. Penyelesaian
4. Jawaban akhir
5. Penjelasan singkat

Aturan penting:

- Satuan dipertahankan dan diperiksa.
- Substitusi tidak boleh melompati langkah penting.
- Hasil akhir hanya satu dan mudah ditemukan.
- LaTeX mentah tidak ditampilkan secara default pada CLI.
- Input yang kurang tidak ditebak.

## Coding

Urutan standar:

1. Tujuan/inti solusi
2. Kode lengkap dalam fenced code block
3. Cara kerja
4. Contoh input/output
5. Catatan edge case, dependency, keamanan, atau kompleksitas bila relevan

Kode tidak boleh dipotong dan tidak boleh diklaim sudah diuji bila belum dijalankan.

## Kedalaman per edisi

- Swift: jawaban seimbang, cepat, tetapi tetap menjelaskan konsep dan langkah utama.
- Zenith: jawaban lebih detail dengan validasi, edge case, dan contoh tambahan.
- Apex: jawaban expert dengan derivasi, verifikasi berlapis, alternatif, dan analisis teknis bila relevan.

## Batasan

- Tidak mengubah UI utama.
- Tidak memaksa format akademik untuk percakapan biasa.
- Tidak memperpanjang jawaban dengan pengulangan atau teori yang tidak relevan.
- Output tetap natural, bukan format dataset.
