# NusaMind Zenith N1.2 — Advanced Autonomy & Deployment

N1.2 enables the previously blocked engineering actions through controlled execution rather than unrestricted access.

## Capabilities

- Automatic Git push after verification and secret scanning.
- Force push via `--force-with-lease`, with a remote backup branch.
- Controlled destructive actions with preview and backup.
- AES-256-GCM credential vault using `NUSAMIND_VAULT_KEY`.
- Trusted external workspace registry and exact-patch editing.
- Quarantined MCP inspection; unverified execution requires a sandbox wrapper.
- Preview/staging/production deployment adapters with health checks and rollback.
- Extended agent loop with hard emergency ceiling and kill switch.

## Edition limits

```json
{
  "boost": 1450,
  "maxSteps": 40,
  "softSteps": 20,
  "maxRuntime": 90,
  "parallel": 2,
  "executePush": true,
  "forcePush": true,
  "destructive": true,
  "credentialWrite": true,
  "externalWrite": true,
  "mcpCall": true,
  "deploy": [
    "preview",
    "staging"
  ],
  "autoDeploy": false
}
```

## Security invariants

Raw shell strings are not executed. Credentials are never returned by the API. Production deployment is Apex-only. UI files are unchanged.
