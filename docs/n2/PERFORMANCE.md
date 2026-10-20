# Pengukuran dan batas klaim

Durasi wall-clock setiap command verifikasi direkam dari proses nyata dalam `evidence/commands.json`. Nilai ini mencakup startup Node/npm, scanner, dan host Windows; bukan benchmark kemampuan agent.

Browser UI yang dipakai untuk evidence: Edge `155.0.4283.62`, Playwright `1.64.1`, profil ephemeral, 1 worker, viewport 390x900 dan 1440x900. Chromium cache 153 tidak dapat di-spawn pada host ini; tidak diunduh binary pengganti. Skor screenshot bukan angka performa.

Peak RSS/CPU child, token model, p50/p95 task latency, cold/warm Ollama, kapasitas 16GB, dan throughput enam capability: **NOT_RUN**. Tidak ada angka task-success atau live model benchmark yang diturunkan dari metadata.

Gate source menggunakan workers build=2 dan browser QA=1. Tidak ada worker model/ML/browser produk yang dibiarkan berjalan setelah tes. Port fixture 32174/32175 dan benchmark 31102 dimiliki tes dan dihentikan pada cleanup.
