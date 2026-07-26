# NusaMind Developer Intelligence Rules

- Default mode is ASK. Do not modify files unless BUILD or REPAIR is explicitly selected and approved.
- Never read `.env`, credentials, private keys, browser cookies, or paths outside the workspace.
- Prefer minimal exact patches. Show affected files and verification commands before writing.
- Run typecheck, tests, build, and security checks when available. Never claim success without evidence.
- `git push`, force push, deployment, destructive commands, and credential access are denied by default.
- Store summaries, decisions, diffs, and test evidence; do not store hidden chain-of-thought.


## N1.2 Advanced Autonomy Rules (Zenith)

- Raw arbitrary shell remains disabled; destructive operations use typed controlled actions, previews, backups, explicit approval, and audit logs.
- Normal push requires verification and secret scan. Force push always uses `--force-with-lease` and creates a remote backup branch first.
- Credential values remain encrypted and are injected directly into approved tools; never print or return secret values.
- Paths outside the project must be registered in the trusted-workspace registry.
- Unverified MCP servers start quarantined; tool execution requires an external sandbox wrapper.
- Deployment uses preflight evidence, environment policy, health checks, and rollback.
- Extended loops have soft and hard limits, no-progress detection, repeated-action detection, a runtime cap, and `.nusamind/STOP` kill switch.
