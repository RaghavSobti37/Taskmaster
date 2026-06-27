# CoreKnot Memory Index

> **Start here.** This folder is the self-contained project memory — read only these docs to understand what CoreKnot is, how it works, and how to change it safely.
>
> **Product:** CoreKnot — enterprise CRM & operations hub for The Shakti Collective (TSC)  
> **Repo:** `Taskmaster` · **Version:** `1.0.7` · **Last updated:** 2026-06-27

---

## Quick start by role

| You are… | Read in order |
| --- | --- |
| **New developer** | [platform/overview](platform/overview.md) → [architecture/system](architecture/system.md) → [MASTER](MASTER.md) §15 for your feature |
| **AI coding agent** | [operations/conventions](operations/conventions.md) first (locked zones) → [MASTER](MASTER.md) full file |
| **Ops / deploy** | [platform/deployment](platform/deployment.md) → [MASTER](MASTER.md) §7–8 → `docs/DEPLOY_ENV.md` |
| **Security review** | [auth/security](auth/security.md) → [operations/conventions](operations/conventions.md) |

---

## Memory map (by component)

### Platform — what & where

| Doc | Contents |
| --- | --- |
| [platform/overview.md](platform/overview.md) | Product scope, business domains, tech stack, brand |
| [platform/deployment.md](platform/deployment.md) | Render + Vercel topology, hosts, env vars, CI/CD |

### Architecture — how it fits together

| Doc | Contents |
| --- | --- |
| [architecture/system.md](architecture/system.md) | System diagram, request lifecycle, repo layout |
| [architecture/data.md](architecture/data.md) | MongoDB primary, Supabase mirror, backups, email analytics |

### Application layers

| Doc | Contents |
| --- | --- |
| [frontend/client.md](frontend/client.md) | React SPA structure, routes, contexts, UI conventions |
| [backend/express.md](backend/express.md) | Express API, domains, routes, models, services |
| [backend/nestjs-migration.md](backend/nestjs-migration.md) | NestJS + Prisma strangler migration (in progress) |

### Cross-cutting

| Doc | Contents |
| --- | --- |
| [auth/security.md](auth/security.md) | JWT sessions, OAuth, permissions, multi-tenancy |
| [features/modules.md](features/modules.md) | All feature modules — CRM, mail, finance, attendance, etc. |
| [operations/conventions.md](operations/conventions.md) | Locked zones, audits, script safety |
| [operations/testing.md](operations/testing.md) | Jest, Vitest, Playwright, QA runner |

### Changelog

| Doc | Contents |
| --- | --- |
| [changelog/recent-changes.md](changelog/recent-changes.md) | Latest session deltas (updated each push-and-document) |

---

## Master reference

| Doc | Contents |
| --- | --- |
| [**MASTER.md**](MASTER.md) | **Complete project context** — everything in one file (~1600 lines). Use when you need full API surface, all env vars, every route mount, or migration playbook detail. |

---

## External docs (long specs — not duplicated here)

| Topic | Path |
| --- | --- |
| Email engine (LOCKED) | `docs/EMAIL_ENGINE_LOCKED.md` |
| Logo / spinner (LOCKED) | `docs/LOGO_LOCKED.md` |
| Production hosts (local truth) | `.cursor/production-hosts.local.json` |
| Local dev setup | `docs/STARTUP_GUIDE.md` |
| Environment matrix | `docs/ENVIRONMENT_MATRIX.md` |
| Backend migration playbook | `docs/BACKEND_MIGRATION_PLAYBOOK.md` |
| Full docs index | `docs/DOCUMENTATION_INDEX.md` |
| Version history | `docs/VERSION_HISTORY.md` |

---

## Folder structure

```
.specify/memory/
├── INDEX.md                 ← you are here
├── MASTER.md                ← complete reference
├── platform/
│   ├── overview.md
│   └── deployment.md
├── architecture/
│   ├── system.md
│   └── data.md
├── frontend/
│   └── client.md
├── backend/
│   ├── express.md
│   └── nestjs-migration.md
├── auth/
│   └── security.md
├── features/
│   └── modules.md
├── operations/
│   ├── conventions.md
│   └── testing.md
└── changelog/
    └── recent-changes.md
```
