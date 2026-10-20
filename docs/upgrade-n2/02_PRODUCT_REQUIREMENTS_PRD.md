# PRD: NUSAMIND ZENITH N2.0 Agentic Engineering & Research Workbench

## 1. Produk dan positioning

**Problem:** N1.4.1 mempunyai banyak modul kebijakan, rencana, pengetahuan dan evaluasi, tetapi pengguna membutuhkan alur produktif yang terintegrasi, bisa menjalankan tugas nyata, aman, dapat diaudit dan mudah dipakai dari Web/CLI. Label `agentic`, `browser`, atau `research` baru boleh ditampilkan `AVAILABLE` jika ada executor, tool availability, verifikasi runtime dan demo teruji.

**Target user:** mahasiswa/developer/peneliti/pekerja data/desainer yang menginginkan asisten AI lokal berbahasa Indonesia pada Windows. **Nilai utama:** kemampuan bekerja lintas alat (bukan hanya chat), kontrol pengguna, transparansi evidence, privasi local-first, dan hasil dapat diambil keluar dari aplikasi.

**Out of scope N2.0:** autonomous production deployment, payment/account mutation, CAPTCHA bypass, scanning networks without authorization, scraping password/cookie, forced installation heavy AI model, visual/image model tanpa provider tersedia, n8n wajib, pembatalan edisi Zenith/Apex/Swift.

## 2. Persona & user stories

| Persona | Story | Outcome yang dapat diukur |
| --- | --- | --- |
| Mahasiswa / research | Saya meminta riset terkait topik terkini dengan sitasi | Paper/report + tautan sumber + publish/observed date + batas klaim |
| Full-stack developer | Saya minta debugging bug konkret di repo | Diff, tes green, log, rollback tersedia |
| QA / operator | Saya minta cek interaksi website dan screenshot | Trace browser, URL, screenshot, verifikasi UI aktual |
| Analis data | Saya upload data CSV kotor dan minta insight | Profil kualitas, transformasi reproducible, chart, export |
| UI/UX designer | Saya minta prototype responsive berdasarkan brief | Source code, design tokens, preview screenshot, audit a11y |
| Pengguna kontrol tinggi | Saya ingin memeriksa dan menghentikan apa saja yang AI lakukan | Approval panel, kill-switch, cancellation, spend/step budget, audit |

## 3. Capability requirements

### CAP-01 Agentic
**Input:** goal, workspace, desired mode, limits, optional attachments.
**Output:** plan DAG + progress events + tool executions + approvals + evidence + final summary.
**Functional requirements:** persisted run state, workflow queue, tool schema registry, role separation, safe context selection, user approval gate, bounded retries, cancellation, replan if needed, checkpoint recovery with idempotency, failed-step evidence, deep inspect UI.
**Acceptance:** fixture 4-step workflow succeeds with real tools; failure path stops safely; cancel prevents subsequent side effects; resume does not duplicate prior write; untrusted tool text does not issue commands.

### CAP-02 Coding
**Input:** repository/workspace path, task/issue, tests, framework.
**Output:** code edits (diff), validation results, changelog, artifacts, optional branch/PR.
**Functional requirements:** source search/index, AST/LSP as practical, plan patch, safe worktree, transaction & rollback, TS/JS/Python support, scoped terminal tool templates, build/test/lint/format, failing test diagnosis, review by evidence, no unrelated edits.
**Acceptance:** fixture with failing Next/TS function: model diagnoses, proposes diff, user approves, patches only allowed file(s), typecheck & test pass, rollback test restores baseline. Repo read-only mode must not write.

### CAP-03 Browser Use
**Input:** approved website and typed browser task.
**Output:** extracted page data, step logs, screenshot, trace, verified outcome.
**Functional requirements:** real Playwright service; navigate, read, click, type, selection, multi-page, scrolling, screenshot, safe downloads, bounded browsing, context isolation, policy on network egress/URL & redirect, proactive approval on submit/login/upload/publish. Local QA sites require explicit scoped opt-in.
**Acceptance:** offline fixture: browse page, fill draft, screenshot, extract table; submit denied until explicit approval; localhost/private address blocked without QA policy; downloads quarantined; trace reproducible. CAPTCHA stop & handoff.

### CAP-04 Data Analysis
**Input:** CSV, Excel/JSON, optional PDF tables; question and desired chart/transform.
**Output:** reproducible notebook-like analysis report, DataFrame snapshot, charts, filtered CSV, summary.
**Functional requirements:** clean schema; encoding/date/decimal detection, missingness, duplicates, descriptive statistics, outliers, grouping, correlations with caveats, chart export and formulas; optional isolated Python worker, source hash and transformation history.
**Acceptance:** known fixture of 100 rows: expected aggregates match deterministic golden reference; rejected unsafe formula CSV; missing and duplicate counts correct; charts include axis names and units; invalid inputs fail readably.

### CAP-05 Research
**Input:** topic/questions, requested period, sources, offline/online policy.
**Output:** grounded research report with claim-evidence links, time context, citations, contradictions.
**Functional requirements:** plan queries; optional web search provider (only when configured and authorized); source retrieval/extraction; dedup/caching/hash; publication vs accessed dates; source type/credibility; references, citation validator and uncertainty; local corpus fallback marked offline.
**Acceptance:** at least 2 distinguishable mock/real fixtures with conflicting claims; answer cites evidence spans; unsupported assertion withheld; offline mode never pretends current source; failure state accurate.

### CAP-06 Design
**Input:** design brief + optional inspiration + target framework + branding.
**Output:** site/page prototype or component, design tokens, editable code, preview/screenshot, responsive/a11y report.
**Functional requirements:** process spec -> wireframe/content hierarchy -> structured design tokens -> components -> preview -> visual QA -> iterative fixes; accessible form semantics, mobile responsive; exports HTML/CSS/TSX/SVG where supported; optional image/Figma integrations as capabilities, no fake asset synthesis.
**Acceptance:** fixture landing + dashboard at 390px and 1440px produces functional interaction without overflow, clear typographic hierarchy, accessible focus state, screenshot matches generated code.

## 4. UX / IA

New Workbench (preserve existing ChatShell):
- **Global navigation:** Chat, Runs, Code, Browser, Data, Research, Design, Settings.
- **Run detail:** user goal, status, plan DAG, activity timeline, approval drawer, file/tool evidence, artifacts, budget, cancel/retry.
- **Mode-specific panes:** Code -> file tree/diff/test; Browser -> screenshot/URL/action timeline; Data -> preview/table/charts; Research -> evidence/citations; Design -> tokens/editor/preview.
- **Responsive:** large desktop 1440x900, laptop 1366x768, mobile 390x844; no horizontal scroll; keyboard focus, meaningful aria labels; English backend errors mapped into human Indonesian.
- **UX errors:** distinguish `awaiting-approval`, `running`, `stopped`, `failed`, `unavailable`, `not-configured`, `degraded` without ambiguous green success states.

## 5. Data & contract model (suggested, adapt to existing architecture)

```ts
type RunState = 'QUEUED'|'PLANNING'|'AWAITING_APPROVAL'|'RUNNING'|'VERIFYING'|
  'SUCCEEDED'|'FAILED'|'CANCELLED'|'PAUSED'|'BLOCKED';
type Capability = 'agent'|'coding'|'browser'|'data'|'research'|'design';
type ToolState = 'DISABLED'|'NOT_INSTALLED'|'AVAILABLE'|'DEGRADED'|'FAILED';
interface RunRecord { id:string; goal:string; capability:Capability; status:RunState;
  owner:string; workspaceId?:string; createdAt:string; updatedAt:string;
  budget:{maxSteps:number;maxRuntimeMs:number;maxConcurrency:number}; }
interface StepRecord { id:string;runId:string;type:string;toolId?:string;
  status:RunState;inputHash:string;resultHash?:string;verification?:VerificationRecord; }
interface EvidenceRecord { id:string;runId:string;stepId:string;kind:string;
  sourceUri?:string;sha256:string;capturedAt:string;redacted:boolean; }
interface ApprovalRecord { id:string;runId:string;toolId:string;argsHash:string;
  expiresAt:string;usedAt?:string;decision:'allow'|'deny'; }
interface VerificationRecord { status:'PASSED'|'FAILED'|'NOT_RUN'|'BLOCKED';
  verifierId:string;detail?:string;evidenceIds:string[]; }
```

Guidance: use durable versioned SQLite entities if necessary. No secret values inside RunRecord/EvidenceRecord. User-visible logs redact PII, token, cookies and sensitive path while retaining diagnostic utility. Migration must preserve legacy sessions and artifacts.

## 6. Integration and flags

| Flag (example only) | Default | Behavior |
| --- | --- | --- |
| `NUSAMIND_N2_AGENT_ENABLED` | false until tested | New orchestration behind rollout gate |
| `NUSAMIND_BROWSER_ENABLED` | false | Browser worker disabled until installed/configured |
| `NUSAMIND_BROWSER_ALLOW_LOCAL_QA` | false | Only explicit test fixtures and scoped URLs |
| `NUSAMIND_DATA_WORKER_ENABLED` | false | Isolated Python worker optional |
| `NUSAMIND_WEB_RESEARCH_ENABLED` | false | Require configured search provider |
| `NUSAMIND_DESIGN_WORKSPACE_ENABLED` | false | New design workbench |
| `NUSAMIND_MCP_EXECUTION_ENABLED` | false | Require verified sandbox/policy |

Codex may choose alternative naming but should document migration. All features: graceful `NOT_CONFIGURED`, *not* fabricated output.

## 7. NFR & Quality Attributes

- **Security:** deny-by-default, scoped approval, least privilege, user-initiated tool execution, outbound traffic boundaries, prompt injection separation, source provenance.
- **Reliability:** transactional edits, cancellation, bounded retry, durable checkpoint, audit logs, idempotence on resume.
- **Performance:** on-demand heavy workers; concurrency Zen=2 maximum for active independent workloads; no parallel Ollama big models on 16GB profile by default; record p50/p95 task latency and peak RSS when measurable.
- **Reproducibility:** pinned lockfile + Python constraints; fixture data + seeds; deterministic verification; clear offline mode.
- **A11y:** target WCAG 2.2 AA for new Workbench affordances; keyboard reachable interactions, contrast audit, form labels and focus visible.
- **Privacy:** local data retention configurable; no leaking dataset content to cloud by default; credentials via secret broker only.
- **Transparency:** user can see precisely what was executed, what was assumed, and which results not verified.

## 8. Release criteria

**Release candidate**, not GA, after automated P0 & P1 gates pass and at least one verifiable E2E path per capability. **GA** only when Windows local smoke + regression + security checks pass on target hardware. For unverifiable tests, mark release `RC/BLOCKED`, not `GA`.

Acceptance matrix terpisah ada di `04_ACCEPTANCE_TEST_MATRIX.md`.
