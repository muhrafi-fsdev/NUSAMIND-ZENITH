# NusaMind N1.5 — Table Intelligence & Research Brief Structure

N1.5 menambahkan handler deterministik untuk tabel di `lib/table-engine.ts` dan kerangka laporan untuk brief riset di `lib/academic-answer-engine.ts`. Handler dipasang di `tryBuildCalculationAnswer` (`lib/calc-engine.ts`), sehingga `/api/chat` dan `/api/chat-json` memakainya tanpa perubahan rute. Jawabannya tampil dengan mode `calculation-table`.

## Prinsip: menolak lebih baik daripada menebak

Handler mengembalikan `null` bila parse tidak pasti, lalu model yang menjawab seperti biasa. Jawaban deterministik yang salah lebih berbahaya daripada tidak ada jawaban. Yang ditolak antara lain:

- Pertanyaan satu baris atau tanpa tabel.
- Permintaan yang menyertakan tugas lain (filter, urut, hitung, gabung, jelaskan).
- Header kosong, duplikat, atau berupa angka saat target JSON (urutan kunci objek tidak terjamin).
- Baris dengan jumlah kolom tidak konsisten, atau tanda kutip tidak tertutup.
- Tanggal yang bertentangan (bukti `dd/mm` sekaligus `mm/dd` dalam satu kolom).
- Dua tanggal sama untuk entitas yang sama pada analisis pertumbuhan.
- Lebih dari satu kolom nilai yang tidak disebut pada pertanyaan.
- Pemetaan kolom yang ambigu (skor kembar), kemiripan di bawah 34%, atau tabel pertama lebih lebar dari tabel kedua.

Karena handler berjalan pada setiap pesan chat, pintu masuknya tidak pernah melempar error: input apa pun yang membuat parser gagal (misalnya entitas HTML tidak valid seperti `&#99999999;`) diperlakukan sebagai "bukan urusan handler" dan diteruskan ke model. Input di atas 200.000 karakter dan pesan satu baris dilewati sebelum parsing.

## 1. Konversi tabel

Format: CSV, TSV, JSON (array objek), JSONL, Markdown, HTML. Format asal dideteksi otomatis atau dari label blok kode. Format tujuan diambil dari frasa seperti `ke JSON` atau `to CSV` dan membutuhkan kata kerja konversi (`ubah`, `konversi`, `convert`, ...).

Aturan keluaran:

- CSV mengikuti RFC 4180 (kutip bila ada koma, kutip ganda, baris baru, atau spasi di tepi). Pemisah masukan `,` `;` dan tab dikenali.
- JSON memakai indentasi 2 spasi. Sebuah kolom ditulis sebagai angka hanya bila **semua** selnya angka persis (`String(Number(x)) === x`). Satu nilai seperti `007` membuat seluruh kolom tetap teks; ini mencegah tipe campuran dalam satu kolom.
- Sel `null` ditulis kosong pada format teks. Objek atau array bersarang ditolak.
- TSV mengganti tab dan baris baru di dalam sel dengan spasi.
- Markdown me-escape `|`; HTML me-escape `& < > "`.

## 2. Runtutan pertumbuhan berturut-turut

Mengurutkan per entitas menurut tanggal, lalu menghitung kenaikan beruntun. Kolom entitas, tanggal, dan nilai ditentukan dari isi data.

- Format tanggal: ISO, `a/b/tahun`, nama bulan Inggris dan Indonesia, bulan-tahun, dan tahun saja.
- Tanggal `a/b/tahun`: bila ada nilai dengan `a > 12`, kolom dibaca hari/bulan; bila ada `b > 12`, bulan/hari. Bila tidak ada bukti, dibaca hari/bulan dan **catatan asumsi ditulis di jawaban**.
- Satu pertumbuhan berarti nilai lebih besar dari catatan sebelumnya. Nilai sama atau turun memutus runtutan.
- Arti "N berturut-turut" tidak didefinisikan sumber, jadi jawaban menampilkan dua daftar: ≥ N kenaikan, dan ≥ N titik data (setara N−1 kenaikan).
- Bila N tidak disebut, ambang bawaan 2 kenaikan dipakai dan **dinyatakan sebagai ambang bawaan**.

## 3. Pemetaan kolom

Memetakan kolom tabel pertama ke tabel kedua berdasarkan kemiripan himpunan nilai (Jaccard) dengan jenis data yang sama (angka, tanggal, teks). Nama kolom hanya memberi bonus kecil sehingga nama yang diobfuskasi tidak menghalangi. Statusnya `simulation` karena ini inferensi, bukan hitungan eksak.

## 4. Kerangka laporan riset

Untuk brief hukum, pajak, regulasi, atau kepatuhan, instruksi jawaban meminta lima bagian: keputusan inti, dasar dan sumber, perhitungan, asumsi dan batasan, langkah berikutnya. Aturan utamanya: hanya menyebut sumber yang benar-benar ada di konteks atau lampiran, tidak mengarang pasal, URL, putusan, atau kutipan, dan tidak menyiratkan sudah mengecek situs resmi (NusaMind tidak mengakses web langsung).

Deteksinya sengaja ketat: butuh sinyal domain **dan** sinyal brief atau permintaan sumber, dan pertanyaan coding tetap diprioritaskan. "Hitung pajak 11% dari 2.000.000" tetap memakai format rumus. Kerangka ini adalah instruksi prompt; kepatuhan model terhadapnya belum diukur.

## Perbaikan pendukung

`terminalSafeTables` di `lib/answer-format.ts` sebelumnya mengubah baris berpipa yang lebih lebar dari 88 karakter menjadi daftar `Kolom: nilai` bahkan di dalam blok kode berpagar, sehingga konversi ke Markdown yang lebar rusak. Sekarang isi blok kode dilewati.

## Validasi

```powershell
npm run table:n15:benchmark
npm run suites:n142:benchmark
npm run model:n14:benchmark
npm run answer:benchmark
```

`table:n15:benchmark` menjalankan 37 kasus engine, 7 kasus klasifikasi riset, dan uji integrasi lewat `calc-engine`. Ekspektasi diturunkan manual dari definisi masalah, bukan dari keluaran kode. Benchmark ini memuat modul `.ts` langsung dan memerlukan Node 22.18 atau lebih baru; di Node lebih lama ia gagal dengan pesan jelas (exit 2), bukan lulus diam-diam.

Kasus uji adalah buatan sendiri. Hasilnya **tidak** menunjukkan skor pada suite Data Analysis atau Research; status benchmark live tetap `NOT_RUN`.
