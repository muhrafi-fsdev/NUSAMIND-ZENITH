# Yang belum selesai / belum diverifikasi

Status produk: **N2.0 BLOCKED**, bukan RC/GA. Gate fondasi yang hijau adalah pemeriksaan source/fixture terbatas, bukan seluruh acceptance upgrade.

- Unified run manager, durable run/event journal, DAG execution, safe resume, kill-switch terpadu, SSE, approval issuer/UI, dan coding patch/worktree vertical: NOT_IMPLEMENTED.
- Browser operator produk dan perimeter egress OS/DNS/redirect/subresource: NOT_IMPLEMENTED. Tes browser yang tersedia adalah QA aplikasi sendiri, bukan kemampuan agent browser.
- Pipeline data quality/aggregations/charts/clean dataset, Python sandbox, research provider/evidence ledger, design agent dan Workbench delapan pane: NOT_IMPLEMENTED. Parser upload existing tetap dapat dipakai; itu tidak disamakan dengan analisis data lengkap.
- Model nyata, ML FastAPI, MySQL, MCP echo/hostile protocol integration, real external research, dan Linux execution: NOT_RUN. Tidak ada model atau binary browser baru diunduh. CI disiapkan tetapi belum dijalankan di GitHub.
- Bound approval library belum menjadi permission end-to-end untuk seluruh legacy sink. Eksekusi lama yang belum aman diblokir, termasuk build/install/start/app/file mutation melalui API lama. Ini perubahan perilaku yang disengaja dan harus direview.
- Windows orphan process belum diisolasi. AbortSignal pada fungsi JS bergantung pada implementasi yang kooperatif. In-process parser belum berada dalam worker dengan batas RAM/CPU OS.
- Coverage path/secret/auth bukan audit menyeluruh semua modul. Rate limiter berada dalam memory satu proses. Basic auth hanya untuk pemakaian loopback; tidak ada rancangan layanan multi-user atau deployment publik.
- `health:test` checker historis masih gagal; benchmark N1 tanpa bukti sengaja exit 2/NOT_RUN. Empat warning lint legacy ChatShell dan empat warning tracing build masih dicatat. Jangan menyatakan semua gate release lama lulus.
- Screenshot 390/1440, calculation, dan fokus keyboard diuji. Audit WCAG lengkap, seluruh kontrol, seluruh state, screen reader dan visual regression baseline lengkap belum dilakukan.
- Commit, push branch upgrade, dan draft PR disiapkan setelah persetujuan eksplisit pengguna pada 20 Oktober 2026. Tidak ada merge, tag release, deployment, perubahan database produksi, perubahan credential, atau akses .env/vault pribadi. Bukti pengujian dan paket ZIP sebelumnya tetap merekam keadaan checkpoint sebelum publikasi.
