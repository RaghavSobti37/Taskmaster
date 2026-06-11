# NestJS Migration (Strangler Fig)

> **Status:** In progress (Jun 2026). Production still runs Express on port 5000.  
> **Playbook:** `docs/BACKEND_MIGRATION_PLAYBOOK.md`

---

## Goal

Migrate from Express + MongoDB to **NestJS + Prisma + Supabase PostgreSQL** using the Strangler Fig pattern — no big-bang rewrite.

| Layer | Current | Target |
| --- | --- | --- |
| Framework | Express (`server/`) | NestJS (`nestjs-server/`, port 5001) |
| Database | MongoDB Atlas + Supabase mirror | Supabase PostgreSQL (primary) |
| ORM | Mongoose | Prisma |
| Queues | BullMQ + `server/workers/*.js` | `@nestjs/bullmq` `@Processor()` |
| Validation | `server/validation/` Zod | `@coreknot/contracts` |

---

## Monorepo layout

```
server/                 # Legacy Express — production today (port 5000)
  ├── app/              # createApp, registerRoutes, startServer
  ├── domains/          # Extracted domain modules
  └── workers/          # BullMQ workers (until ported)

nestjs-server/          # New NestJS (port 5001)
  ├── prisma/schema.prisma
  └── src/domains/      # attendance, mail/tracking, tasks (ported so far)

shared/contracts/       # @coreknot/contracts — Zod schemas shared by both
```

---

## Migration phases (0–6)

| Phase | Summary |
| --- | --- |
| **0** | Scaffold `nestjs-server/`, wire `@coreknot/contracts` |
| **1** | Mongoose → `prisma/schema.prisma` (PostgreSQL) |
| **2** | ConfigModule, PrismaModule, AuthGuard, BullMQModule |
| **3** | ETL: Mongo → Postgres sync (cursor batches, FK order) |
| **4** | Route-by-route replacement via Vercel proxy flips |
| **5** | Email tracking pixels + Resend webhooks (LOCKED logic) |
| **6** | Shadow JSON compare, E2E, final cutover, decommission Express |

---

## Domain migration order

| Order | Domains | Rationale |
| --- | --- | --- |
| **1** | Attendance, Gamification | Small boundaries; tracer bullet |
| **2** | Projects, Tasks, Schedule | Core workflows |
| **3** | Mail | Heavy webhooks + BullMQ |
| **4** | CRM, Data Hub | Person spine, large services |
| **5** | Auth (last) | Login/OAuth — port after all routes moved |

---

## Auth bridge (transition)

| Rule | Detail |
| --- | --- |
| Shared secret | NestJS `JWT_SECRET` must match Express |
| Cookie | Both read `coreknot_token_v3` HttpOnly cookie |
| NestJS auth | **Read-only** during transition — no session slide |
| Auth mutations | Express handles login/logout/OAuth until final cutover |

---

## Prisma ID strategy

Preserve Mongo ObjectId hex strings (24-char) as `String @id` — do not generate new UUIDs. Breaks bookmarks and frontend state otherwise.

---

## Vercel proxy pattern

Domain-specific rewrites **above** catch-all:

```json
{
  "rewrites": [
    { "source": "/api/attendance/:match*", "destination": "https://YOUR-NESTJS-API.onrender.com/api/attendance/:match*" },
    { "source": "/api/:match*", "destination": "https://YOUR-PRODUCTION-API.onrender.com/api/:match*" }
  ]
}
```

Local dev: uncomment `/api/attendance` → `localhost:5001` in `client/vite.config.js`.

---

## Locked during migration

- **Email engine** — port verbatim per `docs/EMAIL_ENGINE_LOCKED.md`
- **Production hosts** — `.cursor/production-hosts.local.json`
- **Logo / spinner** — frontend unchanged

Full detail: [MASTER.md](../MASTER.md) §30
