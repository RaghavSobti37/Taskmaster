---
name: coreknot-session-boot
description: >-
  Bootstraps CoreKnot (Taskmaster) agent sessions — read .specify/memory first,
  then locked zones and task docs before any code change. Use at every session
  start and before audits, refactors, or when agent is new to the repo.
---

# CoreKnot Session Boot

**Run at start of every Taskmaster session** (including small fixes).

## Phase 0 — Agent memory (mandatory)

Read with Read tool — do not skip:

1. `.specify/memory/INDEX.md`
2. `.specify/memory/changelog/recent-changes.md` — newest 3 blocks minimum
3. `.specify/memory/changelog/session-patterns.md`
4. `.specify/memory/MEMORY_PROTOCOL.md` — if first time or memory workflow unclear

Optional:

```bash
npm run memory:report
```

## Phase 1 — Conventions + task context

5. `.specify/memory/operations/conventions.md` — locked zones, audits
6. `.cursor/production-hosts.local.json` — if hosts/env involved (never guess URLs)
7. Component memory from [git-push/memory-map.md](../git-push/memory-map.md) for your slice
8. Task doc from `docs/DOCUMENTATION_INDEX.md` or `docs/reference/COREKNOT_MASTER.md`

## Phase 2 — Locked zones (if touching)

| Zone | Doc + rule |
|------|------------|
| Email engine | `docs/reference/EMAIL_ENGINE_LOCKED.md` + `email-engine-locked.mdc` |
| Logo / spinner | `docs/LOGO_LOCKED.md` + `logo-mark-locked.mdc` |
| Production hosts | `.cursor/production-hosts.local.json` + `production-hosts-locked.mdc` |

## Phase 3 — UI (if `client/`)

- `docs/design/DESIGN-REFERENCE.md`
- `docs/reference/COMPONENT_STANDARDS.md`

## Session end

After verify + commit → `.cursor/skills/memory-sync/SKILL.md` or `/git-push`

## Before commit

```bash
npm run audit:exposure
npm run audit:deadcode
```

## Do not

- Skip memory read for "quick" tasks
- Use deprecated `CoreKnot-jfw0.onrender.com`
- Edit locked email/logo without explicit unlock
- Commit `production-hosts.local.json`
- Write memory before verify passes
