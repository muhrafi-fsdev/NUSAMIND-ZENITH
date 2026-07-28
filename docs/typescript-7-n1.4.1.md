# NusaMind Zenith N1.4.1 — TypeScript 7

Patch ini menjadikan TypeScript 7 native sebagai compiler utama untuk `npm run check`.

## Instalasi dependency

```powershell
npm install
```

Perintah tersebut membuat `package-lock.json` baru yang sesuai dengan TypeScript 7 dan paket kompatibilitas TypeScript 6.

## Validasi

```powershell
npm run typescript:n141:status
npm run check
npm run check:legacy
npm run check:dual
npm run typescript:n141:benchmark
npm run build
```

## Arsitektur compiler

- `tsc`: TypeScript 7 native, compiler utama.
- `tsc6`: TypeScript 6 compatibility compiler untuk tooling yang masih membutuhkan implementasi lama.
- TypeScript 7 belum menyediakan Compiler API; jangan mengimpor API dari paket native.

Patch ini meningkatkan proses typecheck dan diagnostic. Patch ini tidak mengubah model Qwen, kualitas inferensi, UI, atau Python ML Service.
