# NusaMind R13.43 — Python Machine Learning Service

Python ML adalah service tambahan. Ollama/Qwen tetap menangani percakapan dan reasoning utama. Next.js tetap menangani UI, API, session, SQLite, dan tool runtime.

## Fungsi aktif

- klasifikasi domain dan intent;
- sentimen, emosi, urgensi, dan risiko;
- deteksi pola PII;
- embedding multilingual dengan fallback feature hashing;
- semantic similarity;
- anomaly detection;
- answer quality evaluator;
- supervised intent training dari CSV;
- model registry, reload, health report, dan graceful fallback.

## Instalasi

```powershell
.\ml-setup.bat
```

Untuk backend semantic transformer/GPU opsional:

```powershell
.\ml-setup-gpu.bat
```

Pemilihan paket GPU/CUDA harus disesuaikan dengan instalasi driver dan PyTorch pada komputer. Service tetap berfungsi tanpa paket transformer melalui fallback hashing + scikit-learn.

## Menjalankan

Terminal 1:

```powershell
.\ml-start.bat
```

Terminal 2:

```powershell
npm run dev
```

Terminal 3:

```powershell
.\apex.bat
```

Ganti launcher sesuai edition.

## Training classifier

Dataset harus berada di `ml-service/datasets/` dan memiliki kolom `text,label`.

```powershell
cd ml-service
.\.venv\Scripts\Activate.ps1
python train.py --dataset intent-seed.csv
```

Training endpoint dilindungi `NUSAMIND_ML_TOKEN`. Model disimpan di `ml-service/models/intent.joblib` dan dapat direload tanpa mengubah UI.

## Guardrail

- ML hanya memberi sinyal pendukung.
- Keputusan medis, hukum, finansial, klaim, dan keamanan tidak boleh dibuat hanya dari prediksi ML.
- Service bind ke `127.0.0.1` secara default.
- Chat tetap berjalan saat ML service mati atau timeout.
- File model dan virtual environment tidak dimasukkan ke ZIP distribusi.
