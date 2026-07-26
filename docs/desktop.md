# Desktop Control Safety

Desktop execution **nonaktif secara default**. Flash hanya suggestion. Lite hanya whitelist read-only. Max menambah command developer terbatas dengan preview, confirmation, workspace sandbox, timeout, audit, dan emergency stop.

Aktifkan dengan sadar risiko melalui `.env`:

```env
DESKTOP_CONTROL_ENABLED=true
DESKTOP_CONTROL_TOKEN=ganti-token-kuat
DESKTOP_ALLOWED_ROOTS=C:\laragon\www\project
```

Command destructive, shell chaining, format disk, registry edit, dan penghapusan massal selalu diblokir.
