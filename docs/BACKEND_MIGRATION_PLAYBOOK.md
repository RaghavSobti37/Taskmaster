# Backend Migration Playbook — NestJS + Prisma + Supabase

> **Pattern:** Strangler Fig — build the new modular monolith alongside legacy Express until Express can be decommissioned.  
> **Context:** `.specify/memory/MASTER.md` §30  
> **Secrets:** Never commit live URLs or DB credentials. Use `.cursor/production-hosts.local.json` (gitignored) and `YOUR-*` placeholders in committed docs.

---

## Overview

| Layer | Legacy | Target |
| --- | --- | --- |
| Framework | Express (`server/`) | NestJS (`nestjs-server/`) |
| Database | MongoDB Atlas | Supabase PostgreSQL |
| ORM | Mongoose | Prisma |
| Queues | BullMQ + `server/workers/` | `@nestjs/bullmq` `@Processor()` |
| Real-time | Socket.IO on Express | NestJS WebSockets Gateways |
| Hosting | Render (Express + Redis) | Render (NestJS + same Redis) |
| Validation | `server/validation/` | `@coreknot/contracts` (`shared/contracts/`) |

**End state:** Supabase Postgres is the sole primary database. MongoDB Atlas and the Express Render service are shut down.

---

## Phase 0: Monorepo Sandbox

**Goal:** Safe coexistence — old and new backends run side by side without breaking production.

### 0.1 NestJS workspace

```
Taskmaster/
├── server/              # Legacy Express — port 5000 (production today)
├── nestjs-server/       # New NestJS — port 5001
└── shared/contracts/    # @coreknot/contracts
```

- [ ] `nestjs-server/` exists with `main.ts`, `app.module.ts`, `nest-cli.json`, `tsconfig.json`
- [ ] `package.json` name: `@coreknot/nestjs-server`
- [ ] Root `package.json` workspaces include `nestjs-server` and `shared/contracts`
- [ ] `GET /api/health` returns 200 on port 5001

### 0.2 Shared contracts

- [ ] Zod schemas from `server/validation/` migrate incrementally into `shared/contracts/`
- [ ] Both `server` and `nestjs-server` import `@coreknot/contracts` for identical payload validation
- [ ] Expand `shared/contracts/index.js` exports as domains port (crm, mail, attendance, …)

### 0.3 Local proxy (Vite)

In `client/vite.config.js`:

- Default: `/api` → `http://localhost:5000` (Express)
- Strangler template (commented until cutover):

```js
// '/api/attendance': {
//   target: 'http://localhost:5001',
//   changeOrigin: true,
//   cookieDomainRewrite: '',
// },
```

Keep domain-specific rules **above** the catch-all `/api` rule.

### 0.4 Env template

`nestjs-server/.env.example` (no secrets committed):

| Variable | Purpose |
| --- | --- |
| `PORT` | Default `5001` |
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Must match Express for shared sessions |
| `REDIS_URL` | Render Key Value for BullMQ |

### 0.5 Verify

```bash
npm install
cd nestjs-server && npm run build
curl http://localhost:5001/api/health
```

---

## Phase 1: Database Design & Prisma Schema

**Goal:** Translate 70+ Mongoose models into a relational PostgreSQL schema.

### 1.1 Survey models

Inventory all collections:

- `server/models/*.js`
- `server/domains/*/models/*.js`

Document collection names, nested arrays, cross-references, and tenant scope.

### 1.2 Prisma schema (`nestjs-server/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**Critical rules:**

| Rule | Implementation |
| --- | --- |
| **Preserve Mongo IDs** | `id String @id` — insert legacy `_id` hex strings; never auto-generate UUIDs |
| **Multi-tenancy** | `tenantId String` on every tenant-scoped table |
| **Person spine** | `Person` central table; FK children: `PersonIdentifier`, `PersonSourceLink`, `Lead`, … |
| **Cascade deletes** | `ON DELETE CASCADE` on Person children where legacy behavior expects purge |
| **Flatten arrays** | `TaskActivity`, `ProjectGoal`, `MailEvent`, `Notification` → own tables with FKs |
| **JSON blobs** | `CRMConfig`, `DashboardPreset`, dynamic UI prefs → `Json` fields — do not over-normalize |

### 1.3 Prisma tenant extension

Replace `server/repositories/tenantQuery.js` + `createTenantRepository.js`:

- Prisma Client Extension auto-injects `where: { tenantId }` on all scoped queries
- `bypassTenant` escape hatch for public tracking routes (mail events, calendar musical days)

### 1.4 Tier 1–3 tables (schema first)

Start schema with:

- **Tier 1:** Tenant, User, Department, PlatformSettings
- **Tier 2:** Project, Person, Team, Workspace, Phase
- **Tier 3:** Task, TaskAssignment, Lead, Attendance, GamificationConfig, DailyMission

Defer Tier 4 (high-volume events) until Tier 1–3 validate on staging.

### 1.5 Verify

```bash
cd nestjs-server
npx prisma validate
npx prisma migrate dev --name init   # staging only
```

---

## Phase 2: Core Infrastructure Replication

**Goal:** NestJS foundation matches Express `server/app/` behavior.

### 2.1 ConfigModule

- `@nestjs/config` + Zod validation on boot
- Port env shape from `server/config/index.js`
- Fail fast on missing `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`

### 2.2 PrismaModule

- `PrismaService` global provider
- Tenant extension wired from request context

### 2.3 AuthGuard

Port `server/middleware/authMiddleware.js`:

| Behavior | Detail |
| --- | --- |
| Cookie | Read `coreknot_token_v3` HttpOnly cookie |
| JWT | Verify with shared `JWT_SECRET` |
| Session | **Read-only** during transition — validate 7-day inactivity / 30-day absolute max; do **not** slide cookie |
| Context | Attach `user`, `tenantId`, `jti` to request |
| Dev bypass | `DEBUG_BYPASS` + `bypass_token` (local only) |

### 2.4 GlobalExceptionFilter

Match Express `errorMiddleware.js` JSON shape:

```json
{
  "success": false,
  "error": "message",
  "traceId": "…",
  "path": "/api/…",
  "timestamp": "…"
}
```

### 2.5 BullMQModule

- `@nestjs/bullmq` → existing Render Redis (`noeviction` policy)
- Queues: `webhook`, `import`, `tracking`, `supabase-sync` (mirror `server/jobs/registry.js`)
- Graceful shutdown on `SIGTERM` (Render platform requirement)

### 2.6 Trace / logging

- Correlation ID middleware (parity with `traceMiddleware.js`)
- Structured logging — no raw `console.log` in new code

### 2.7 Verify

- Unauthenticated request to protected route → `401`
- Authenticated request with Express-issued cookie → `200`
- Error responses match legacy JSON shape

---

## Phase 3: ETL Data Bridge

**Goal:** Reliable one-way sync MongoDB → PostgreSQL.

### 3.1 Sync script

Create `nestjs-server/scripts/etl/mongo-to-postgres.ts` (or `server/scripts/` during transition):

- Connect Mongoose (read) + Prisma (write)
- **Never** load full collections into memory
- Mongoose `.find().cursor()` → batches of 500 → `prisma.*.createMany()`

### 3.2 Insert order (FK constraints)

| Tier | Entities |
| --- | --- |
| **1** | Tenants, Users, Departments, PlatformSettings |
| **2** | Projects, Persons, Teams, Workspaces |
| **3** | Tasks, TaskAssignments, Leads, ExlyBookings, Attendance, Gamification |
| **4** | TaskActivity, MailEvents, Notifications, CRMAudit, XPAuditLog |

### 3.3 Validation checks

After each tier:

```bash
# Compare counts per collection/table
node scripts/etl/compare-counts.js --tier 3
```

Spot-check:

- Total XP in gamification matches
- CRM lead counts match
- Person spine `personId` FK integrity

### 3.4 Continuous sync (migration period)

During Phases 4–5, run ETL on cron (e.g. every 1 minute) so NestJS reads cross-domain data (Users, Departments) from Postgres without HTTP calls to Express.

### 3.5 Staging run

- [ ] Full ETL on staging Mongo → staging Supabase
- [ ] Fix schema mapping errors (string length, missing fields, enum mismatches)
- [ ] Document delta report

### 3.6 Data environment topology (Jun 2026)

**Do not duplicate full prod on one Supabase project for local + preview + prod.**

| Target | Store | Command / doc |
| --- | --- | --- |
| Local Express | Mongo `taskmaster_local` (operational) | `npm run sync:prod-to-local:operational` |
| Local Nest | Docker Postgres | `cd nestjs-server && npm run db:setup && npm run etl:local-operational` |
| Preview QA | Supabase **preview** project | `npm run etl:preview-full` with `DATABASE_URL` = preview |
| Production | Supabase **prod** project | After Vercel preview pass — see cutover doc |

- Local CRM/Data Hub purge: `npm run purge:local-crm-datahub`
- Local Data Hub reconcile off: `DATA_HUB_RECONCILE_ENABLED=false`
- Full checklist: `docs/PREVIEW_SUPABASE_CUTOVER.md`, `docs/DATA_ENV_TOPOLOGY.md`
- Readiness script: `node server/scripts/verifyDataEnvReadiness.js`

---

## Phase 4: Route-by-Route Replacement (Strangler)

**Goal:** Migrate traffic one domain at a time at the proxy layer.

### 4.1 Auth & session bridge (prerequisite)

Before routing **any** production traffic to NestJS:

1. NestJS `JWT_SECRET` === Express `JWT_SECRET`
2. AuthGuard reads `coreknot_token_v3` — same cookie name, same claims
3. NestJS auth is **read-only** — login, logout, OAuth, session slide stay on Express until final auth port
4. Single user session may hit both backends simultaneously via Vercel split — shared JWT makes this transparent

### 4.2 Tracer bullet domain

**Start with Attendance or Gamification** — not CRM or Data Hub.

Why: clear boundaries, few cross-domain writes, easy to verify in production.

### 4.3 Port mechanics (Attendance example)

```
nestjs-server/src/domains/attendance/
├── attendance.module.ts
├── attendance.controller.ts    # port attendanceRoutes.js
├── attendance.service.ts       # Prisma replaces Mongoose
└── dto/                        # from @coreknot/contracts or port Zod schemas
```

Steps:

1. Read legacy `server/routes/attendanceRoutes.js`, controller, `server/models/Attendance.js`
2. Port every route to `@Controller('attendance')` with global `/api` prefix
3. Match **exact** response shapes legacy Express returns
4. Use AuthGuard + Prisma tenant extension on all queries
5. Local test against Postgres data from Phase 3 ETL

### 4.4 Dual-write (optional, short window)

If legacy Express still reads attendance data during overlap:

- NestJS write → Postgres **and** Mongo (temporary)
- Remove dual-write once Express route is disabled

Prefer **ETL continuous sync** over dual-write where possible.

### 4.5 Vercel production cutover

1. Deploy NestJS to new Render web service: `YOUR-NESTJS-API` (placeholder)
2. Add domain-specific rewrite **above** catch-all in `client/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/api/attendance/:match*",
      "destination": "https://YOUR-NESTJS-API.onrender.com/api/attendance/:match*"
    },
    {
      "source": "/api/:match*",
      "destination": "https://YOUR-PRODUCTION-API.onrender.com/api/:match*"
    }
  ]
}
```

3. Deploy Vercel frontend — React SPA unchanged; traffic splits transparently
4. Monitor Sentry/Datadog for 48 hours before next domain

**Production host rules:** Read `.cursor/production-hosts.local.json` for real URLs. Never use legacy `CoreKnot-jfw0.onrender.com` in new config.

### 4.6 Domain migration order

| Wave | Domains | Proxy prefixes |
| --- | --- | --- |
| **1** | Attendance, Gamification, Notes, Pinboard | `/api/attendance`, `/api/gamification`, `/api/notes`, `/api/pinboard` |
| **2** | Projects, Tasks, Schedule | `/api/projects`, `/api/tasks`, `/api/schedule` |
| **3** | Mail engine | `/api/mail`, `/api/campaigns`, `/api/track`, `/api/webhooks/resend` |
| **4** | CRM, Data Hub | `/api/crm`, `/api/data-hub`, `/api/artist-path` |
| **5** | Auth (final) | `/api/auth` — then global `/api/*` → NestJS only |

### 4.7 Strangling the root (auth last)

1. Port `authRoutes.js` — login, register, logout, Google OAuth, session management
2. NestJS now owns session slide + cookie mutation
3. Change Vercel: single rewrite `/api/:match*` → `YOUR-NESTJS-API`
4. Shut down Express Render service
5. Shut down MongoDB Atlas cluster

---

## Phase 5: High-Risk Asynchronous Workflows

**Goal:** Zero dropped webhooks or tracking events during mail cutover.

> **LOCKED:** Read `docs/EMAIL_ENGINE_LOCKED.md` before touching tracking logic. Port verbatim from:
> - `server/utils/trackingUrls.js`
> - `server/utils/emailTracker.js`
> - `server/utils/geoLookup.js`
> - `server/routes/track.js`

### 5.1 Pixel tracking (`/open`, `/click`)

NestJS `TrackingController`:

1. Accept hit synchronously
2. Push payload to BullMQ `tracking` queue
3. Return 1×1 GIF (open) or redirect (click) **immediately**
4. `TrackingProcessor` worker: geo lookup + Postgres `MailEvent` update in background

Behavior must match locked spec:

- Gmail proxy IPs blocked for geo on opens
- Click city inferred from same recipient's click
- No hardcoded city fallbacks
- `TRACKING_BASE_URL` from production hosts local JSON

### 5.2 Resend webhooks

`ResendWebhookProcessor` (`@Processor('webhook')`):

- Port idempotency from `server/domains/mail/webhooks/resendWebhookHandler.js`
- Check `MailEvent` exists before insert — duplicate webhook must not crash or duplicate

### 5.3 Other async ports

| Workflow | Legacy | NestJS target |
| --- | --- | --- |
| CSV imports | `importWorker.js` | `@Processor('import')` |
| Campaign dispatch | `emailProcessor.js` | Mail domain queue |
| Supabase sync | `supabaseSyncWorker.js` | Deprecate after Postgres is primary |
| Finance OCR | `financeController` + pdf-parse/tesseract | Finance domain module |

### 5.4 Verify

- Send test campaign → open pixel fires → `MailEvent` in Postgres
- Replay Resend webhook payload twice → single `MailEvent` row
- Large attachment upload still bypasses Vercel 4.5MB limit (direct to Render)

---

## Phase 6: QA & Final Cutover

**Goal:** Prove production parity before decommissioning legacy stack.

### 6.1 Legacy Express gates

```bash
cd server && npm test
node -e "require('./app/registerRoutes')"   # zero MODULE_NOT_FOUND
```

### 6.2 NestJS gates

```bash
cd nestjs-server
npm run build
npx prisma validate
npm test          # when configured
curl http://localhost:5001/api/health
curl http://localhost:5001/api/attendance   # expect 401 without cookie
```

### 6.3 Contracts & client

```bash
npm run typecheck    # root — @coreknot/contracts resolves
npm run dev          # Vite proxy — no broken dev routing
```

### 6.4 Shadow run (pre-cutover)

- Vercel still points to Express for writes
- Script mirrors production `GET` requests to NestJS
- Diff JSON responses — mismatches block next domain migration

### 6.5 Playwright E2E

```bash
npm run test:e2e:public
npm run test:e2e:auth
```

Run against NestJS-proxied routes — must pass without frontend changes.

### 6.6 Final cutover window

1. Announce 2-hour read-only maintenance (e.g. Sunday 02:00 IST)
2. Stop Express API (read-only mode on frontend)
3. Run final delta ETL — catch records created since last sync
4. Update Vercel: all `/api/:match*` → `YOUR-NESTJS-API`
5. Bring system online
6. Monitor Datadog/Sentry aggressively for 72 hours
7. Decommission Express Render service + MongoDB Atlas

### 6.7 Post-cutover cleanup

- [ ] Remove `server/` Express code paths (or archive branch)
- [ ] Remove Mongoose models and `MONGODB_URI` from env
- [ ] Remove Supabase **secondary mirror** hooks (`registerMirrors.js`) — Postgres is primary
- [ ] Update `MASTER.md` §5/§6/§12 to reflect single-backend state
- [ ] Update `render.yaml` — single NestJS web service

---

## Quick Reference

### Files to read before each phase

| Phase | Key legacy files |
| --- | --- |
| 0 | `package.json`, `client/vite.config.js`, `nestjs-server/README.md` |
| 1 | `server/models/`, `server/domains/*/models/`, `docs/DATA_MASTER_ARCHITECTURE.md` |
| 2 | `server/middleware/authMiddleware.js`, `server/config/index.js`, `server/repositories/tenantQuery.js` |
| 3 | `server/scripts/` ETL patterns, `server/services/supabase/migrate.js` |
| 4 | Domain `routes.js` + controllers in `server/domains/` |
| 5 | `docs/EMAIL_ENGINE_LOCKED.md`, `server/routes/track.js`, `resendWebhookHandler.js` |
| 6 | `e2e/*.spec.js`, `server/tests/` |

### Locked zones (do not break)

| Zone | Doc |
| --- | --- |
| Email engine | `docs/EMAIL_ENGINE_LOCKED.md` |
| Production hosts | `.cursor/rules/production-hosts-locked.mdc` |
| Logo / spinner | `docs/LOGO_LOCKED.md` |

### Placeholder URLs (committed docs only)

| Placeholder | Use |
| --- | --- |
| `YOUR-PRODUCTION-API` | Legacy Express Render service |
| `YOUR-NESTJS-API` | New NestJS Render service during strangler |
| `YOUR-FRONTEND-DOMAIN` | Vercel production domain |
| `YOUR-RENDER-SERVICE` | Either API service on Render |

Real values: `.cursor/production-hosts.local.json` (gitignored).

---

*Last updated: 2026-06-10 — aligned with CoreKnot v1.0.7 strangler migration blueprint.*
