# Sisa acceptance N2

Gate aktivasi tetap tertutup. Status berikut tidak berarti kemampuan sudah ada.

| Fase / capability | Status | Yang dibutuhkan untuk lanjut |
|---|---|---|
| P0 build/auth/MCP denial | PARTIAL | Tutup seluruh acceptance security; audit semua sink; perbaiki checker health; tangani moderate advisory |
| P0/P1 Windows process isolation | BLOCKED | Job object/supervisor owning lifecycle, filesystem/network sandbox, parent-exits-first tests yang membuktikan isolation |
| A Agentic runtime | NOT_IMPLEMENTED | Unified durable run/DAG/step/evidence manager, cancellation/STOP, budgets, checkpoint/resume, SSE, progress/no-progress tests |
| C Coding vertical | NOT_IMPLEMENTED | Approval issuer/UI, isolated worktree transactional patch, model fixture, allowlisted verification, rollback/cancel evidence |
| B Browser operator | NOT_IMPLEMENTED | Playwright worker, DNS/IP pinning, redirects/subresources, scoped local QA, bound submit approval, trace/download quarantine |
| D Data analysis | NOT_IMPLEMENTED | Dirty dataset golden tests, schema/missing/duplicate/outlier/groupby/statistics, 3 charts, clean exports, recipe/hash |
| R Research | NOT_IMPLEMENTED | Configured live provider or labeled offline mode, source fetch ledger, evidence spans, conflict/freshness/citation checks |
| U Design + Workbench | NOT_IMPLEMENTED | Brief/tokens/editable prototype/preview, eight-pane Workbench, actual screenshots, controls/state/accessibility coverage |
| P5 release | BLOCKED | Six real E2E paths, cold install, Windows target smoke, CI Linux/Windows, security/regression review, human review |

Pengguna menyetujui commit dan push pada 20 Oktober 2026. Checkpoint fondasi dikirim melalui branch `feat/zenith-n2-agentic-workbench` untuk draft PR. Tidak ada issue GitHub dibuat dari roadmap ini; seluruh acceptance yang belum selesai tetap menjadi pekerjaan lanjutan sebelum merge/release.
