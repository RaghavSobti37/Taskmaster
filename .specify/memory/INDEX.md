# CoreKnot Memory Index

> **Start here.** Self-contained project memory for agents and developers.  
> **Product:** CoreKnot · **Repo:** `coreknot/Taskmaster` · **Version:** `1.0.7` · **Last updated:** 2026-07-06

**Every agent chat:** read this file → [recent-changes](changelog/recent-changes.md) → [session-patterns](changelog/session-patterns.md) → [MEMORY_PROTOCOL](MEMORY_PROTOCOL.md)

---

## Quick start by role

| You are… | Read in order |
| --- | --- |
| **New developer** | [platform/overview](platform/overview.md) → [architecture/system](architecture/system.md) → [docs/reference/COREKNOT_MASTER.md](../../docs/reference/COREKNOT_MASTER.md) |
| **AI coding agent** | [MEMORY_PROTOCOL](MEMORY_PROTOCOL.md) → [session-patterns](changelog/session-patterns.md) → [operations/conventions](operations/conventions.md) → [COREKNOT_MASTER](../../docs/reference/COREKNOT_MASTER.md) → [MASTER](MASTER.md) |
| **Ops / deploy** | [platform/deployment](platform/deployment.md) → [docs/operations/deployment.md](../../docs/operations/deployment.md) |
| **Security review** | [auth/security](auth/security.md) → [docs/architecture/SECURITY.md](../../docs/architecture/SECURITY.md) |

---

## Page-level truth (new)

**Every routed page** — routes, hooks, API paths, exports, permissions:

| Doc | Contents |
| --- | --- |
| [**docs/reference/COREKNOT_MASTER.md**](../../docs/reference/COREKNOT_MASTER.md) | **2,000+ lines** — auto-generated page catalog + routing rules |
| Regenerate | `node scripts/generate-page-inventory.mjs && node scripts/generate-master-doc.mjs` |

---

## Memory map (by component)

### Platform

| Doc | Contents |
| --- | --- |
| [platform/overview.md](platform/overview.md) | Product scope, stack, brand |
| [platform/deployment.md](platform/deployment.md) | Render + Vercel topology |

### Architecture

| Doc | Contents |
| --- | --- |
| [architecture/system.md](architecture/system.md) | System diagram, request lifecycle |
| [architecture/data.md](architecture/data.md) | Mongo, Supabase, backups |

### Application layers

| Doc | Contents |
| --- | --- |
| [frontend/client.md](frontend/client.md) | React SPA, site modes, UI conventions |
| [backend/express.md](backend/express.md) | Express domains, routes, services |
| [backend/nestjs-migration.md](backend/nestjs-migration.md) | NestJS strangler |

### Cross-cutting

| Doc | Contents |
| --- | --- |
| [auth/security.md](auth/security.md) | JWT, OAuth, permissions |
| [features/modules.md](features/modules.md) | Feature modules |
| [operations/conventions.md](operations/conventions.md) | Locked zones, audits |
| [operations/testing.md](operations/testing.md) | Jest, Vitest, Playwright |

### Changelog

| Doc | Contents |
| --- | --- |
| [changelog/recent-changes.md](changelog/recent-changes.md) | Session deltas (code shipped) |
| [changelog/session-patterns.md](changelog/session-patterns.md) | Durable prefs + patterns from chats |
| [MEMORY_PROTOCOL.md](MEMORY_PROTOCOL.md) | Read/write loop for agents |

### Master reference (API / env depth)

| Doc | Contents |
| --- | --- |
| [MASTER.md](MASTER.md) | Full API surface, env vars, migration playbook (~1,600 lines) |

---

## External docs (organized 2026-07-02)

| Topic | Path |
| --- | --- |
| **Doc navigation** | `docs/DOCUMENTATION_INDEX.md` |
| **Page catalog** | `docs/reference/COREKNOT_MASTER.md` |
| Email engine (LOCKED) | `docs/reference/EMAIL_ENGINE_LOCKED.md` |
| Logo (LOCKED) | `docs/reference/LOGO_LOCKED.md` |
| UI design | `docs/design/DESIGN-REFERENCE.md` |
| Local dev | `docs/operations/local-development.md` |
| Environments | `docs/operations/environments.md` |
| Artist OS | `docs/features/artist-os.md` |
| Google/Meta OAuth | `docs/auth/google-oauth.md` |
| Version history | `docs/reference/VERSION_HISTORY.md` |

---

## Folder structure

```
.specify/memory/
├── INDEX.md                 ← you are here
├── MEMORY_PROTOCOL.md       ← agent read/write loop
├── MASTER.md                ← API/env deep reference
├── platform/
├── architecture/
├── frontend/
├── backend/
├── auth/
├── features/
├── operations/
└── changelog/
    ├── recent-changes.md
    └── session-patterns.md
```
