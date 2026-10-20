# Batas kepercayaan dan gate terbuka

| Ancaman | Kontrol checkpoint | Bukti/batas |
|---|---|---|
| Host spoofing / localhost bypass | Strong configured credential; proxy seluruh app/API; direct guards untuk handler yang disentuh | Unit dan HTTP negatif |
| CSRF / DNS-rebinding ke localhost | Basic write wajib configured Origin; cross-origin/fetch-site ditolak; loopback binding | HTTP/Basic tests; ini bukan egress policy |
| SessionId / forwarded IP mengubah kuota | Identitas credential yang di-hash, namespace API/chat terpisah | Unit; kuota masih per proses |
| Approval diubah, expired, dipakai ulang | Hash scope + UPDATE SQLite single-use | Unit dengan reopen database; belum alur issuer/UI |
| Arbitrary legacy shell/build/deploy | Aksi berisiko mengembalikan 423; dispatcher desktop.execute ditolak | Unit dan HTTP; kemampuan lama sengaja dibatasi |
| Request menentukan sendiri home workspace | Home milik server; realpath dan owner root | Unit/HTTP; belum audit semua I/O lama |
| Symlink/junction escape | Canonical path pada trusted resolver; scanner tidak mengikuti link | Fixture junction Windows |
| Untrusted MCP inspect / wrapper palsu | Tidak ada spawn MCP sama sekali | Hostile marker fixture; echo/SDK handshake NOT_RUN |
| SSRF browser, redirect, DNS rebinding | Browser executor belum diaktifkan; seluruh IP literal/local hostname preflight ditolak | DNS pinning, redirect dan subresource perimeter NOT_IMPLEMENTED |
| Prompt injection menjadi otorisasi | Data tidak menerbitkan credential/approval; schema strict; legacy execution diblokir | Negative schema/scope tests; bukan bukti ketahanan semantic model lengkap |
| Secret ke worker/artifact | Environment worker minimal; upload scan sesudah dekompresi; masked replay lama dipertahankan | Fixture token XLSX; bukan audit seluruh secret sink |
| Timeout / runaway child | AbortSignal dan taskkill/process group; kegagalan taskkill bukan sukses | Live-parent fixture diuji; Windows orphan tetap gap |

## Penghalang P0/P1

Windows `taskkill /T` tidak membuktikan cleanup jika parent telah mati. Menurut review statis, child yang memakai ignored stdio bisa bertahan setelah parent selesai; child yang mempertahankan pipe bisa membuat close menunggu. Fixture parent-exits-first memastikan kegagalan cleanup tidak diklaim sukses dan membersihkan PID fixture bila masih hidup; fixture ini tidak membuktikan semua orphan akan bertahan atau terisolasi pada setiap host. Diperlukan Windows Job object atau supervisor/sandbox yang memiliki seluruh lifecycle proses sebelum arbitrary/generated code dapat diaktifkan.

Browser egress belum memiliki DNS/IP pinning, redirect dan subresource enforcement. Jangan mengubah metadata preflight menjadi izin fetch. Belum ada sandbox Windows yang diverifikasi untuk MCP, script dari repo, atau generated Python.

Masih ada 3 advisory produksi moderate pada rantai mammoth/argparse/sprintf-js. Tidak dilakukan downgrade otomatis yang ditawarkan audit karena akan mengganti API secara tidak aman. Detail advisory disimpan dalam evidence. ESLint 9 dipin karena plugin React milik konfigurasi Next saat ini belum mendukung ESLint 10; warning deprecation dipertahankan dalam evidence cold install.

Kesimpulan gate: mitigasi akses biasa dapat diuji; kelengkapan P0 sistem **BLOCKED**. Jangan lanjut aktivasi network/code worker, merge, atau release N2 berdasarkan checkpoint ini.
