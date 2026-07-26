# Apex Coding Agent

Apex Coding Agent membuat **project baru** di workspace terbatas. Fitur ini tidak bebas menulis ke seluruh drive dan tidak menimpa project lama.

## Keamanan

- Nonaktif secara default.
- Hanya localhost atau token lokal.
- Selalu meminta konfirmasi sebelum aksi.
- Target wajib berada di `CODING_AGENT_WORKSPACE`.
- Project target harus baru atau kosong.
- Maksimal file dibatasi.
- Install/build hanya menggunakan npm tanpa shell bebas.
- Auto-repair build dibatasi satu putaran.
- Rollback hanya boleh pada folder yang memiliki marker job yang cocok.
- Semua aksi dicatat di `storage/coding/actions.jsonl`.

## Konfigurasi

```env
CODING_AGENT_ENABLED=true
CODING_AGENT_CONFIRMATION_REQUIRED=true
CODING_AGENT_WORKSPACE=C:\laragon\www\nusamind-workspace
CODING_AGENT_TOKEN=
CODING_AGENT_MAX_FILES=100
CODING_AGENT_MAX_STEPS=12
```

Setelah mengubah `.env`, restart server Next.js.

## Menjalankan

```powershell
npm run dev
```

Terminal lain:

```powershell
.\code.bat
```

## Command

```text
/coding status
/project-plan "C:\laragon\www\nusamind-workspace\landing" buat landing page modern
/project-create "C:\laragon\www\nusamind-workspace\landing" buat landing page modern lalu jalankan
/project-build JOB_ID
/project-start JOB_ID 3100
/project-stop JOB_ID
/project-job JOB_ID
/project-rollback JOB_ID
/project-logs
```

## Natural chat

```text
Buat landing page jasa website, simpan di "C:\laragon\www\nusamind-workspace\landing-jasa" lalu jalankan
```

Alur eksekusi:

1. Membuat manifest project melalui model coding.
2. Memvalidasi setiap path relatif.
3. Menulis project baru.
4. Menjalankan `npm install`.
5. Menjalankan `npm run build`.
6. Jika build gagal, mencoba satu patch terkontrol lalu build ulang.
7. Menyalakan dev server jika diminta.
8. Menampilkan job ID, lokasi project, status, dan URL.
