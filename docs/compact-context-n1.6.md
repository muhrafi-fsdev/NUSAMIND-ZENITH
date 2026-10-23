# Compact Context dan Profil 4 GB (N1.6)

Dokumen ini menjawab satu pertanyaan: **berapa juta token per chat atau konteks** pada mesin 4 GB, dan bagaimana NusaMind tetap berguna dengan batas itu.

## Jawaban singkat

| Yang ditanyakan | Jawaban |
|---|---|
| Token yang **aktif** di model sekaligus (profil `4gb`) | **4.096 token** |
| Riwayat chat yang **tersimpan dan bisa dicari ulang** | **Jutaan token** (di SQLite, tanpa batas keras selain disk) |
| Jutaan token **aktif sekaligus** di mesin 4 GB | **Tidak mungkin**, lihat hitungan di bawah |

Model tidak pernah membaca seluruh arsip. Tiap giliran, NusaMind mengirim pesan terbaru apa adanya, ringkasan pesan yang lebih lama, dan beberapa potongan arsip yang cocok dengan pertanyaan. Ini bukan "ingatan jutaan token"; ini pencarian atas arsip.

## Kenapa jutaan token tidak muat

KV cache (memori perhatian model) tumbuh linear dengan jumlah token. Untuk `qwen3:1.7b` (28 layer, 8 KV head, head_dim 128):

```
byte per token = 2 x 28 x 8 x 128 x 2 byte (f16) = 114.688
```

| Token aktif | KV f16 | KV q8_0 | KV q4_0 |
|---:|---:|---:|---:|
| 4.096 | 0,44 GiB | 0,22 GiB | 0,11 GiB |
| 32.768 | 3,50 GiB | 1,75 GiB | 0,88 GiB |
| 131.072 | 14,00 GiB | 7,00 GiB | 3,50 GiB |
| 1.000.000 | **106,81 GiB** | 53,41 GiB | 26,70 GiB |
| 2.000.000 | 213,62 GiB | 106,81 GiB | 53,41 GiB |

Angka itu **belum** termasuk bobot model (±1,4 GB). Pada anggaran model sekitar 2.000 MB, konteks terbesar yang muat adalah 2.048 token (f16), **4.352 (q8_0, dipakai profil 4gb)**, atau 8.704 (q4_0). Model juga punya batas posisi sendiri (40.960 untuk `qwen3:1.7b`). Hitung ulang kapan saja dengan `npm run context:n16:status`.

## Profil perangkat keras

Pilih dengan `NUSAMIND_HARDWARE_PROFILE` di `.env`. Bawaan: `4gb`.

| Profil | Model utama | Model coding | Konteks | KV | Tools/agent | Prompt |
|---|---|---|---:|---|---|---|
| `4gb` | qwen3:1.7b | qwen2.5-coder:1.5b | 4.096 | q8_0 | nonaktif | ringkas |
| `8gb` | qwen3:4b-q4_K_M | qwen2.5-coder:3b | 8.192 | q8_0 | aktif | ringkas |
| `16gb` | qwen3:8b | qwen2.5-coder:7b | 16.384 / 12.288 | f16 | aktif | penuh (perilaku N1.4) |

Perkiraan memori profil `4gb` (bobot + KV + overhead 350 MB): model utama ±1.985 MB, model coding ±1.395 MB. Satu model dimuat pada satu waktu (`OLLAMA_MAX_LOADED_MODELS=1`). Batas perencanaan 60% RAM = 2.400 MB, sisanya untuk Windows, Next.js, dan browser; pada mesin 4 GB ruangnya sempit.

**Kembali ke 16 GB:** set `NUSAMIND_HARDWARE_PROFILE=16gb`, jalankan `ollama.bat`, dan hentikan server Ollama dari `ollama-4gb.bat` bila masih berjalan.

**Peringatan `.env` lama:** variabel `OLLAMA_MODEL`, `OLLAMA_CODER_MODEL`, `OLLAMA_FALLBACK_MODEL`, `OLLAMA_THINKING_MODE`, `OLLAMA_NUM_CTX`, `OLLAMA_CODER_NUM_CTX`, `AI_MAX_STEPS`, `AI_MAX_OUTPUT_TOKENS`, dan `AI_ENABLE_TOOLS` **menimpa profil**. Jika `.env` Anda dibuat dari `.env.example` versi N1.5 atau lebih lama, baris itu berisi nilai 16 GB dan profil `4gb` tidak berlaku. Hapus atau komentari baris tersebut.

## Cara kompaksi bekerja

Tanpa panggilan model tambahan, sepenuhnya deterministik:

1. **Pesan terbaru verbatim**, dengan batas panjang per pesan.
2. **Ringkasan ekstraktif** untuk pesan lebih lama: kalimat terpilih, bukan tulisan ulang oleh model, sehingga tidak ada halusinasi ringkasan, tetapi nuansa bisa hilang.
3. **Fakta berbobot** (identitas, preferensi, tenggat). Rahasia yang terdeteksi disamarkan sebelum masuk ringkasan.
4. **Recall arsip:** kata kunci pertanyaan dicari di SQLite, diberi skor BM25, dibuang bila terlalu mirip satu sama lain, dan wajib cocok minimal setengah dari kata kunci. Hasilnya ditaruh di pesan pengguna terakhir.
5. **Pemangkasan per blok** yang selaras dengan nomor pesan absolut, agar awalan prompt tidak berubah tiap giliran dan cache prompt Ollama bisa dipakai ulang.
6. **Prompt ringkas** (±330 token inti aturan, menggantikan ±4.700 token prompt penuh). Aturan keselamatan dan kejujuran dipertahankan; catatan rilis, menu CLI, dan deskripsi fitur tidak dikirim. Sumber dikirim **sekali** sebagai blok evidence yang ditandai tidak tepercaya.
7. **Jaminan muat:** jika masih melebihi jendela, pemangkasan berurutan: sumber, prompt penuh ke ringkas, memori, konteks sesi, lalu potong keras. Batas keluaran model dikunci agar `input + output` tidak melampaui `num_ctx`.

Penaksir token (`estimateQwenTokens`) adalah heuristik; NusaMind mengkalibrasinya dengan `usage.inputTokens` dari model dan memakai faktor aman 1,15.

## Cara mengukur di mesin Anda

```powershell
.\ollama-4gb.bat          # menyetel env server Ollama dan menarik model profil 4gb
ollama ps                 # kolom SIZE = memori nyata model yang sedang dimuat
npm run context:n16:status
npm run context:n16:benchmark
```

Respons chat membawa header `x-nusamind-hardware-profile` dan `x-nusamind-context` (ringkasan token per bagian). `POST /api/chat-json` menambah field `context`.

## Trade-off yang perlu diketahui

- **Kualitas model.** Model 1,7B jauh lebih lemah dari 8B untuk penalaran berlapis, matematika panjang, dan coding rumit. Kompaksi tidak memperbaikinya. Kualitas jawaban profil `4gb` **belum diukur** dengan suite live (`NOT_RUN`).
- **Tools dan agent nonaktif** di `4gb` (`AI_ENABLE_TOOLS` dapat menyalakannya). Dokumentasi Ollama menyarankan konteks setidaknya 64.000 token untuk tugas agen dan coding tools, sedangkan jendela 4gb hanya 4.096.
- **Recall berbasis kata kunci.** Pertanyaan yang memakai sinonim dari yang pernah ditulis bisa gagal menemukan arsip.
- **Mode penuh (`16gb`) mengirim sumber dua kali** (di prompt sistem dan di blok evidence). Itu perilaku lama dan tidak diubah; mode ringkas tidak mengalaminya.

## Perbaikan yang ditemukan saat pengujian

- `saveSession` (dipanggil lewat `updateSessionMeta` dan `session-continuity`) menghapus semua pesan di atas 160 terbaru dari database. Tanpa perbaikan, arsip jutaan token akan terhapus saat judul sesi diganti atau sesi disematkan. Penghapusan itu dibuang; ada uji regresi (`F.saveSession.keepsArchive`).
- Memuat sesi tanpa batas membaca seluruh riwayat pada tiap giliran. Jalur panas kini memuat 200 pesan terbaru (`RECENT_WINDOW`) beserta `totalMessages`. `GET /api/sessions` ikut dibatasi 200 pesan; sebelumnya paling banyak 160 sehingga tampilan UI tidak berubah.
- `chat-json`: variabel `modelRuntime` dipakai sebelum diinisialisasi pada jalur finance lokal.

## Asumsi dan yang belum diuji

- Overhead runtime 350 MB adalah asumsi; bobot `qwen2.5:7b` ditandai `weightsVerified: false` di `data/runtime/hardware-profiles.json`.
- `ollama-4gb.bat` belum dijalankan di Windows dan belum diuji di perangkat 4 GB nyata.
- Uji otomatis (`npm run context:n16:benchmark`) memakai kasus buatan sendiri dengan ekspektasi yang diturunkan dengan tangan dari rumus; belum ada benchmark kualitas jawaban dengan model sungguhan.
- Peringatan Turbopack tentang pelacakan berkas pada `/api/n1/security` masih muncul saat build; jinak karena Dockerfile tidak memakai output standalone.
