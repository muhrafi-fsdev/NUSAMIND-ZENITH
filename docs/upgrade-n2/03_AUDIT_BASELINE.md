# Evidence-led Baseline Audit | main @ d109046

> Peninjauan ini **statis lewat GitHub** pada 20-10-2026. Saya tidak menjalankan `npm install`, build, Ollama, browser, atau endpoint pada komputer pengguna. Setiap temuan perlu direproduksi/diklasifikasi oleh Codex. Severity didasarkan pada dampak potensi, bukan konfirmasi eksploitasi.

## Inventory teramati

- GitHub: `muhrafi-fsdev/NUSAMIND-ZENITH`, default `main`, baseline commit `d10904602ced92443ae055cb87f258a9c01e820c`.
- N1.4.1; Next.js `16.2.10`, React `19.2.7`, AI SDK `7.0.22`, Qwen local via Ollama; `package.json` Node >=22.
- Existing functional domains include main chat (`app/api/chat/route.ts`), local ML FastAPI (`ml-service/`), coding (`lib/coding-agent.ts`), developer intelligence, autonomy engine, RAG, evaluation, and many knowledge packs.
- Browser source found: `packages/browser-operator/index.ts` and `app/api/v9/browser/route.ts`; research: `lib/research/registry.ts`.
- Repository tree sampled contained **no `package-lock.json`, `.github/workflows`, Playwright tests/config, ESLint config, or unit test runner config** at this commit. This is a tree observation, not proof those files never existed.

## Findings

| ID | Risk | Evidence in repository | Finding & requirement |
| --- | --- | --- | --- |
| F01 | **P0 / HIGH** | [`app/api/n1/autonomy/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/n1/autonomy/route.ts) | `authorized()` allows Host prefix `localhost`/`127.0.0.1` when token absent. Host header alone is not an authentication factor. Fail closed + secure binding/session/CSRF. Validate behavior behind reverse proxy. |
| F02 | **P0 / HIGH** | [`app/api/n1/developer/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/n1/developer/route.ts), [`app/api/coding/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/coding/route.ts) | Similar Host fallback; coding protects only list of named actions. Audit `plan` and `job` endpoint data disclosure, plus all mutating endpoints. |
| F03 | **P0 / HIGH** | [`packages/autonomy-engine/mcp.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/autonomy-engine/mcp.ts) | `inspectMcp()` invokes `rpc(s.command,s.cwd,...)` directly for quarantined MCP. Inspection itself **executes external child process** before sandbox wrapper; quarantine must hold at process creation. |
| F04 | **P0 / HIGH** | [`lib/tool-registry.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/tool-registry.ts) | `executeTypedTool()` validates schema but does not appear to enforce risk/permission on dispatch; confirm all callers and protect execution boundary. |
| F05 | **P0 / HIGH** | [`packages/browser-operator/index.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/browser-operator/index.ts) | `validateUrl()` checks hostname against simple patterns. If reused to allow network fetch, DNS/private IPv6/redirect rebinding is not fully covered. Network-level egress + revalidation required before activating actual browser. |
| F06 | **P0 / MEDIUM** | [`packages/n1-runtime/index.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/n1-runtime/index.ts) | `n1ContractEvaluation()` maps every benchmark case to `PASS` regardless of actual execution. Replace with evidence-based test results; do not mislabel static contract checks as real E2E. |
| F07 | **P0 / MEDIUM** | [`package.json`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/package.json), [`scripts/validate-clean-install.mjs`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/scripts/validate-clean-install.mjs) | Lockfile absent although README asks `npm ci`; clean-install preflight checks its existence. Regenerate/commit valid lock after dependency verification. |
| F08 | **P0 / MEDIUM** | [`package.json`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/package.json) | Script `lint` invokes `next lint`; Next.js 16 removed command. Migrate to ESLint/Biome CLI and include in release gate. |
| F09 | **P1 / MEDIUM** | [`app/api/n1/orchestrate/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/n1/orchestrate/route.ts), [`packages/n1-runtime/index.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/n1-runtime/index.ts) | Endpoint `/orchestrate` only returns route decision; does not run plan/tool. Do not present as functional full agent executor. |
| F10 | **P1 / MEDIUM** | [`app/api/v9/browser/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/v9/browser/route.ts) | Returns browser-actions manifest, URL validity and injection pattern results; no Playwright operations/DOM/screenshot executor in reviewed module. |
| F11 | **P1 / MEDIUM** | [`lib/agent-runtime/workflow-engine.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/agent-runtime/workflow-engine.ts) | Expected-state validation only string prefix check on `actualState`, should move to deterministic per-tool verifiers. |
| F12 | **P1 / MEDIUM** | [`lib/tool-runtime/contracts.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/tool-runtime/contracts.ts) | `Promise.race` timeout does not cancel underlying operation; add abort/cancellation and child cleanup. |
| F13 | **P1 / MEDIUM** | [`app/api/n1/autonomy/route.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/app/api/n1/autonomy/route.ts) | `loop-run` demo falls through to `ok:true` for unrecognized step actions; can't substitute as verified execution. |
| F14 | **P1 / MEDIUM** | [`lib/research/registry.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/research/registry.ts) | A research topic registry/activation policy, not yet a sourced live multi-hop research executor. Existing RAG should be reused. |
| F15 | **P1 / LOW** | [`packages/autonomy-engine/policy.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/autonomy-engine/policy.ts), [`packages/developer-intelligence/index.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/packages/developer-intelligence/index.ts), [`lib/coding-agent.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/coding-agent.ts) | Defaults `swift`, `zenith`, `apex` differ when `NUSAMIND_EDITION` absent. `.env.example` says zenith, so normal use may be fine; centralize edition validation/default to avoid unexpected inconsistent behavior. |
| F16 | **P2 / MEDIUM** | [`lib/search.ts`](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/lib/search.ts) | `hybridSearch()` ranks based on supplied vector scores rather than actual embedding calculation here; inspect retrieval-v6 before claiming hybrid search quality, and benchmark ranking. |

## Existing components to preserve, not discard

- `packages/autonomy-engine/{git,destructive,workspace,vault,deployment,audit}.ts` and its edition-based approval policy.
- `packages/developer-intelligence/index.ts` and modes `ASK/PLAN/BUILD/REVIEW/REPAIR`.
- `lib/model.ts`, `lib/model-adapters/*`, `lib/retrieval-v6.ts`, `lib/agentic-rag.ts`, `lib/memory.ts`, `lib/file-analyzer.ts`, `lib/ml-client.ts`.
- `components/ChatShell.tsx`, existing API contracts and all domain content unrelated to N2 tasks.
- `AGENTS.md` restrictions and no autonomous production deploy rule.

## Audit follow-ups that require runtime evidence

- Can `npm ci` succeed after package lock repair with Node 22 on Windows? Are TS native aliases available/compatible?
- Can a local user connect to actual Ollama models and handle tool calls using chosen provider? Check capabilities empirically, not model registry flags.
- Does browser worker have actual Chromium binaries installed? Test `playwright install chromium` only with permission and resource awareness.
- Can the MCP sandbox truly isolate process network/fs on Windows? Without container/OS sandbox, do not label unverified server safe.
- Are any old API routes unauthenticated and able to affect private local resources? Inventory all `/api/**` paths.
- Can `runExtendedLoop` preserve process state safely after crash? Are write steps idempotent?

## Baseline source links

- [README N1.4.1](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/README.md)
- [AGENTS.md](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/AGENTS.md)
- [N1.2 autonomy docs](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/docs/autonomy-n1.2.md)
- [N1.4.1 TS manifest](https://github.com/muhrafi-fsdev/NUSAMIND-ZENITH/blob/main/data/release/n1.4.1/manifest.json)
