# Arsitektur yang benar-benar ada pada checkpoint

Browser mengirim Basic credential melalui dialog autentikasi browser. CLI memakai Bearer ADMIN_TOKEN atau header kredensial per domain. `proxy.ts` memeriksa autentikasi dan origin sebelum meneruskan halaman/API; handler sensitif yang diperbaiki memeriksa auth lagi sebelum parsing/dispatch. Tidak ada trust berdasarkan Host atau sessionId.

`lib/api-auth.ts` membatasi role token coding/autonomy/desktop/knowledge ke kelompok endpoint masing-masing. ADMIN_TOKEN adalah kredensial owner. Origin berasal dari `NUSAMIND_APP_ORIGIN`, bukan URL atau forwarded header caller. Basic pada mutasi wajib memiliki Origin yang tepat; CLI Bearer tanpa Origin tetap dapat dipakai. Perubahan autentikasi ini merupakan migrasi kontrak yang disengaja.

`lib/action-approval.ts` menyimpan hanya hash token dan hash scope di tabel versioned SQLite. Konsumsi adalah satu UPDATE atomik, berlaku sekali sebelum expiry. Belum ada API issuer, approval drawer, atau integrasi semua side effect lama. Executor lama tetap diblokir; boolean `approved/confirmed` tidak membuka blokir.

`lib/tool-registry.ts` memvalidasi schema, menolak desktop execution tanpa OS sandbox, dan mengharuskan approval bound untuk risiko medium/high. Consumer workflow lama masih Apex-only; checkpoint tidak menaikkan hak Zenith menjadi Apex.

`packages/autonomy-engine/process.ts` memakai lingkungan minimal, capture output terbatas, AbortSignal, timeout, dan penghentian process tree. Ini supervisor proses biasa, **bukan sandbox**. Windows orphan setelah parent keluar memerlukan Job object/supervisor terverifikasi. `task-runner` memakai supervisor yang sama.

MCP hanya dapat diregistrasi sebagai metadata lokal melalui fungsi internal; inspect/call selalu UNAVAILABLE. Browser URL check hanya preflight hostname dan tidak memberi izin jaringan. Tidak ada browser worker produk yang aktif.

Legacy ChatShell, corpus, retrieval, memory, model routing, ML source, Quran, dan CLI dipertahankan. Referensi nama file corpus yang salah diperbaiki; kontennya tidak diubah. Source upgrade dan batas acceptance tetap tersedia di `docs/upgrade-n2/`.
