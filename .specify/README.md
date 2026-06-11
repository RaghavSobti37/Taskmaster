# Specify — project memory for AI agents

Structured memory Cursor agents read during `/push-and-document` and other long-running tasks.

## Start here

**[`.specify/memory/INDEX.md`](memory/INDEX.md)** — navigation hub for all component docs.

| Need | Read |
| --- | --- |
| Quick overview | [`memory/platform/overview.md`](memory/platform/overview.md) |
| Full reference | [`memory/MASTER.md`](memory/MASTER.md) (~1600 lines) |
| Latest changes | [`memory/changelog/recent-changes.md`](memory/changelog/recent-changes.md) |
| Locked zones | [`memory/operations/conventions.md`](memory/operations/conventions.md) |

## Memory layout

```
.specify/memory/
├── INDEX.md                 ← navigation hub
├── MASTER.md                ← complete reference (everything in one file)
├── platform/                ← product scope, deployment
├── architecture/            ← system diagram, data flows
├── frontend/                ← React SPA
├── backend/                 ← Express + NestJS migration
├── auth/                    ← sessions, permissions, tenancy
├── features/                ← CRM, mail, finance, attendance, etc.
├── operations/              ← conventions, testing, audits
└── changelog/               ← session deltas
```

## Maintenance

- Updated by **push-and-document** after each successful push
- `changelog/recent-changes.md` gets session delta each run
- Keep entries factual; link to `docs/` for long specs (email engine, logo, production hosts)
- Never store secrets, Mongo URIs, or live API keys — use gitignored `.cursor/production-hosts.local.json`

## First-time setup (once per machine / clone)

```powershell
cd "C:\Users\ragha\OneDrive\Desktop\TSC Platform\Taskmaster"
npm run audit:exposure
npm run audit:deadcode
```

After clone, read `memory/INDEX.md` — no bootstrap copy step needed.

## External docs (not duplicated in memory)

| Topic | Path |
| --- | --- |
| Email engine (LOCKED) | `docs/EMAIL_ENGINE_LOCKED.md` |
| Logo / spinner (LOCKED) | `docs/LOGO_LOCKED.md` |
| Local dev setup | `docs/STARTUP_GUIDE.md` |
| Full docs index | `docs/DOCUMENTATION_INDEX.md` |
