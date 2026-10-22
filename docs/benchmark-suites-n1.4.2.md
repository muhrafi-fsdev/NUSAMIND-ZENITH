# NusaMind N1.4.2 — Suite Knowledge & Evaluation Map

Patch ini menambahkan pengetahuan tentang tujuh suite evaluasi model, aturan perhitungan skornya, dan peta kejujuran kemampuan Zenith terhadap tiap suite. Patch ini tidak mengubah UI, runtime model, maupun perilaku jawaban.

## Asal-usul data

Taksonomi dan aturan skor diberikan langsung oleh pengembang. Penerbit, URL, dan tanggal snapshot belum diketahui, jadi semua berkas ditandai `UNVERIFIED`. Jangan mengutipnya sebagai sumber eksternal sebelum asal-usulnya dikonfirmasi.

## Tujuh suite

| Suite | Jumlah | Unit | Penilaian |
|---|---|---|---|
| Agentic | 18 | task | Skrip terhadap data referensi, program uji, atau simulasi tersembunyi |
| Reasoning | 202 | pertanyaan | Ground truth, tanpa tool |
| Coding | 29 | task | Hidden test; perbaikan yang merusak perilaku lama bernilai 0 |
| Browser Use | 25 | task | Jawaban dan data akhir aplikasi; wajib kemampuan screenshot |
| Data Analysis | 150 | pertanyaan | Ground truth, tanpa tool |
| Research | 22 | task | Rubrik khusus task |
| Design | 25 | task | Render file lalu pemeriksaan visual dan struktural |

Subkategori lengkap ada di `data/benchmarks/suite-taxonomy.json`. Pecahan per subkategori untuk Reasoning dan Data Analysis tidak tersedia pada sumber (sumber hanya menampilkan angka 1 per baris), sehingga ditulis `null`, bukan ditebak.

## Aturan skor

- Skor suite adalah rata-rata semua task, bukan rata-rata subkategori.
- Task tidak terukur dihitung 0 dan tidak dibuang.
- Overall adalah rata-rata suite yang punya skor, berbobot sama. Sel kosong dan `n/a` tidak ikut; model yang tidak punya input yang dibutuhkan suite mendapat 0.
- Biaya per task adalah total biaya dibagi total task. Biaya per task sukses adalah (biaya per task / skor) x 100, tidak terdefinisi bila skor 0.

Implementasi ada di `lib/suite-scoring.ts` dan diuji perilakunya oleh `npm run suites:n142:benchmark`.

## Posisi Zenith (audit kode, belum diukur)

| Suite | Status | Catatan utama |
|---|---|---|
| Reasoning | SUPPORTED_UNMEASURED | `qwen3:8b` dengan thinking adaptif |
| Agentic | PARTIAL | Extended loop terbatas; belum ada bukti ketahanan lintas giliran |
| Coding | PARTIAL | Developer Intelligence ada; belum dievaluasi pada bug repositori besar |
| Data Analysis | PARTIAL | N1.4.2: hanya pembaca tabel. Sejak N1.5 ada handler konversi, runtutan, dan pemetaan kolom (lihat `docs/table-engine-n1.5.md`) |
| Research | PARTIAL | Retrieval lokal ada; tidak ada pencarian web langsung. Sejak N1.5 ada kerangka laporan bersumber |
| Browser Use | NOT_SUPPORTED | Tidak ada jalur screenshot, eksekutor browser, dan host lokal diblokir kebijakan |
| Design | NOT_SUPPORTED | Tidak ada penghasil DOCX, PDF, atau PPTX |

Detail bukti dan celah: `data/runtime/suite-capability-map.json`. Benchmark live berstatus `NOT_RUN`; tidak ada skor yang boleh diklaim dari berkas ini.

## Biaya

Zenith berjalan lokal di Ollama tanpa harga list API, jadi metrik biaya USD tidak berlaku. Gunakan token, latensi, dan RAM/VRAM bila perlu membandingkan.

## Validasi

```powershell
npm run suites:n142:status
npm run suites:n142:benchmark
npm run model:n14:benchmark
npm run answer:benchmark
npm run naming:audit
npm run ui:check
npm run knowledge:check
```

`suites:n142:benchmark` memuat `lib/suite-scoring.ts` langsung dan memerlukan Node 22.18 atau lebih baru. Pada Node lebih lama bagian perilaku dilaporkan `SKIPPED`, bukan lulus.
