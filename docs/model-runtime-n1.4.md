# NusaMind N1.4 — Adaptive Qwen3 Model Runtime

## Model bawaan

| Jalur | Model |
|---|---|
| General/reasoning | `qwen3:8b` |
| Coding stabil | `qwen2.5-coder:7b` |
| Fallback | `qwen2.5:7b` |
| Heavy coding opsional | `qwen3-coder:30b` |

## Kebijakan runtime

- Model terpasang diprofilkan melalui Ollama `/api/tags` dengan cache singkat.
- Bila model utama belum tersedia, runtime memilih kandidat fallback yang sudah terpasang.
- Thinking hanya aktif pada model Qwen3 dan mengikuti kebijakan edisi: `auto`.
- Thinking tidak dimasukkan ke jawaban akhir pengguna.
- Heavy coder tidak aktif otomatis. Pada Apex, aktifkan hanya dengan `NUSAMIND_HEAVY_CODER_ENABLED=true` setelah model tersedia.
- Context default dibatasi pada 16384 token untuk jalur umum dan 12288 token untuk coding agar resource lokal tetap terkendali.

## Validasi

```powershell
npm run model:n14:status
npm run model:n14:status:live
npm run model:n14:benchmark
npm run prompt:test
npm run check
npm run build
```

## Catatan

N1.4 tidak mengubah UI utama. Production build dan performa live model harus diuji pada perangkat pengguna karena dipengaruhi RAM, VRAM, quantization, context, dan versi Ollama.
