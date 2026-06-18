# Memory & documentation map

Use after code push. Update **minimum** set — avoid rewriting unchanged files.

## Decision tree

```
What changed?
├── Runtime behavior (API, UI, cron, scripts)
│   └── recent-changes.md + component memory + topic doc if operators read it
├── Config-only (render.yaml, vercel.json) — no logic
│   └── platform/deployment.md + recent-changes.md
├── Agent tooling (skills, rules)
│   └── operations/conventions.md + recent-changes.md
├── Tests only
│   └── recent-changes.md (optional operations/testing.md if new pattern)
└── Docs-only session
    └── INDEX.md date only; skip second push if already committed
```

## File purposes

| Path | Update when |
| --- | --- |
| `.specify/memory/changelog/recent-changes.md` | Every push — session delta log |
| `.specify/memory/INDEX.md` | Every push — `Last updated` stamp |
| `.specify/memory/MASTER.md` | Rare — new env var, route mount, or architecture shift only |
| `.specify/memory/architecture/data.md` | DB, backup, Supabase mirror, email analytics |
| `.specify/memory/architecture/system.md` | Request flow, new service, repo layout |
| `.specify/memory/platform/deployment.md` | Render/Vercel, cron, env matrix |
| `.specify/memory/backend/express.md` | Routes, controllers, models, services |
| `.specify/memory/frontend/client.md` | Pages, contexts, major UI flows |
| `.specify/memory/auth/security.md` | JWT, OAuth, permissions, tenant guards |
| `.specify/memory/features/modules.md` | New or materially changed product module |
| `.specify/memory/operations/conventions.md` | Skills, audits, locked zones, script catalog |
| `.specify/memory/operations/testing.md` | Test stack or CI gate changes |
| `docs/DATA_BACKUP.md` | Backup behavior, env vars, runbooks |
| `docs/DEPLOY_ENV.md` | Deploy env guidance |
| `docs/VERSION_HISTORY.md` | Shipped user-facing release (not every fix) |
| `README.md` | New top-level command or setup step |
| `docs/DOCUMENTATION_INDEX.md` | New primary doc added to repo |

## Entry templates

### recent-changes.md block

```markdown
## 2026-06-18 — stream Supabase backup export

- **What:** Supabase collection backup uses gzip streaming instead of in-memory join.
- **Why:** Render Starter OOM during Data Hub / cron backups.
- **Files:** `server/services/supabase/backupStore.js`
- **Branch:** `main` · **Commit:** `a1b2c3d`
```

### VERSION_HISTORY.md (releases only)

```markdown
### [2026-06-18] — Backup memory fix

- **Backup:** Supabase export streams gzip; lowers peak RAM on Render cron and Data Hub runs.
```

## Anti-patterns

- Duplicating `MASTER.md` content into component files
- Editing `docs/AI_AGENT_PROJECT_CONTEXT.md` (legacy — prefer `.specify/memory/`)
- Stale host URLs (`CoreKnot-jfw0.onrender.com`) in any doc
- Committing `.cursor/production-hosts.local.json`
