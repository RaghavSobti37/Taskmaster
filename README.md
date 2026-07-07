# CoreKnot

**CoreKnot** is the internal operations platform for [The Shakti Collective](https://theshakticollective.in). It unifies project delivery, CRM, mail campaigns, finance document processing, HR attendance, Artist OS, and platform administration behind a single multi-tenant API and React workspace.

| | |
|---|---|
| **Version** | 1.0.7 |
| **Runtime** | Node.js ≥ 18 |
| **Package root** | `coreknot/Taskmaster` |
| **Primary stack** | React 18 · Vite · Express · Mongoose · MongoDB Atlas |
| **Secondary stack** | NestJS · Prisma · Postgres (attendance strangler / ETL path) |

---

## Table of contents

1. [Repository layout](#repository-layout)
2. [Architecture](#architecture)
3. [Environments](#environments)
4. [Local development](#local-development)
5. [Quality gates](#quality-gates)
6. [Deployment](#deployment)
7. [Staging mirror](#staging-mirror)
8. [Finance document pipeline](#finance-document-pipeline)
9. [Authentication & access](#authentication--access)
10. [Operational scripts](#operational-scripts)
11. [Documentation](#documentation)
12. [Contributing](#contributing)

---

## Repository layout

```
coreknot/Taskmaster/
├── client/              React SPA (Vite 5, Tailwind v4, PWA)
├── server/              Express API — primary backend
├── nestjs-server/       NestJS + Prisma (Postgres path, attendance strangler)
├── shared/              Cross-runtime contracts and utilities
├── packages/            design-tokens, ui-components, sync-client, local-database
├── sites/               Vercel satellite builds (auth, landing)
├── scripts/             Deploy, staging, env sync, doc generation
├── docs/                Human-readable operational and feature docs
├── e2e/                 Playwright journeys
└── render.yaml          Render Blueprint (production + staging services)
```

**Canonical route reference** (every page, hook, API string): [`docs/reference/COREKNOT_MASTER.md`](docs/reference/COREKNOT_MASTER.md)

Regenerate after large route changes:

```bash
npm run docs:generate
```

---

## Architecture

### Production

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (tsccoreknot.com · auth · landing)                     │
│  Vercel — static client + /api/* rewrite to Render              │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  CoreKnot-api (Render · branch: main)                           │
│  COREKNOT_DEPLOY_TIER=production                                │
└─────┬──────────────┬──────────────┬─────────────────────────────┘
      │              │              │
      ▼              ▼              ▼
 MongoDB Atlas   taskmaster-redis   Socket.IO / BullMQ
 taskmaster_     (Key Value,         Supabase (secondary)
 production      noeviction)
```

- **Frontend:** Vercel serves `client/dist`. `generateVercelConfig.cjs` writes `/api` and `/socket.io` rewrites to the Render API at build time.
- **API:** Express on Render. Session JWT in HttpOnly cookie `coreknot_token_v3` (sliding 7d idle / 30d absolute).
- **Data:** MongoDB Atlas is the system of record. Redis backs queues and cache. NestJS handles the attendance strangler against Postgres where enabled. Production queue health depends on a writable Render Key Value Redis URL; BullMQ startup errors such as `Stream isn't writeable and enableOfflineQueue options is false` mean the service is not connected to a writable Redis instance and should be treated as deploy/runtime drift.

### Site modes

`VITE_SITE_MODE` controls satellite builds:

| Mode | Purpose | Typical host |
|------|---------|--------------|
| `app` | Full workspace | `tsccoreknot.com` |
| `auth` | Login shell | `auth.tsccoreknot.com` |
| `landing` | Marketing | `landing.tsccoreknot.com` |

Cross-subdomain auth uses cookie domain `.tsccoreknot.com` when configured.

> **URL policy:** Production and staging hostnames are **not** committed. Use gitignored [`.cursor/production-hosts.local.json`](.cursor/production-hosts.local.example.json) (copy from `.cursor/production-hosts.local.example.json`) for local tooling, Vercel proxy generation, and deploy scripts.

---

## Environments

| Environment | Frontend | API | MongoDB | `COREKNOT_DEPLOY_TIER` |
|-------------|----------|-----|---------|------------------------|
| **Local** | `localhost:5173` | `localhost:5000` | `taskmaster_local` | — |
| **Staging** | Vercel Preview (`staging` branch) | `coreknot-api-staging` | `taskmaster_staging` (isolated, empty by default) | `staging` |
| **Production** | Vercel Production (`main`) | `CoreKnot-api` | `taskmaster_production` | `production` |

Full variable matrix: [`docs/operations/environments.md`](docs/operations/environments.md)

**Important:** Vercel Preview builds target the **staging API**, not production. `generateVercelConfig.cjs` overrides production `VITE_API_URL` on preview deploys so Network tab traffic never hits the production database.

---

## Local development

### Prerequisites

- Node.js ≥ 18, npm 11.x (see `packageManager` in `package.json`)
- MongoDB reachable at `taskmaster_local` (Atlas or local)
- Redis recommended (in-memory fallback exists for some local queue paths only)

### Bootstrap

```bash
npm run install:all

cp server/.env.example server/.env      # MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY minimum
cp client/.env.example client/.env      # VITE_API_URL=http://localhost:5000

npm run preflight                       # validates required env
npm run dev                             # API :5000 + client :5173
```

Detailed checklist: [`docs/operations/local-development.md`](docs/operations/local-development.md)  
Database conventions: [`docs/operations/LOCAL_DEV_DATABASE.md`](docs/operations/LOCAL_DEV_DATABASE.md)

### Optional: refresh local data from production

```bash
# TSC org only — skips Data Hub / Exly heavy data; finance metadata-only
npm run sync:prod-tenant-tsc

# Or operational slice (all tenants, no CRM spine)
npm run sync:prod-to-local:operational
```

Set `PLATFORM_TENANT_SLUG=tsc` in `server/.env`. Restart API after sync. See [`docs/operations/LOCAL_DEV_DATABASE.md`](docs/operations/LOCAL_DEV_DATABASE.md).

### Optional seed

```bash
cd server
node scripts/seedDepartmentsAndTaskTypes.js
node scripts/reconcileDataHub.js --full
```

**Connected Apps + Website Forms demo** (from package root):

```bash
npm run seed:local-integrations-demo
```

See [`docs/operations/LOCAL_DEV_DEMO_DATA.md`](docs/operations/LOCAL_DEV_DEMO_DATA.md).

### Nest / Postgres path (optional)

```bash
npm run local:setup      # Docker Postgres + ETL from hosts file
npm run dev:nest         # Nest on :5001
```

---

## Quality gates

Run these before opening a PR or promoting a branch:

```bash
npm run audit:exposure              # blocks committed secrets (required)
npm test --prefix server            # Jest — API + domain tests
npm test --prefix client            # Vitest + generateVercelConfig tests
npm run build --prefix client       # production bundle + PWA service worker
node server/scripts/enterpriseSmoke.cjs   # enterprise API smoke (needs Mongo)
```

Full CI bundle (matches GitHub Actions intent):

```bash
npm run ci
```

| Check | Command |
|-------|---------|
| Staging smoke | `npm run staging:readiness` |
| Production smoke | `npm run production:readiness` |
| E2E (public routes) | `npm run test:e2e:public` |
| E2E (authenticated) | `E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e:auth` |

---

## Deployment

### Production

| Surface | Provider | Branch | Notes |
|---------|----------|--------|-------|
| Frontend | Vercel | `main` | `RENDER_API_PROXY_URL` set in Vercel env |
| API | Render (`CoreKnot-api`) | `main` | `render.yaml` blueprint; `autoDeploy` per service |
| Redis | Render Key Value (`taskmaster-redis`) | — | `maxmemoryPolicy: noeviction` |
| Database | MongoDB Atlas | — | `MONGODB_URI_PROD` on Render only |
| Crons | Render | `main` | Daily backup, subscription reminders |

Deploy checklist: [`docs/operations/deployment.md`](docs/operations/deployment.md)

Redis/BullMQ production rule: link `REDIS_URL` to the API service and any queue-dependent worker service from the same Render Key Value instance, keep the Redis maxmemory policy at `noeviction`, and redeploy after env changes. In-memory fallback is a local safety net, not a production operating mode.

```bash
npm run production:readiness
npm run production:deploy -- --wait    # requires RENDER_API_KEY in server/.env
```

### Branch promotion (recommended)

```
feature/* → dev → staging → main
              │       │        │
              │       │        └─ Vercel Production + Render production API
              │       └─ Vercel Preview + Render staging API
              └─ integration testing locally / CI
```

`CONTRIBUTING.md` — no direct pushes to `main`; exposure audit must pass on every commit (husky).

---

## Staging mirror

Staging reproduces production topology with an **isolated, empty** MongoDB database. It does **not** clone production data.

```
Vercel Preview (staging branch)
        │
        ▼
coreknot-api-staging ──► taskmaster_staging (Atlas)
        │                      ▲
        ├── taskmaster-redis-staging
        └── coreknot-nest-staging ──► Supabase preview Postgres
```

| Render service | Purpose |
|----------------|---------|
| `coreknot-api-staging` | Express API, `COREKNOT_DEPLOY_TIER=staging` |
| `coreknot-nest-staging` | Nest attendance / sync path |
| `taskmaster-redis-staging` | Dedicated Redis (no production sharing) |

Staging crons are intentionally omitted to avoid backup/reminder emails against an empty database.

### One-time provisioning

1. Create empty `taskmaster_staging` in Atlas (same cluster is fine).
2. Add to gitignored `server/.env.render`:
   ```env
   MONGODB_URI_STAGING=mongodb+srv://USER:PASS@cluster.example/taskmaster_staging
   RENDER_API_KEY=rnd_…
   ```
   Or run: `node scripts/ensure-staging-mongo-env.mjs` (derives staging URI from `MONGODB_URI_PROD`).
3. Provision and deploy:
   ```bash
   npm run staging:create
   node scripts/restore-staging-render-env.mjs
   npm run staging:deploy -- --wait
   ```
4. Bootstrap data:
   ```bash
   npm run migrate:up --prefix server    # schema migrations
   npm run staging:seed                  # minimal tenant + admin
   ```
5. Wire Vercel Preview to staging API:
   ```bash
   npm run preview:vercel-env:push
   ```

### Verify staging

```bash
npm run staging:readiness
curl -s https://coreknot-api-staging.onrender.com/api/health | jq '.build.deployTier, .dependencies.mongodb'
# expect: "staging", "connected"
```

If Nest Postgres is unavailable, run `npm run staging:patch-nest` and confirm Supabase preview allows Render egress.

Full runbook: [`docs/operations/STAGING_SETUP.md`](docs/operations/STAGING_SETUP.md)

---

## Finance document pipeline

Finance uploads run through `server/utils/documentParser.js` with a deterministic date-resolution ladder:

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | OCR / text labels | `extractPaymentDateFromText`, PDF screenshot OCR for scanned docs |
| 2 | Filename inference | Date patterns in `fileName` / `title` |
| 3 | PDF embedded metadata | `CreationDate`, `ModDate`, XMP via `pdf-parse` `getInfo()` → `getDateNode()` |
| 4 | Upload timestamp | **Only** zero-text `xlsx` / `xls` / `csv` / `docx` (narrow fallback) |

Production backfill and repair:

```bash
# Dates only, missing metadata.date
node server/scripts/reparseFinanceOcr.js --prod --missing-date --dates-only

# PDF Info/XMP metadata pass
node server/scripts/reparseFinanceOcr.js --prod --missing-date --pdf-metadata-only --dates-only

# Full OCR reparse (scanned PDFs)
node server/scripts/reparseFinanceOcr.js --prod --ocr-scanned
```

Unit tests: `npm test --prefix server -- tests/documentParser.test.js`

---

## Authentication & access

| Method | Usage |
|--------|-------|
| **Clerk** | Primary sign-in on production and preview (`auth.tsccoreknot.com`) |
| **Google OAuth** | Workspace linking, artist analytics |
| **JWT cookie** | API session after Clerk establish (`POST /api/auth/clerk-establish`) |
| **Closed onboarding** | `/register` submits access requests; admins provision users in Admin → Users |

**Clerk on auth subdomain:** Do not call `setActive` for org switching on the auth host — server pins org via `CLERK_ORGANIZATION_ID`. If the auth host shows stale `session/touch` 401s or loops after a deploy, use **Clear session cookies** in the auth legal footer (Privacy · User Data Deletion · Clear cookies), then sign in again so `POST /api/auth/clerk-establish` can mint a fresh CoreKnot cookie.

**Org URLs:** When `VITE_ORG_SLUG_ROUTES` is enabled (default), workspace routes are prefixed with tenant slug (e.g. `/tsc/dashboard`). Bootstrap: `GET /api/orgs/:slug/context`.

**Platform tenant:** `PLATFORM_TENANT_SLUG=tsc` (server + Render) for single-org Shakti Collective deployments.

Page access is enforced via department presets in `client/src/utils/pagePermissions.js`. Platform roles are stored in MongoDB (env bootstrap IDs are optional on first empty DB).

Auth detail: [`docs/auth/google-oauth.md`](docs/auth/google-oauth.md)

---

## Operational scripts

| Script | Purpose |
|--------|---------|
| `npm run staging:create` | Provision Render staging services (API, Nest, Redis) |
| `node scripts/restore-staging-render-env.mjs` | Full env mirror onto `coreknot-api-staging` |
| `npm run staging:deploy -- --wait` | Deploy staging + health poll |
| `npm run staging:readiness` | Pre-flight smoke (API required, Nest warns) |
| `npm run preview:vercel-env:push` | Set Vercel Preview `VITE_API_URL` → staging |
| `npm run production:deploy -- --wait` | Production Render deploy |
| `npm run memory:report` | Agent session changelog helper |
| `npm run sync:prod-tenant-tsc` | TSC tenant prod → local (skips Data Hub/Exly; finance lite) |
| `npm run sync:prod-to-local:operational` | Operational prod → local (no CRM spine) |
| `node server/scripts/reparseFinanceOcr.js` | Finance OCR / date repair |

Full catalog: [`docs/operations/SCRIPTS_RUNBOOK.md`](docs/operations/SCRIPTS_RUNBOOK.md)

### Locked zones (read before editing)

| Area | Reference |
|------|-----------|
| Email open/click tracking | [`docs/reference/EMAIL_ENGINE_LOCKED.md`](docs/reference/EMAIL_ENGINE_LOCKED.md) |
| Brand mark + spinner | [`docs/reference/LOGO_LOCKED.md`](docs/reference/LOGO_LOCKED.md) |
| Client UI system | [`docs/design/DESIGN-REFERENCE.md`](docs/design/DESIGN-REFERENCE.md) |
| Legacy API freeze | [`docs/architecture/LEGACY_FREEZE.md`](docs/architecture/LEGACY_FREEZE.md) |

---

## Documentation

| Document | When to use |
|----------|-------------|
| [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) | Navigate all docs |
| [`docs/reference/COREKNOT_MASTER.md`](docs/reference/COREKNOT_MASTER.md) | Page-level source of truth |
| [`docs/operations/environments.md`](docs/operations/environments.md) | Env vars by tier |
| [`docs/operations/deployment.md`](docs/operations/deployment.md) | Render + Vercel deploy |
| [`docs/operations/STAGING_SETUP.md`](docs/operations/STAGING_SETUP.md) | Staging mirror setup |
| [`docs/operations/ENTERPRISE_READINESS.md`](docs/operations/ENTERPRISE_READINESS.md) | Multi-org, audit, enterprise APIs |
| [`docs/features/CONNECTED_APPS_AND_INTAKE.md`](docs/features/CONNECTED_APPS_AND_INTAKE.md) | Integrations, forms, intake |
| [`docs/operations/LOCAL_DEV_DEMO_DATA.md`](docs/operations/LOCAL_DEV_DEMO_DATA.md) | Local integrations demo seed |
| [`docs/operations/KNOWLEDGE_ENGINE_REMOVAL.md`](docs/operations/KNOWLEDGE_ENGINE_REMOVAL.md) | KE removal log |
| [`docs/features/artist-os.md`](docs/features/artist-os.md) | Artist OS routes |
| [`docs/reference/VERSION_HISTORY.md`](docs/reference/VERSION_HISTORY.md) | Release notes |
| [`AGENTS.md`](AGENTS.md) | Cursor / agent conventions |

---

## Product modules

| Module | Capabilities |
|--------|--------------|
| **Projects** | Workspaces, tasks, peer review, analytics |
| **CRM** | Leads, follow-ups, Exly bookings, artist pipeline |
| **Data Hub** | Unified person graph (`/admin`) |
| **Mail** | Campaigns, templates, Resend dispatch, engagement filters |
| **Finance** | Document upload, OCR, metadata dates, approvals |
| **Management** | Org documents, platform settings |
| **HR** | Attendance, daily logs, leave |
| **Artists** | Artist OS, OAuth analytics, workspace membership |
| **Platform** | Gamification, notifications, admin tooling, QA runner |
| **Connected Apps** | Gmail, Resend, Google Sheets, AiSensy, inbound webhook; Website Forms embed |

Feature memory (agents): [`.specify/memory/features/modules.md`](.specify/memory/features/modules.md)

---

## Contributing

1. Branch from `dev`; never push directly to `main`.
2. Run the [quality gates](#quality-gates) locally.
3. Ensure `npm run audit:exposure` passes (enforced on commit).
4. Open PR with test evidence; request review before merge to `staging` / `main`.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## External webhooks

Replace `<API_HOST>` with your Render production URL:

```
POST <API_HOST>/api/webhooks/book-call
POST <API_HOST>/api/webhooks/artist-enquiry
POST <API_HOST>/api/webhooks/artist-path
POST <API_HOST>/api/webhooks/newsletter
```

Webhook secrets and full URL map: `.cursor/production-hosts.local.example.json` → `webhooks` / `externalWebhooksToConfigure`.

Resend delivery events use `POST <API_HOST>/api/track/webhooks/resend`. On Render, slow `POST /api/track/webhooks/resend` logs usually mean webhook processing is doing campaign/recipient lookup, geo enrichment, or tenant resolution inline. Confirm `RESEND_WEBHOOK_SECRET` is set, `TRACKING_BASE_URL` points to the API host, Redis is writable for queue-dependent mail paths, and no real secret values are copied into docs or logs.

---

*Copyright © 2026 CoreKnot / The Shakti Collective.*
