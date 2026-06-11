---
name: coreknot-session-boot
description: >-
  Bootstraps CoreKnot (Taskmaster) agent sessions by reading authoritative
  project context, locked zones, and memory before any code change. Use at
  session start, before audits, refactors, or when agent is new to the repo.
---

# CoreKnot Session Boot

Run at start of non-trivial Taskmaster work.

## Read order (stop when task is narrowly scoped)

1. `.cursor/production-hosts.local.json` — if hosts/env involved (never guess URLs)
2. `docs/AI_AGENT_PROJECT_CONTEXT.md` — skim TOC; deep-read relevant §
3. Locked zones if touching:
   - `docs/EMAIL_ENGINE_LOCKED.md` + `.cursor/rules/email-engine-locked.mdc`
   - `docs/LOGO_LOCKED.md` + `.cursor/rules/logo-mark-locked.mdc`
4. `.specify/memory/recent-changes.md` — if exists
5. Task-specific doc from `docs/DOCUMENTATION_INDEX.md`

## Quick anchors

| Topic | Doc |
|-------|-----|
| RBAC | `AI_AGENT_PROJECT_CONTEXT.md` §8 |
| Tenancy | §9 + `docs/TENANT_SECURITY_PHASE.md` |
| UI components | `docs/COMPONENT_STANDARDS.md` |
| Deploy/env | `docs/DEPLOY_ENV.md` |

## Before commit

```bash
npm run audit:exposure
npm run audit:deadcode
```

## Do not

- Use `CoreKnot-jfw0.onrender.com` (deprecated host)
- Edit locked email/logo without explicit unlock
- Commit `production-hosts.local.json`
