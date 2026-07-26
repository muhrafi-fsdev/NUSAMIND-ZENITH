# ADR 0001 — R13.49 Runtime Boundary

## Decision
Keep the existing main web/CLI UI unchanged. Add backend packages and V9 API adapters for skills, engineering, model routing, browser policy, and execution governance.

## Safety
Swift is read-only for engineering changes. Zenith and Apex require explicit approval for writes and browser commit actions. Apex parallel analysis is read-only and overlap-checked.

## Out of scope
n8n integration, unrestricted shell/browser control, payment automation, and main UI redesign.
