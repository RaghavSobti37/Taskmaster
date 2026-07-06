# CoreKnot (Taskmaster) — Master Project Context

> **Purpose:** Complete reference — API surface, env vars, business rules.  
> **Page-level catalog (every route + hooks + APIs):** [`docs/reference/COREKNOT_MASTER.md`](../../docs/reference/COREKNOT_MASTER.md)  
> **Navigable memory:** [`INDEX.md`](INDEX.md)  
> **Product:** CoreKnot · **Version:** `1.0.7` · **Last compiled:** 2026-07-02

---

## Table of Contents

1. [How to Use This Document](#1-how-to-use-this-document)
2. [Executive Summary](#2-executive-summary)
3. [Brand & Logo Philosophy](#3-brand--logo-philosophy)
4. [Repository Layout](#4-repository-layout)
5. [Tech Stack](#5-tech-stack)
6. [System Architecture](#6-system-architecture)
7. [Deployment & Infrastructure](#7-deployment--infrastructure)
8. [Environment Variables](#8-environment-variables)
9. [Authentication & Sessions](#9-authentication--sessions)
10. [Authorization & Permissions](#10-authorization--permissions)
11. [Multi-Tenancy](#11-multi-tenancy)
12. [Backend — Complete Reference](#12-backend--complete-reference)
13. [Frontend — Complete Reference](#13-frontend--complete-reference)
14. [Shared Cross-Package Contracts](#14-shared-cross-package-contracts)
15. [Feature Modules (Deep Dive)](#15-feature-modules-deep-dive)
16. [Email Engine (LOCKED)](#16-email-engine-locked)
17. [Supabase Secondary Store](#17-supabase-secondary-store)
18. [Background Jobs, Cron & Webhooks](#18-background-jobs-cron--webhooks)
19. [External Integrations](#19-external-integrations)
20. [Testing & QA](#20-testing--qa)
21. [CI/CD & Build Pipeline](#21-cicd--build-pipeline)
22. [Scripts & Maintenance Catalog](#22-scripts--maintenance-catalog)
23. [Observability & Diagnostics](#23-observability--diagnostics)
24. [Critical Business Rules](#24-critical-business-rules)
25. [Locked Zones — Do Not Modify](#25-locked-zones--do-not-modify)
26. [UI/UX Conventions](#26-uiux-conventions)
27. [Documentation Index](#27-documentation-index)
28. [Recent Changes & In-Flight Work](#28-recent-changes--in-flight-work)
29. [Related Memory Files](#29-related-memory-files)
30. [Backend Migration (NestJS + Prisma + Supabase)](#30-backend-migration-nestjs--prisma--supabase)

---

## 1. How to Use This Document

| Audience | Guidance |
| --- | --- |
| **New developer** | Read §2–§7, then skim §15 for your feature area |
| **AI coding agent** | Read entire file before changes; check §25 locked zones first |
| **Ops / deploy** | §7, §8, §21, §22, `docs/DEPLOY_ENV.md` |
| **Security review** | §9–§11, §25, `docs/SECURITY.md` |

**Component memory (read [`INDEX.md`](INDEX.md) for full map):**

| Folder / File | Role |
| --- | --- |
| [`INDEX.md`](INDEX.md) | Navigation hub — start here |
| [`platform/overview.md`](platform/overview.md) | Product scope, stack, brand |
| [`platform/deployment.md`](platform/deployment.md) | Render + Vercel, hosts, CI/CD |
| [`architecture/system.md`](architecture/system.md) | System diagram, request lifecycle |
| [`architecture/data.md`](architecture/data.md) | Mongo, Supabase, backups, email analytics |
| [`frontend/client.md`](frontend/client.md) | React SPA routes, components, UI |
| [`backend/express.md`](backend/express.md) | Express API, domains, services |
| [`backend/nestjs-migration.md`](backend/nestjs-migration.md) | NestJS strangler migration |
| [`auth/security.md`](auth/security.md) | JWT, OAuth, permissions, tenancy |
| [`features/modules.md`](features/modules.md) | All feature modules |
| [`operations/conventions.md`](operations/conventions.md) | Locked zones, audits, scripts |
| [`operations/testing.md`](operations/testing.md) | Jest, Vitest, Playwright, QA |
| [`changelog/recent-changes.md`](changelog/recent-changes.md) | Session delta |
| `docs/VERSION_HISTORY.md` | Full version-by-version changelog |

---

## 2. Executive Summary

CoreKnot is a **multi-tenant CRM and operations hub** for agency workflows. It unifies six TSC business lines (Films, Artists, Academy, Collabs, Studios, Corporate) into one workspace.

### What the platform does

| Domain | Capabilities |
| --- | --- |
| **Projects & tasks** | Workspaces, kanban-style tasks, peer review governance, @mentions, activity timeline, bug reporting |
| **CRM & sales** | Leads, follow-ups, booked calls, artist CRM, phone validation, Exly integration |
| **Data Hub** | Unified person/contact graph across multiple data inlets |
| **Data Master** | Person golden-record spine (`Person`, `PersonIdentifier`, `PersonHubView`) |
| **Email** | Campaigns, templates, HolySheet, open/click tracking, newsletter, Resend dispatch |
| **Finance** | Document OCR, invoices, reimbursements, USD/INR, folder hierarchy |
| **HR / attendance** | Manual Office/WFH check-in, worked vs daily-log metrics, leave requests |
| **Artists** | Spotify/YouTube/Meta analytics, Artist Path questionnaire, booking enquiries |
| **Gamification** | XP, levels, weekly leaderboard (Monday IST reset), missions |
| **Notifications** | In-app inbox, email, Web Push (VAPID), attendance checkout reminders |
| **Admin / ops** | System logs, QA runner (209+ cases), curated script runner, platform roles |
| **Assets** | File links + managed org accounts (emails, social IDs, platform logins) |

### Architecture in one sentence

**React/Vite PWA** on Vercel → same-origin `/api` proxy → **Express API** on Render → **MongoDB Atlas** (primary) + **Redis/BullMQ** + optional **Supabase Postgres** (secondary mirror) + **Socket.IO** realtime.

---

## 3. Brand & Logo Philosophy

### The Harmonic Frequency mark (LOCKED)

- **Hub + six spokes** = TSC's six segments (Films, Artists, Academy, Collabs, Studios, Corporate)
- **Presentation:** white mark on brand green `#126d5e`; 1.15× scale from hub
- **Loader:** `frl-v-02` fluid-ribbon cascade (Uniform Calm)
- **Full spec:** `docs/LOGO_LOCKED.md`
- **Locked files:** `client/src/components/brand/*`, `client/public/brand-mark.svg`, `.brand-logo` in `index.css`

### Loading UX policy

- **Spinner-only default** for tables, routes, panels
- **Phrases kept for:** boot (`AppBootFallback`), dashboard widgets, heavy pages (Finance, QA, Daily Log)
- **Policy:** `client/src/lib/loadingDisplay.js`

---

## 4. Repository Layout

```
Taskmaster/                          # Root monorepo (also called CoreKnot)
├── client/                          # React 18 SPA (Vite 5, Tailwind v4)
│   ├── public/                      # PWA manifest, icons, brand-mark.svg, sitemap
│   ├── scripts/                     # lighthouse-*.mjs, generate-pwa-icons.mjs
│   └── src/
│       ├── main.jsx                 # Provider tree, deferred SW register
│       ├── App.jsx                  # Routes, lazy loading, auth gates
│       ├── index.css                # Design tokens, Tailwind v4
│       ├── sw.js                    # Service worker (injectManifest)
│       ├── contexts/                # Auth, Theme, Sidebar, Toast, Confirm, UnsavedChanges
│       ├── hooks/                   # useTaskmasterQueries, useBreakpoint, useStatusCounts, etc.
│       ├── lib/                     # realtime, loadingDisplay, systemLogBridge, pageAnalytics
│       ├── utils/                   # CRM, attendance, mail, displayMode, pagePermissions, etc.
│       ├── constants/               # brandIcons, calendarOptions, taskOptions
│       ├── config/                  # integrations.config.js
│       ├── pages/                   # 60+ routed pages
│       └── components/              # 24 subfolders (admin, dashboard, tasks, ui, etc.)
├── server/                          # Node.js Express API
│   ├── server.js                    # Entry: middleware, routes, workers, static SPA in prod
│   ├── config/                      # database, realtime, uploadthing, adminScriptsCatalog, supabase
│   ├── routes/                      # 53 route files
│   ├── controllers/                 # 33 controller files
│   ├── models/                      # 72 Mongoose model files (71 collections)
│   ├── services/                    # 90+ service files
│   ├── middleware/                  # auth, logger, trace, error, concurrency
│   ├── utils/                       # 50+ utilities (auth, tracking, geo, validation, etc.)
│   ├── validation/                  # Zod schemas + validateBody/Query/Params
│   ├── workers/                     # 6 background workers
│   ├── scripts/                     # 113+ maintenance/migration scripts
│   ├── templates/                   # HTML email templates
│   ├── plugins/                     # tenantPlugin.js
│   ├── supabase/                    # schema.sql
│   └── tests/                       # 39 Jest test files
├── shared/                          # Cross-runtime JS (client + server)
│   └── contracts/                   # @coreknot/contracts — shared Zod API contracts
├── nestjs-server/                   # New NestJS modular monolith (port 5001, strangler target)
│   ├── prisma/                      # schema.prisma → Supabase PostgreSQL
│   └── src/domains/                 # NestJS modules per domain (attendance first)
├── e2e/                             # Playwright specs (5 + helpers)
├── scripts/                         # Root tooling (audits, Vercel config, git redaction)
├── docs/                            # 37 markdown specs + datadog/
├── .github/workflows/               # ci.yml, deploy-render.yml
├── .cursor/rules/                   # production-hosts, logo, email-engine locked rules
├── .specify/memory/                 # Agent memory — INDEX.md + component folders + MASTER.md
├── render.yaml                      # Render Blueprint (API, Redis, crons)
├── vercel.json                      # SPA + /api proxy to Render
└── package.json                     # coreknot v1.0.7 monorepo scripts
```

**Path aliases (client Vite):** `@` → `./src`, `@shared` → `../shared`

---

## 5. Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React 18, Vite 5, Tailwind CSS v4, TanStack Query 5, React Router 6, Framer Motion, Recharts |
| **Forms / validation** | React Hook Form, Zod (client + server) |
| **Backend (current)** | Node.js 18+, Express 4, Mongoose ODM — `server/domains/` modular monolith |
| **Backend (target)** | NestJS 11, Prisma ORM — `nestjs-server/` (Strangler Fig migration in progress) |
| **Primary DB (current)** | MongoDB Atlas |
| **Primary DB (target)** | Supabase PostgreSQL (elevated from secondary mirror) |
| **Secondary DB (transitional)** | Supabase Postgres mirror via `server/services/supabase/` until cutover |
| **Cache / queue** | Redis (Render Key Value, **noeviction** policy required for BullMQ) |
| **Background jobs** | BullMQ, node-cron, Trigger.dev SDK |
| **Realtime** | Socket.IO (JWT-authenticated) |
| **Auth** | HttpOnly JWT cookie (`coreknot_token_v3`), Google OAuth 2.0, optional Clerk SDK |
| **Email dispatch** | Resend (campaigns), Nodemailer/Gmail (password reset), SendGrid fallback |
| **File uploads** | UploadThing (finance documents) |
| **OCR** | pdf-parse, tesseract.js |
| **PWA** | vite-plugin-pwa, custom `sw.js`, Web Push (VAPID) |
| **Deploy** | Render (API + workers), Vercel (static frontend CDN) |
| **Testing** | Jest + mongodb-memory-server (server), Vitest (client), Playwright (e2e) |
| **Observability** | Sentry + Datadog wired but often unset in prod; SystemLog in-app |

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     React SPA (Vite + PWA) — Vercel                     │
│  Dashboard │ Projects │ CRM │ Finance │ Inbox │ Schedule │ Admin │ Hub  │
│            TanStack Query  │  Service Worker (sw.js)  │  Socket.IO      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  Same-origin /api/* + /socket.io/* proxy
┌────────────────────────────▼────────────────────────────────────────────┐
│                    Express API (server.js) — Render                     │
│  Auth │ Tasks │ Projects │ CRM │ Notifications │ Departments │ Mail     │
│  SystemHealthService │ Rate Limiting │ Helmet │ Gzip │ Trace IDs        │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │              │
   MongoDB        Redis/BullMQ   Socket.IO     External APIs
   (Mongoose)     (queues)       (realtime)    (Exly, Resend, Google, Meta…)
       │
   Supabase Postgres (optional secondary mirror via post-save hooks + sync worker)
```

### Request lifecycle

1. Browser hits `tsccoreknot.com` (or `localhost:5173` in dev)
2. API calls use relative `/api/...` (Vercel/Vite proxy → Render API)
3. `authMiddleware` verifies `coreknot_token_v3`, slides session if due
4. `tenantPlugin` scopes queries to user's tenant
5. Controller → Service → Model
6. `notificationDispatcher` / `systemLogService` / Supabase mirrors on write
7. Socket.IO broadcasts realtime updates to subscribed channels

### Local dev proxy

- `npm run dev` at root runs server (`:5000`) + client (`:5173`) concurrently
- Vite proxies `/api` and `/socket.io` to `localhost:5000`
- Client should use `VITE_API_URL=http://localhost:5000` in `.env`

---

## 7. Deployment & Infrastructure

### Production topology

| Service | Host | Notes |
| --- | --- | --- |
| **Frontend** | Vercel (`tsccoreknot.com`) | Static SPA from `client/dist` |
| **API** | Render web service | `rootDir: server`, health `GET /api/health` |
| **Redis** | Render Key Value | `noeviction` — **required** for BullMQ |
| **MongoDB** | Atlas | `taskmaster_production` |
| **Marketing site** | `theshakticollective.in` | Proxies book-call → Taskmaster webhook |

### Host configuration (LOCKED)

- **Truth file:** `.cursor/production-hosts.local.json` (gitignored)
- **Example:** `.cursor/production-hosts.local.example.json` (committed placeholders)
- **Rule:** `.cursor/rules/production-hosts-locked.mdc` (alwaysApply)
- **Never use:** legacy `CoreKnot-jfw0.onrender.com` / `taskmaster-jfw0` from old docs in new code

### Vercel routing

- `vercel.json` + `client/vercel.json` — rewrites `/api/*` and `/socket.io/*` to Render
- Generated by `scripts/generateVercelConfig.js` at build (uses `RENDER_API_PROXY_URL`)
- SPA fallback: all other paths → `/index.html`

### Render Blueprint (`render.yaml`)

| Service | Type | Purpose |
| --- | --- | --- |
| `CoreKnot-api` | Web | Production API |
| `coreknot-api-staging` | Web | Staging API |
| `taskmaster-redis` | Key Value | BullMQ + notification locks |
| `CoreKnot-daily-backup` | Cron | `runDailyBackup.js` (IST) |
| `CoreKnot-subscription-reminders` | Cron | `runSubscriptionReminders.js` |
| `CoreKnot-keep-warm` | Cron | `keepWarm.js` every 14 min |

> **Note:** Cron services may exist as blueprint only until provisioned on Render Dashboard. Use admin **DB Backup** or `npm run backup:daily` as fallback.

### CI deploy hook

- `.github/workflows/deploy-render.yml` — triggers Render deploy after CI passes on `main`

### Production build

In production, `server.js` serves `client/dist` as static files with cache headers (single-service deploy option).

### Large payload caveat

Campaign HTML + base64 attachments can exceed Vercel's ~4.5MB proxy limit. Upload attachments via `POST /api/campaigns/upload-attachment` directly to Render when needed.

---

## 8. Environment Variables

### Server — required

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Primary MongoDB connection |
| `JWT_SECRET` | JWT signing key |
| `ENCRYPTION_KEY` | 64-char hex for AES-256-GCM OAuth token encryption (production) |

### Server — auth & sessions

| Variable | Default | Purpose |
| --- | --- | --- |
| `JWT_EXPIRES_IN` | `7d` | Sliding inactivity window |
| `JWT_ABSOLUTE_MAX_DAYS` | `30` | Hard re-login cap |
| `JWT_REFRESH_MINUTES` | `60` | Cookie refresh throttle |
| `DEFAULT_SEED_PASSWORD` | `1Million#` | Org default for seed/weak-password reset |
| `ALLOWED_DOMAIN` | — | Production signup domain restriction |
| `ADMIN_EMAIL` | — | System mail CC, alerts |

### Server — URLs & CORS

| Variable | Purpose |
| --- | --- |
| `FRONTEND_URL` | Email CTAs, OAuth client redirect, Lighthouse base |
| `SERVER_URL` / `APP_BASE_URL` | Canonical API origin |
| `TRACKING_BASE_URL` | Email open/click pixel host (must match live Render API) |
| `CORS_ALLOWED_ORIGINS` | Extra allowed browser origins |
| `CORS_ALLOW_VERCEL_PREVIEWS` | Allow `*.vercel.app` in production |

### Server — integrations

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | BullMQ, notification locks, follow-up cache |
| `RESEND_API_KEY` | Campaign email dispatch |
| `GOOGLE_CLIENT_ID/SECRET` | Staff Google OAuth |
| `GOOGLE_REDIRECT_URI` | OAuth callback |
| `META_APP_ID/SECRET` | Instagram connect, webhook verification |
| `EXLY_API_KEY` | Exly offerings/bookings |
| `HOLYSHEET_API_KEY` | HolySheet contact sync |
| `BOOK_CALL_WEBHOOK_SECRET` | HMAC for book-call webhook |
| `EXLY_WEBHOOK_SECRET` | HMAC for Exly webhook |
| `ARTIST_ENQUIRY_WEBHOOK_SECRET` | HMAC for artist enquiry |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY` | Sheets append (legacy bookings) |
| `AISENSY_API_KEY` | WhatsApp booked-call confirmations |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT` | Web Push |
| `EMAIL_ADDRESS/PASSWORD/SERVICE` | Gmail SMTP for password reset |
| `UPLOADTHING_SECRET/APP_ID` | Finance file uploads |
| `TRIGGER_DEV_API_KEY` | Trigger.dev jobs |

### Server — database safety

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI_PROD` | Production URI for sync/backup scripts |
| `MONGODB_DB_LOCAL` | Default: `taskmaster_local` |
| `MONGODB_DB_PROD` | Default: `taskmaster_production` |
| `ALLOW_PROD_DB_IN_DEV` | Blocked by default — safety guard |
| `MAIL_USE_PROD_DB` | Intentional local send tests against prod mail DB |

### Server — attendance & office

| Variable | Purpose |
| --- | --- |
| `OFFICE_PUBLIC_IP` | IP hint for work-mode toggle |
| `OFFICE_IP_WHITELIST` | Office egress IPs |
| `ATTENDANCE_DEBUG` | Verbose attendance logs |

### Server — backup & Supabase

| Variable | Purpose |
| --- | --- |
| `BACKUP_ENABLED` | Enable backup service |
| `BACKUP_RETENTION_COUNT` | Default `2` snapshots |
| `MONGODB_BACKUP_DB` | GridFS backup database |
| `SUPABASE_SECONDARY_ENABLED` | Toggle Supabase mirror |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| `SUPABASE_DB_URL` | Direct Postgres connection |
| `SUPABASE_BACKUP_BUCKET` | Storage bucket for backups |

### Server — observability

| Variable | Purpose |
| --- | --- |
| `SENTRY_DSN` | Error tracking |
| `DD_API_KEY` | Datadog APM |
| `PERF_LOG_ENABLED` | Performance logging |

### Server — platform roles

| Variable | Purpose |
| --- | --- |
| `ROOT_ADMIN_USER_IDS` | Comma-separated root admin Mongo IDs |
| `PLATFORM_OWNER_USER_ID` | Bug report auto-assignee |
| `PLATFORM_OWNER_EMAIL` | Fallback platform owner lookup |

### Client

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API base (local: `http://localhost:5000`) |
| `VITE_GOOGLE_CLIENT_ID` | Google Sign-In button |
| `VITE_SENTRY_DSN` | Client error tracking |
| `VITE_DD_*` | Datadog RUM |
| `VITE_ENABLE_AGENTATION` | Dev-only UI annotation tool |

### Templates (no secrets committed)

- `server/.env.example`
- `server/.env.render.example`
- `server/.env.production.example`
- `client/.env.example`
- `docs/tsc-integration.env.example`

---

## 9. Authentication & Sessions

### Cookie-based JWT (v1.0.7)

| Item | Value |
| --- | --- |
| **Cookie name** | `coreknot_token_v3` |
| **Legacy purge** | `coreknot_token_v2`, `coreknot_token` cleared on every response |
| **Storage** | HttpOnly cookie — **not** localStorage |
| **Client** | `axios.defaults.withCredentials = true` |

### Sliding sessions (`server/utils/authSession.js`)

- **Inactivity:** 7 days (`JWT_EXPIRES_IN`) — renewed on API traffic
- **Absolute cap:** 30 days from first login (`JWT_ABSOLUTE_MAX_DAYS`)
- **Refresh throttle:** Once per 60 min (`JWT_REFRESH_MINUTES`)
- **`loginAt` preserved** across cookie slides

### Auth endpoints (`/api/auth`)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/register` | Signup (domain + department gated) |
| POST | `/login` | Email/password login |
| POST | `/logout` | Clear cookies + revoke session |
| GET | `/me` | Current user (session probe) |
| POST | `/forgot-password` | Send reset email (rate limited 5/hr) |
| POST | `/reset-password` | Token-based password reset |
| GET | `/google` | Initiate Google OAuth |
| GET | `/google/callback` | OAuth callback → ticket redirect |
| POST | `/oauth-establish` | Exchange OAuth ticket for cookie |
| GET | `/google/redirect-uri` | Diagnostic redirect URI |
| GET | `/sessions` | List active device sessions |
| DELETE | `/sessions/:jti` | Revoke one session |
| POST | `/sessions/revoke-others` | Revoke all other sessions |
| POST | `/change-required-password` | Force password change flow |

### Google OAuth cross-origin fix (v1.9.9)

1. Callback on API host issues short-lived `?ticket=` JWT
2. `GoogleSuccessPage` calls `POST /api/auth/oauth-establish`
3. Cookie set in XHR context (fixes Vercel + Render cross-origin 401 loops)

### Mobile / PWA login (v1.0.7)

- **All devices** use same-origin `/api` via Vercel/Vite proxy
- `displayMode.js` — `shouldUseSameOriginApi()` true for mobile browsers + PWA
- `AuthContext` — 6 retries on `/me` for Safari cookie races
- Login page **Clear session cookies** always visible

### Session IP (`sessionRequestMeta.js`)

- Extracts IP from `X-Forwarded-For`, `X-Real-IP`, `CF-Connecting-IP`
- Settings → Security shows public IP or **Local device** for loopback

### Dev bypass

- `DEBUG_BYPASS=true` + `Authorization: Bearer bypass_token` for local dev only

---

## 10. Authorization & Permissions

### Department-based access

- Users belong to a **Department** (admin, sales, operations, artist-management, etc.)
- `isAdminUser()` checks department slug/preset — not legacy `user.role`
- **Page permissions** on Department model — `hasPageAccess(pageKey)` on client + server

### Platform roles

- `PlatformSettings` model in MongoDB
- `ROOT_ADMIN_USER_IDS` / `PLATFORM_OWNER_USER_ID` env vars
- `shared/platformRoleDefinitions.js`, `shared/platformUserIds.js`
- Admin → Platform roles panel

### Project roles (`shared/projectRoles.js`)

| Role | Rank | Capabilities |
| --- | --- | --- |
| `admin` | 3 | Full project control |
| `manager` | 2 | Member management |
| `member` | 1 | Task execution |

Legacy `owner` normalizes to `admin`.

### Task review rules (`shared/taskReviewRules.js`)

- **Assignees** → `in-review` on completion
- **Creators** bypass review — can mark `done` directly
- **Platform owner** shares creator approve rights
- **Rollback** — creator, assignee, assigner, or platform owner
- **Daily log split:** assignee `TASK_COMPLETION` + assigner `TASK_REVIEW` (15 min default)

### Org accounts access

- `canAccessOrgAccounts()` — admin, artist-management, or operations

### Mail template approvers

- `shared/mailTemplateApprovers.js` — named emails + admin department

---

## 11. Multi-Tenancy

- **Tenant model** — each org has a tenant document
- **tenantPlugin** (`server/plugins/tenantPlugin.js`) — auto-injects `tenantId` on queries
- **bypassTenant** — used for cross-tenant public data (calendar musical days, mail events for tracking)
- Users scoped to their tenant on all protected routes

---

## 12. Backend — Complete Reference

> **Transitional state (Jun 2026):** Production still runs **legacy Express** (`server/`). A parallel **NestJS** app (`nestjs-server/`, port 5001) is being built via the Strangler Fig pattern. Express has been reorganized into `server/domains/` (auth, crm, mail, tasks, projects, artists, dashboard, data-hub, integrations) with `server/app/` bootstrap (`createApp.js`, `registerRoutes.js`, `startServer.js`). Legacy shims remain in `server/models/`, `server/controllers/`, `server/routes/` for backward compatibility. Full migration plan: **§30** and `docs/BACKEND_MIGRATION_PLAYBOOK.md`.

### Entry point

`server/server.js` → `server/app/startServer.js` — Express app, middleware stack, domain route mounts, worker startup, graceful shutdown, SystemHealthService.

**NestJS entry (sandbox):** `nestjs-server/src/main.ts` — global prefix `/api`, default port **5001**.

### Middleware

| File | Purpose |
| --- | --- |
| `authMiddleware.js` | JWT verify, session slide, absolute expiry |
| `loggerMiddleware.js` | Request logging |
| `traceMiddleware.js` | Correlation ID injection |
| `errorMiddleware.js` | Centralized error handler |
| `concurrencyMiddleware.js` | Optimistic concurrency (project `__v`) |

### Route mounts (from server.js)

| Mount | Route file |
| --- | --- |
| `/api/public` | `publicRoutes.js` |
| `/api/auth` | `authRoutes.js`, `authConnectRoutes.js` |
| `/api` | `openApiRoutes.js` (`GET /openapi.json`) |
| `/api/projects` | `projectRoutes.js` |
| `/api/tasks` | `taskRoutes.js` |
| `/api/users` | `userRoutes.js` |
| `/api/logs` | `logRoutes.js` |
| `/api/system-logs` | `systemLogRoutes.js` |
| `/api/teams` | `teamRoutes.js` |
| `/api/artists` | `artistRoutes.js` |
| `/api/v2/artists` | `artistV2Routes.js` |
| `/api/gamification` | `gamificationRoutes.js` |
| `/api/gamification-admin` | `gamificationAdminRoutes.js` |
| `/api/qa` | `qaRoutes.js` |
| `/api/customization` | `customizationRoutes.js` |
| `/api/crm` | `crmRoutes.js` |
| `/api/assets` | `assetRoutes.js` |
| `/api/google` | `googleRoutes.js` |
| `/api/google/accounts` | `googleAccounts.js` |
| `/api/proxy` | `proxyRoutes.js` |
| `/api/dashboard` | `dashboardRoutes.js` |
| `/api/calendar` | `calendarRoutes.js` |
| `/api/departments` | `departmentRoutes.js` |
| `/api/schedule` | `scheduleRoutes.js` |
| `/api/notifications` | `notificationRoutes.js` |
| `/api/notes` | `noteRoutes.js` |
| `/api/search` | `searchRoutes.js` |
| `/api/pinboard` | `pinBoardRoutes.js` |
| `/api/mail` | `mailRoutes.js` |
| `/api/ses` | `sesRoutes.js` |
| `/api/tsc` | `tscRoutes.js` |
| `/api/data-hub` | `dataHubRoutes.js` |
| `/api/artist-path` | `artistPathRoutes.js` |
| `/api/track` | `track.js` |
| `/api/campaigns` | `campaignRoutes.js` |
| `/api/analytics` | `analyticsRoutes.js` |
| `/api/webhooks` | `webhookRoutes.js` |
| `/api/integrations` | `integrationsRoutes.js` |
| `/api/office-assets` | `officeAssetRoutes.js` |
| `/api/subscriptions` | `subscriptionRoutes.js` |
| `/api/org-accounts` | `orgAccountRoutes.js` |
| `/api/contacts` | `contactRoutes.js` |
| `/api/exly` | `exlyRoutes.js` |
| `/api/newsletter` | `newsletterRoutes.js` |
| `/api/finance` | `financeRoutes.js` |
| `/api/attendance` | `attendanceRoutes.js` |
| `/api/announcements` | `announcementRoutes.js` |
| `/api/admin/scripts` | `adminScriptsRoutes.js` |
| `/api/admin/supabase` | `supabaseAdminRoutes.js` |
| `/api/admin/queues` | `queueAdminRoutes.js` |
| `/api/admin` | `masterclassReviewAdminRoutes.js` |
| `/api/uploadthing` | UploadThing handler |
| root | `track.js` (legacy `/webhooks/bounces`, `/unsubscribe`) |

### Controllers (33 files)

`analyticsController`, `artistAnalyticsController`, `artistController`, `artistCrmController`, `artistShareController`, `assetController`, `authController`, `connectionAuthController`, `crmController`, `customizationController`, `dashboardController`, `dataHubController`, `exlyController`, `financeController`, `googleController`, `integrationsVerifyController`, `mailAnalyticsController`, `metaDataDeletionController`, `noteController`, `orgAccountController`, `pinBoardController`, `projectController`, `projectGoalsController`, `projectKraController`, `proxyController`, `qaTestingController`, `subscriptionController`, `taskController`, `teamController`, `tscController`, `unifiedSearchController`, `userController`, `webhookController`

### Mongoose models (72 files)

| Model | Collection / purpose |
| --- | --- |
| `Announcement` | Team announcements |
| `Artist` | Artist profiles |
| `ArtistAuth` | Artist OAuth tokens |
| `ArtistConnection` | Platform connections (Spotify, YouTube, Meta) |
| `ArtistMetrics` | Cached artist stats |
| `ArtistPathResponse` | Artist Path questionnaire answers |
| `Asset` | File link assets |
| `Attendance` | Check-in/out records |
| `BookedCall` | Website book-a-call records |
| `CalendarEvent` | Calendar events (incl. musical_day) |
| `Campaign` | Email campaigns (legacy) |
| `CRMAudit` | CRM change audit trail |
| `CRMConfig` | CRM configuration |
| `CRMImport` | CSV import batches |
| `CRMStatSnapshot` | CRM stats snapshots |
| `DailyMission` | Gamification daily missions |
| `DashboardPreset` | User dashboard layouts |
| `DataHubSyncState` | Data Hub sync timestamps |
| `Department` | Org departments + page permissions |
| `EmailLog` | Email send logs |
| `EmailProfile` | Sender profiles (Resend from-address) |
| `EMI` | Lead EMI tracking |
| `ExlyBooking` | Exly booking records |
| `ExlyOffering` | Exly course offerings |
| `FinanceDocument` | Finance docs + OCR metadata |
| `GamificationConfig` | XP rules configuration |
| `Lead` | CRM leads |
| `LeaveRequest` | Attendance leave requests |
| `Log` | Daily time logs |
| `MailCampaign` | Mail campaigns |
| `MailEvent` | Open/click/bounce events |
| `MailTemplate` | Email templates (draft/approve workflow) |
| `MasterclassReview` | Masterclass review submissions |
| `MetaDeletionRequest` | Meta data deletion requests |
| `NavbarPreference` | User navbar customization |
| `NewsletterArticle` | Newsletter articles |
| `NewsletterIssue` | Newsletter issues |
| `NewsletterSubscriber` | Newsletter subscribers |
| `Notification` | In-app notifications |
| `OfficeAsset` | Office equipment tracking |
| `OfficeContact` | Office contacts |
| `OrgAccount` | Managed org credentials |
| `OutsourcedRecord` | Outsourced data records |
| `Person` | Data Master golden record |
| `PersonCommunicationProfile` | Person comms preferences |
| `PersonHubView` | Denormalized hub view |
| `PersonIdentifier` | Email/phone identifiers |
| `PersonIndex` | Searchable person index |
| `PersonSourceLink` | Links person → source records |
| `Phase` | Project phases |
| `PinBoardNote` | Dashboard pin board |
| `PlatformSettings` | Platform role configuration |
| `Project` | Projects |
| `ProjectGoal` | Project goals/KRAs |
| `ProjectGoalSnapshot` | Goal snapshot history |
| `ProjectKRA` | Key result areas |
| `QATestRun` | QA test run records |
| `ShortcutPreference` | Keyboard shortcuts |
| `Subscription` | Office SaaS subscriptions |
| `SystemLog` | Ops system logs |
| `Task` | Tasks |
| `TaskActivity` | Task activity timeline |
| `TaskAssignment` | Task assignee join table |
| `TaskMentionReceipt` | Unread mention tracking |
| `TaskType` | Task type catalog |
| `Team` | Teams |
| `Tenant` | Multi-tenant org |
| `TscData` | TSC HolySheet contacts |
| `User` | Users |
| `UserNote` | Private sticky notes |
| `Workspace` | Project workspaces |
| `WorkspacePreference` | Workspace UI prefs |
| `XPAuditLog` | Gamification XP audit |

**Helper:** `personFields.js` (shared person field definitions)

### Services (grouped)

**Core domain:** `TaskService`, `TaskActivityService`, `ContactService`, `LeadService`, `FollowupService`, `scheduleService`, `departmentService`, `PersonIdentityService`, `PersonHubBuilder`, `DataHubService`, `UnifiedSearchService`, `projectAnalyticsService`, `projectGoalsService`, `analyticsService`, `platformSettingsService`

**Email:** `mailService`, `mailDriver`, `emailProcessor`, `holySheetService`, `profileSendStats`, `campaignQueueState`

**CRM / artists:** `artistEnrichmentService`, `artistEnquiryService`, `artistPathHubService`, `artistPathImportService`, `artistCrmImportService`, `orgAccountImportService`, `leadPhoneRepair`, `sourceRecordService`, `reviewExploitRepairService`

**Newsletter / Exly:** `newsletterCompileService`, `newsletterAudienceService`, `newsletterLinkPreviewService`, `newsletterWebhookService`, `exlyService`, `exlyOfferingMetrics`, `exlyOfferingMigration`, `musicCalendarSeedService`

**Gamification / notifications:** `gamificationService`, `notificationService`, `notificationDispatcher`, `pushNotificationService`, `eventDispatcher`, `masterclassReviewService`

**Infra:** `SystemHealthService`, `systemLogService`, `databaseBackupService`, `csvBackupService`, `backupNotificationService`, `cacheService`, `queueService`, `backgroundQueue`, `queueAdminService`, `taskActivityPurgeService`, `subscriptionReminderService`, `usdInrRateService`, `monthlyReportService`, `metricsNormalizer`, `followupCache`, `connectionService`, `metaGraphService`, `spotifyTokenManager`, `triggerService`

**QA:** `qaTestingService`, `qaPreDeploymentChecklist`, `qa/qaApiClient`, `qa/qaIntegrationRunners`, `qa/qaIntegrationTests`, `qa/qaTestData`, `qa/qaActivity`, `qa/qaCheckUtils`, `qa/qaExtendedProbes`, `qa/qaLighthouseRunner`, `qa/lighthouseRoutes`, `qa/qaSuite3Static`, `qa/qaSuite4V19`, `qa/qaSuite5Features`

**Supabase:** `supabase/client`, `health`, `registerMirrors`, `syncService`, `migrate`, `fastMigrate`, `batchInsert`, `backupStore`, `logStore`, `snapshotStore`, `mailRollupStore`

### Workers

| Worker | Purpose |
| --- | --- |
| `statsWorker.js` | Periodic stats aggregation |
| `webhookWorker.js` | Async webhook processing |
| `importWorker.js` | Bulk import jobs |
| `logArchiverWorker.js` | Log archival |
| `taskActivityPurgeWorker.js` | Trim old task activity |
| `supabaseSyncWorker.js` | Batch sync to Supabase |

### Validation (Zod)

`server/validation/` — schemas for campaigns, projects, data-hub, finance, mail, attendance, notes, gamification, artist, admin scripts. Middleware: `validateBody`, `validateQuery`, `validateParams`.

---

## 13. Frontend — Complete Reference

### Entry & providers

- `main.jsx` — React root, QueryClient, theme, deferred SW
- `App.jsx` — Router, lazy routes, `ProtectedRoute`, `PageRoute` guards

### Contexts

| Context | Purpose |
| --- | --- |
| `AuthContext` | Session, heartbeat, logout epoch, mobile retries |
| `ThemeContext` | Light/dark mode |
| `SidebarContext` | Sidebar collapse state |
| `ToastContext` | react-hot-toast wrapper |
| `ConfirmProvider` | Imperative confirm dialogs |
| `UnsavedChangesProvider` | Global unsaved-changes bar |

### Key hooks

`useTaskmasterQueries` (main data layer), `useBreakpoint`, `useStatusCounts`, `useNavbarPreferences`, `useUsdInrRate`, `useUnsavedChanges`, `useAuthenticatedRealtime`, `usePwaInstall`, `useDebounce`, `useColumnSort`, `useLeaderboardBreakdown`, `useWorkModeHint`, notifications hooks

### Public routes (no auth)

| Path | Page |
| --- | --- |
| `/` | `LandingPage` |
| `/login` | `LoginPage` |
| `/register` | `RegisterPage` |
| `/forgot-password` | `ForgotPasswordPage` |
| `/reset-password` | `ResetPasswordPage` |
| `/relegends` | Legacy slug; redirects to `/login` |
| `/auth/google/success` | `GoogleSuccessPage` |
| `/oauth/meta/callback` | `MetaOAuthCallback` |
| `/privacy` | `PrivacyPolicy` |
| `/userdata` | `UserDataDeletion` |
| `/preview/artist/:id/*` | `ArtistDetail` (preview) |
| `/unsubscribe` | `Unsubscribe` |

### Protected routes (MainLayout)

| Path | Page / Hub |
| --- | --- |
| `/dashboard` | `Dashboard` |
| `/projects`, `/projects/new`, `/projects/:id` | Project views |
| `/projects/:id/analytics` | `ProjectAnalyticsPage` |
| `/workspaces/:name` | `WorkspaceSettings` |
| `/calendar` | `CalendarView` |
| `/settings` | `SettingsPage` (+ tabs) |
| `/logs` | `DailyLogPage` |
| `/attendance`, `/attendance/all` | `AttendancePage` |
| `/schedule` | `SchedulePage` |
| `/inbox` | `InboxPage` |
| `/todo` | `TodoPage` |
| `/notes`, `/notes/new`, `/notes/:id` | Notes |
| `/crm?tab=*` | `CrmHub` → Leads, Followups, Bookings |
| `/office?tab=*` | `OfficeHub` → Equipment, Contacts, Subscriptions |
| `/management?tab=*` | `ManagementHub` → Finance, Announcements, Ops Logs, Artists |
| `/admin/console` | `AdminConsole` |
| `/assets`, `/assets/accounts` | `AssetsHubLayout` |
| `/office-assets` | `OfficeAssetsPage` |
| `/features` | `FeaturesPage` |
| `/workflows` | `WorkflowCanvas` |
| `/admin` | `AdminCRM` / `DataHubPage` |
| `/admin/control` | `AdminPanel` |
| `/admin/qa` | `QATestingPage` |
| `/admin/users` | `AdminUsers` |
| `/admin/teams` | `AdminTeamsPage` |
| `/admin/exly-campaigns` | `ExlyCampaignsPage` |
| `/admin/scripts` | `AdminScriptsPage` |
| `/admin/gamification` | `AdminGamification` |
| `/admin/project-analytics` | `AdminProjectAnalyticsPage` |
| `/admin/artist-path` | `ArtistPathPage` |
| `/campaign/:campaignId` | `CampaignDetails` |
| `/emails/*` | `EmailHubLayout` (overview, campaigns, templates, profiles, analytics, newsletter) |
| `/emails/create` | `CreateCampaignPage` |
| `/artists/:id/*` | `ArtistDetail` |
| `/components` | `ComponentsShowcase` (dev) |

### Legacy redirects

`/leads` → `/crm`, `/finance` → `/management`, `/chat` → `/dashboard`, `/data-hub` → `/admin`, etc.

### Component folders (24)

| Folder | Contents |
| --- | --- |
| `admin/` | Mail studio, analytics, departments, Exly, lead audits, monthly reports, ops terminal |
| `artistPath/` | Artist Path questionnaire UI, profile slider |
| `artists/` | Artist detail, connect accounts, platform summaries |
| `assets/` | Assets hub sidebar |
| `attendance/` | Time cards, grid, prompt modal, team mobile list |
| `auth/` | Force password change, install guide |
| `brand/` | **LOCKED** logo + spinner |
| `crm/` | CRM-specific widgets |
| `dashboard/` | Widgets: todos, calendar, pinboard, leaderboard, leave, reimbursements |
| `dataHub/` | Person detail panel |
| `dev/` | Agentation (dev-only) |
| `emails/` | Email hub, campaign wizard steps |
| `finance/` | Upload modal, needs-attention |
| `forms/` | Project/member/workspace selects |
| `mentions/` | Mention chips |
| `mobile/` | Mobile route guard |
| `newsletter/` | Send wizard |
| `notes/` | Rich editor |
| `onboarding/` | Product tour |
| `productivity/` | Daily log entry modal |
| `project/` | Goals, KRA, finance, team, analytics |
| `schedule/` | Schedule grid, member rows |
| `tasks/` | Task list, detail modal, activity, completion |
| `ui/` | Design system: modals, charts, DataTable, layouts, primitives |

### Shell components

`MainLayout`, `ProtectedRoute`, `PageRoute`, `CommandPalette`, `BottomNavigation`, `OutletSidebar`, `QuickAddMenu`, `HelpBugButton`, `OnboardingTour`, `PwaInstallBanner`, `NotificationBridge`

### Settings tabs

Profile, Security (sessions), Leave, Reimbursement, Invoice, Dashboard customization, Sidebar customization, Shortcuts, Departments (admin), Platform roles (admin)

---

## 14. Shared Cross-Package Contracts

**npm workspace:** `@coreknot/contracts` (`shared/contracts/`) — Zod API contracts imported by Express, NestJS, and client during backend migration. Expand exports as domains port off `server/validation/`.

| File | Purpose |
| --- | --- |
| `artistCrmSheetMappings.js` | HolySheet column mappings for artist CRM |
| `artistCrmTaxonomy.js` | Artist CRM field taxonomy |
| `artistPathSchema.js` / `.cjs` | Artist Path questionnaire schema |
| `attendanceExcludedUsers.js` | Roster exclusions |
| `attendanceMetrics.js` | Worked / lunch / unlogged minutes |
| `attendanceRosterVisibility.js` | Team roster visibility rules |
| `dataInlets.js` | Data Hub inlet taxonomy |
| `dateValidation.js` | IST date guards, no-past-date |
| `defaultPassword.js` | Org default password constant |
| `emailBlockSpacing.cjs` | WYSIWYG email block spacing |
| `gamificationRules.js` | XP caps, overtime, attendance bonus |
| `mailTemplateApprovers.js` | Template approver allowlist |
| `mentionTokens.js` | @user / #asset parsing |
| `monthlyReportTimeframe.js` | Monthly report ranges |
| `platformRoleDefinitions.js` | Platform role UI defs |
| `platformUserIds.js` | Platform user ID fallbacks |
| `projectRoles.js` | Project role hierarchy |
| `qaExcludedUsers.js` | QA test user exclusion |
| `reportRange.js` | Report date helpers |
| `rootAdminEmails.js` | Protected root admin emails |
| `scheduleTaskDates.js` | Schedule date anchoring |
| `shortcutDefaults.cjs` | Default keyboard shortcuts |
| `sourceClassifier.js` | Classify source → Data Hub inlet |
| `systemLogContract.js` | Log severity, modules, toast contract |
| `taskPriorityDates.js` | Priority → due-date span |
| `taskReviewRules.js` | Review/approve/rollback rules |
| `timeSpent.js` | Time logging math |

---

## 15. Feature Modules (Deep Dive)

### 15.1 Projects & Workspaces

- CRUD projects, members, roles, workload, hours, analytics
- Workspace colors (admin), access filtering (v1.9.6)
- Project goals/KRA with snapshot history
- `PATCH /api/projects/:id/members/:userId/role`
- Optimistic concurrency via `__v` on project updates

### 15.2 Tasks & Review Workflow

- Task types, priorities, due dates, schedule dates
- Assignees via `TaskAssignment` join — creator on `task.createdBy` only
- Status flow: `todo` → `in-progress` → `in-review` → `done`
- Activity timeline: created, assignment, message, status_change, field_change
- @mentions with unread receipts
- Bug report FAB → `POST /api/tasks/bug` → Tech Stack project
- Completed tasks hidden after 2 days in list (`taskListFilter.js`)

### 15.3 CRM & Leads

- Lead CRUD, follow-ups, EMIs, audit logs, stats
- Strict phone validation (`phoneCountryValidation.js`, `PhoneNumberFields.jsx`)
- Lead phone repair for legacy `-DUP-{id}` corrupt phones
- Booked calls via website webhook (2:1:1 rep split)
- Artist CRM (`crmType: artist`) — 6-sheet CSV import
- Booking enquiries from `/query` webhook → Akash assignee

### 15.4 Data Hub

- Admin at `/admin` (`DataHubPage.jsx`)
- Inlets: Exly, Leads, TSC/HolySheet, Booked Calls, Enquiries, Mail, Community, Artist Path, Newsletter, Outsourced
- `DataHubService.syncAllInlets()` merges into unified graph
- Person detail drawer with lazy sections
- Scripts: `reconcileDataHub.js`, `syncDataHubToProd.js`

### 15.5 Data Master (Person spine)

- `Person` golden record + `PersonIdentifier` + `PersonHubView`
- Source facts stay in domain collections (Lead, ExlyBooking, ArtistPathResponse, etc.)
- Bootstrap: `backfillPersonIds.js`
- Spec: `docs/DATA_MASTER_ARCHITECTURE.md`

### 15.6 Email & Campaigns

- Email hub at `/emails/*` (replaces legacy AdminMail monolith)
- `MailTemplateStudio` — draft → submit → approve workflow
- `CampaignWizardShell` + Zod validation
- HolySheet contact sync, indexed merge tokens (`{{1}}`, `{{2}}`)
- Outbound pipeline: `buildFinalEmailHtml.js` + `normalizeOutboundEmailHtml.js`
- Campaign detail at `/campaign/:campaignId`
- **Registered location breakdown** — CRM city attribution (not IP geo)
- Aggregate analytics at `/emails` analytics tab

### 15.7 Newsletter

- Issues, articles, curate, compile, preview, audience-preview, send
- Routes: `/api/newsletter/*`

### 15.8 Finance

- Document upload (UploadThing), OCR extraction, folder hierarchy
- Invoice/reimbursement submission + ops approval queue
- USD/INR live rate sync
- Pending approval: `GET /api/finance/pending`

### 15.9 Attendance

- Manual Office/WFH toggle (`WorkModeToggle.jsx`)
- `POST /api/attendance/check` with `workMode`, `verificationMethod: MANUAL`
- Worked vs daily-log metrics (`shared/attendanceMetrics.js`)
- Leave requests with ops approval
- Checkout reminder cron 6:30 PM IST
- Excluded users: `shared/attendanceExcludedUsers.js`

### 15.10 Gamification

- XP from task completion, daily logs, attendance
- Time-based cap: 12h per event; daily log 8h base + 1.5× overtime
- Weekly reset Monday 00:00 IST
- Leaderboard breakdown modal, XP gap to next rank
- Admin config at `/admin/gamification`

### 15.11 Artists & Artist Path

- Artist detail with Spotify/YouTube/Meta connections
- Artist Path admin at `/admin/artist-path` — HolySheet sync, card grid, profile slider
- Shared schema: `shared/artistPathSchema.cjs`
- Artist enquiry webhook → task + CRM lead

### 15.12 Notifications & Inbox

- Tri-channel: in-app, email, Web Push
- Categories: task, crm, attendance, announcement, department, review, system
- Inbox: mark all read, clear all (`DELETE /api/notifications`)
- Status counts API for nav badges
- Deep links via `actionUrl` + `FlashHighlight`

### 15.13 Dashboard

- Three-column layout, customizable widget grid
- Named layout library (Settings → Dashboard customization)
- Widgets: todos, calendar, pinboard, notes, schedule, leaderboard, leave, reimbursements, backup, dept-stats, attendance overview
- Per-widget lazy loading (`dashboardWidgetLoaders.js`)

### 15.14 Schedule & Calendar

- Team schedule grid at `/schedule`
- Calendar with musical_day public events (35 seeded from PDF)
- Past-date guard (client + server)

### 15.15 Assets & Org Accounts

- `/assets` file links, `/assets/accounts` managed credentials
- Google Sheet import for org accounts
- Roles: admin, artist-management, operations

### 15.16 Subscriptions

- Office SaaS tracking at `/office/subscriptions`
- Multi-assignee `usedBy` array
- Daily reminder cron

### 15.17 Onboarding & PWA

- First-login tour (24 desktop / 13 mobile steps)
- Install guide on login page
- PWA icons from `brand-mark.svg` via `generate-pwa-icons.mjs`
- Service worker: `client/src/sw.js`

### 15.18 Admin tooling

- QA Testing at `/admin/qa` (209+ cases)
- Script runner at `/admin/scripts` (31 whitelisted scripts)
- System logs at `/management/ops-logs`
- Platform roles panel

### 15.19 Search & Command Palette

- Unified search: `GET /api/search`
- Command palette: `Cmd/Ctrl+K`
- Keyboard shortcuts: `?`, `G` chords, `/`

---

## 16. Email Engine (LOCKED)

> **Do not modify** unless user explicitly unlocks. Full spec: `docs/EMAIL_ENGINE_LOCKED.md`

### Locked files

- `server/utils/trackingUrls.js`, `emailTracker.js`, `geoLookup.js`
- `server/routes/track.js`
- `server/routes/campaignRoutes.js` (geo breakdown, displayCity, MailEvent queries)
- `server/models/MailEvent.js`, `MailTemplate.js` (format field)
- `client/src/pages/CampaignDetails.jsx` (activity stream geo + timestamp)
- `client/src/utils/mailEventLocation.js`
- HolySheet deselect-on-load in `AdminMailContent.jsx`

### Locked behavior

1. **Opens:** Gmail proxy IPs blocked for geo; city inferred from same recipient's click
2. **Clicks:** Real IP → geoip-lite → ip-api.com fallback; city only, no country codes
3. **No hardcoded cities** (no Mumbai fallback)
4. **Tracking base URL:** from `TRACKING_BASE_URL` / production hosts local JSON
5. **Open pixel:** before `</body>`, visible 1×1, no `display:none`
6. **HolySheet:** all tabs deselected on fetch
7. **Activity stream:** `MMM dd, yyyy · HH:mm:ss` + `@ city` from `displayCity`

### CRM location breakdown (separate from locked geo)

- Charts use **registered CRM city** — not IP geo
- `server/utils/campaignRegisteredLocation.js`
- Sources: `Lead.location` / `Lead.city`, `PersonIndex.city` fallback
- UI: `RegisteredLocationBarChart` on campaign detail + aggregate analytics
- Rebuild: `node server/scripts/rebuildCampaignLocationBreakdown.js <id> [--prod]`
- Resend backfill: `node server/scripts/backfillCampaignFromResend.js <id> [--prod]`

### Email block spacing (WYSIWYG)

- `shared/emailBlockSpacing.cjs` + `client/src/utils/emailBlockSpacing.js`
- Option C block spacing for mail template studio

---

## 17. Supabase Secondary Store

MongoDB remains **primary**. Supabase Postgres is an **optional secondary mirror**.

### Purpose

Mirror logs, audits, backup snapshots, mail analytics rollups for long-term storage and analytics without bloating MongoDB.

### Key files

| Path | Role |
| --- | --- |
| `server/config/supabase.js` | Config, `isSupabaseEnabled()` |
| `server/supabase/schema.sql` | Postgres schema |
| `server/services/supabase/registerMirrors.js` | Mongoose post-save hooks |
| `server/services/supabase/syncService.js` | Batch sync logic |
| `server/services/supabase/logStore.js` | Log inserts |
| `server/services/supabase/backupStore.js` | Backup snapshots |
| `server/services/supabase/snapshotStore.js` | CRM snapshots |
| `server/services/supabase/mailRollupStore.js` | Mail rollups |
| `server/services/supabase/batchInsert.js` | Bulk insert helper |
| `server/services/supabase/migrate.js` | Migration runner |
| `server/services/supabase/fastMigrate.js` | Fast migration |
| `server/workers/supabaseSyncWorker.js` | Background sync worker |
| `server/routes/supabaseAdminRoutes.js` | `GET /api/admin/supabase/health` |

### CLI scripts

```bash
npm run supabase:setup --prefix server
npm run supabase:health --prefix server
npm run supabase:backfill --prefix server
npm run supabase:migrate --prefix server
```

### Env toggle

`SUPABASE_SECONDARY_ENABLED=true` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

---

## 18. Background Jobs, Cron & Webhooks

### BullMQ queues

- Webhook processing (`webhookWorker.js`)
- Import jobs (`importWorker.js`)
- Artist enquiry (`artist-enquiry` job)
- Gamification awards (QA mode: `QA_SYNC_GAMIFICATION`)
- Campaign dispatch

### Cron jobs (notificationService + Render)

| Schedule | Job | Purpose |
| --- | --- | --- |
| `30 18 * * *` IST | Attendance checkout reminder | Users without check-out |
| Follow-up cache | CRM call reminders | ~30 min before follow-ups |
| Monday 00:00 IST | XP weekly reset | Leaderboard |
| Render cron | `runDailyBackup.js` | MongoDB → GridFS backup |
| Render cron | `runSubscriptionReminders.js` | SaaS due-date emails |
| Render cron | `keepWarm.js` | Prevent API spin-down |

### Webhook ingress (`/api/webhooks`)

| Path | Source | Auth |
| --- | --- | --- |
| `/book-call` | TSC website | `X-Webhook-Secret` HMAC |
| `/artist-enquiry` | TSC `/query` form | HMAC |
| `/artist-path` | Artist Path sync | Auth |
| `/newsletter` | Newsletter events | Auth |
| `/masterclass-review` | Masterclass form | Auth |
| `/meta-data-deletion` | Meta | `signed_request` |
| `/instagram` | Meta Instagram | Signature |
| `/resend` | Resend events | Auth |

### Tracking routes (`/api/track` + root)

- `GET /open/:pixelId.gif` — open pixel
- `GET /click/:clickId` — click redirect
- `GET /unsubscribe` — unsubscribe page
- `POST /webhooks/resend` — Resend webhook
- `POST /api/crm/unsubscribe` — CRM unsubscribe dual-write

---

## 19. External Integrations

| Service | Purpose | Key files |
| --- | --- | --- |
| **Resend** | Campaign email dispatch | `mailDriver.js`, `emailProcessor.js` |
| **Gmail SMTP** | Password reset, system mail | `sendSystemEmail.js` |
| **Google OAuth** | Staff login | `authController.js`, `oauthEnv.js` |
| **Google Calendar/Drive** | Calendar sync, drive files | `googleController.js`, `googleRoutes.js` |
| **Meta/Instagram** | Artist connect, data deletion | `artistRoutes.js`, `metaDataDeletionController.js` |
| **Spotify** | Artist stats | `spotifyTokenManager.js` |
| **YouTube** | Artist stats | `artistController.js` |
| **Exly** | Course bookings/offerings | `exlyService.js`, `exlyRoutes.js` |
| **HolySheet** | Contact sync for mail | `holySheetService.js` |
| **UploadThing** | Finance file uploads | `uploadthing.js` |
| **AiSensy** | WhatsApp booked-call alerts | Webhook handlers |
| **Trigger.dev** | Long-running jobs | `triggerService.js` |
| **TSC Website** | Book-call, artist enquiry forward | `webhookController.js` |

---

## 20. Testing & QA

### Test commands

| Command | Scope |
| --- | --- |
| `npm test` | Server Jest (194+ cases) |
| `npm test --prefix client` | Client Vitest |
| `npm run test:e2e:public` | Playwright public smoke |
| `npm run test:e2e:auth` | Playwright auth flows |
| `npm run ci` | Exposure audit + server tests + client lint/test/build |
| `npm run audit:exposure` | Pre-commit secret scan |
| `npm run audit:deadcode` | Orphan module scan |
| `npm run audit:history` | Git history needle scan |
| `npm run preflight` | Env validation before dev |

### Server test files (39)

`auth.test.js`, `authSession.test.js`, `authMobileLogin.test.js`, `authRegisterPassword.test.js`, `api.integration.test.js`, `emailFlow.integration.test.js`, `trackingUrls.test.js`, `campaignRegisteredLocation.test.js`, `newsletter.test.js`, `crmScope.test.js`, `crmPipelineFilters.test.js`, `attendanceXp.test.js`, `attendanceMetrics.test.js`, `attendanceLeaveApproval.test.js`, `gamificationService.test.js`, `taskReview.test.js`, `taskActivity.test.js`, `taskListFilter.test.js`, `taskPriorityDates.test.js`, `todoQueryBuilder.test.js`, `scheduleTaskDates.test.js`, `scheduleLayout.test.js`, `timeSpent.test.js`, `dateValidation.test.js`, `validation.test.js`, `personNormalization.test.js`, `leadPhoneRepair.test.js`, `artistCrmImport.test.js`, `artistBookingWebhook.test.js`, `mailTemplateApprovers.test.js`, `tokenRevocation.test.js`, `sessionRegistry.test.js`, `sessionRequestMeta.test.js`, `preflightEnv.test.js`, `qaPreDeploymentChecklist.test.js`, `ciSmoke.test.js`, `lighthouseBaseUrl.test.js`, `supabaseSecondary.test.js`

### E2E specs

`smoke.spec.js`, `auth-flows.spec.js`, `mobile-login.spec.js`, `todo.spec.js`, `crm.spec.js`

### In-app QA (Admin → QA Testing)

- 209+ pre-deployment cases
- Suites: static checklist, security live probes, integration (45), page AST scans, Lighthouse
- Purge QA test data with pattern matching
- Socket.IO realtime progress updates

### CI test setup

- MongoDB Memory Server — no local `mongod` required
- `NODE_ENV=test` skips startup `mongoose.connect`
- `server/tests/setup.js` wires in-memory URI

---

## 21. CI/CD & Build Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

| Job | Steps |
| --- | --- |
| `server-test` | `npm run audit:exposure` + Jest with coverage |
| `client-check` | ESLint + Vitest + production build |
| `lighthouse-public` | a11y ≥ 90 gate |
| `e2e-public` | Playwright public smoke |
| `e2e-auth` | Playwright auth (secrets: `E2E_EMAIL`, `E2E_PASSWORD`) |

### Deploy (`.github/workflows/deploy-render.yml`)

- After CI on `main` → POST Render deploy hooks

### Client build pipeline

1. `generateVercelConfig.js` — API proxy URLs
2. `generate-pwa-icons.mjs` — rasterize brand-mark.svg
3. `vite build` — code-split chunks (framer-motion, socket.io, xyflow, mermaid)
4. PWA injectManifest → `sw.js`

### Husky pre-commit

- Exposure audit hook

---

## 22. Scripts & Maintenance Catalog

### Root npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Server + client concurrently |
| `npm run build` | Client production build |
| `npm run ci` | Full CI locally |
| `npm run verify:mobile-proxy` | Check Vercel API proxy health |
| `npm run datahub:compare` | Compare Data Hub DBs |
| `npm run datahub:push-prod` | Sync Data Hub to prod |
| `npm run org-accounts:import` | Import org accounts from sheet |
| `npm run artist-crm:bulk` | Bulk push artist CRM |

### Server npm scripts (highlights)

| Script | Purpose |
| --- | --- |
| `sync-db` | `syncProdToLocal.js --yes` |
| `backup:daily` | Production DB backup |
| `repair:lead-phones` | Fix corrupt phone suffixes |
| `qa:audit` / `qa:cleanup` | QA data audit and purge |
| `render:ops-fix` | Set ENCRYPTION_KEY + Redis noeviction |
| `supabase:*` | Supabase setup/health/backfill/migrate |
| `reset-weak-passwords:*` | Org password rotation |
| `seed:music-calendar` | Calendar musical days |

### Admin Script Runner (31 whitelisted)

Categories: QA, backup, data repair, finance, audits. Catalog: `server/config/adminScriptsCatalog.js`. Runbook: `docs/SCRIPTS_RUNBOOK.md`.

### Script safety tiers

| Tier | Meaning |
| --- | --- |
| **Safe** | Read-only or idempotent local |
| **Caution** | Modifies data — review output |
| **Danger** | Production impact — explicit `--yes` / `--prod` flags |

---

## 23. Observability & Diagnostics

### SystemHealthService

- Probes MongoDB + Redis connectivity
- Returns HTTP 503 maintenance mode when dependencies down

### System Logs

- Unified `SystemLog` model
- Ops page: `/management/ops-logs`
- Trace middleware propagates correlation IDs
- Contract: `shared/systemLogContract.js`
- Client bridge: `client/src/lib/systemLogBridge.js`

### Sentry + Datadog

- Wired in code (`@sentry/node`, `@sentry/react`, `dd-trace`, `@datadog/browser-rum`)
- Often **unset** in production env — use SystemLog until configured
- Templates: `docs/SENTRY_ALERTS.md`, `docs/MONITORING_ALERTS.md`, `docs/datadog/`

### Lighthouse auditing

```bash
cd client
npm run lighthouse          # All routes
npm run lighthouse:public   # Public only
npm run lighthouse:prod     # Against preview build
```

Reports: `client/lighthouse-reports/` (gitignored)

---

## 24. Critical Business Rules

### Task governance

- Creator ≠ assignee (since v1.9.13 migration)
- Assignees submit → `in-review`; creator/platform owner approves
- Rollback removes both TASK_COMPLETION and TASK_REVIEW daily logs
- Bug tasks auto-assign platform owner on Tech Stack project

### Attendance math

- **Worked** = check-in → check-out duration
- **Expected log** = worked − 60 min lunch
- **Not logged** = max(0, expected − all DAILY_LOG minutes)
- Refresh on fetch, log CRUD, task completion

### CRM phones

- Strict per-country digit validation — no silent truncation
- E.164 normalization server-side
- Auto-repair legacy `-DUP-{objectId}` suffixes on save
- Duplicate phone → HTTP 409 (not generic 400)

### Gamification caps

- Time-based actions: max 12h XP per event
- Daily logs: 8h base + 1.5× overtime
- Attendance XP only after ops locks both check-in and check-out
- Weekly reset Monday 00:00 IST

### Registration

- Production: `ALLOWED_DOMAIN` + department `signupAllowed`
- Password strength enforced server-side before domain gate

### Notification policy

- Overdue task alerts **removed** (visual badges remain)
- Follow-up call reminders ~30 min before still active
- Attendance checkout reminder 6:30 PM IST

### Pagination default

- `DEFAULT_TABLE_PAGE_SIZE = 10` across DataTable

---

## 25. Locked Zones — Do Not Modify

| Zone | Rule file | Doc |
| --- | --- | --- |
| **Production hosts** | `.cursor/rules/production-hosts-locked.mdc` | `.cursor/production-hosts.local.json` |
| **Email engine** | `.cursor/rules/email-engine-locked.mdc` | `docs/EMAIL_ENGINE_LOCKED.md` |
| **Logo & spinner** | `.cursor/rules/logo-mark-locked.mdc` | `docs/LOGO_LOCKED.md` |
| **Legacy APIs** | — | `docs/LEGACY_FREEZE.md` |

### Pre-change audits (required)

```bash
npm run audit:exposure    # Before every commit
npm run audit:deadcode    # Before push
npm run preflight         # Before dev
```

---

## 26. UI/UX Conventions

### Design language (Subtractive Slate)

- Shell: `#0f172a`, cards: `#1e293b`
- Brand green: `#126d5e`, accent teal: `#2dd4bf`
- Geist variable font
- Minimal borders, no heavy shadows on static surfaces

### List page kit

`ListPageLayout`, `PageToolbar`, `DataOverviewSection`, `DataMiniChart`, `MobileFilterSheet`, `MobilePageHeader`, `ListCard`, `FilterChips`, `DataTable`, `TablePagination`

### Modal conventions

- Use `confirmContext` — no `window.alert`
- `NexusModal` for dialogs
- Unsaved changes: global bar or inline Discard/Save

### Standards doc

`docs/COMPONENT_STANDARDS.md`

### Marketing pages

- Home, Privacy, User Data Deletion use theme tokens + `MarketingThemeToggle`

---

## 27. Documentation Index

| Document | Purpose |
| --- | --- |
| `docs/DOCUMENTATION_INDEX.md` | Master index |
| `docs/AI_AGENT_PROJECT_CONTEXT.md` | Long agent reference |
| `docs/ENVIRONMENT_MATRIX.md` | Hosts, DBs per environment |
| `docs/STARTUP_GUIDE.md` | Local bootstrap |
| `docs/LOCAL_DEV_DATABASE.md` | Mongo isolation |
| `docs/DEPLOY_ENV.md` | Render/Vercel secrets checklist |
| `docs/DEPLOY_ROLLBACK.md` | Rollback procedures |
| `docs/PRODUCTION_MIGRATION.md` | Production migration (legacy Mongo scripts) |
| `docs/BACKEND_MIGRATION_PLAYBOOK.md` | NestJS + Prisma + Supabase strangler playbook |
| `docs/STAGING_SETUP.md` | Staging environment |
| `docs/SECURITY.md` | Auth, webhooks, CORS |
| `docs/GIT_HISTORY_REDACTION.md` | History rewrite runbook |
| `docs/EMAIL_ENGINE_LOCKED.md` | Email tracking spec |
| `docs/LOGO_LOCKED.md` | Logo/spinner spec |
| `docs/DATA_MASTER_ARCHITECTURE.md` | Person spine |
| `docs/DATA_SANITATION_SPEC.md` | Person normalization |
| `docs/DATA_BACKUP.md` | Backup procedures |
| `docs/SCRIPTS_RUNBOOK.md` | Script safety |
| `docs/COMPONENT_STANDARDS.md` | UI conventions |
| `docs/BOOKED_CALLS_CRM_DIRECT.md` | Book-call webhook flow |
| `docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md` | Artist enquiry wiring |
| `docs/TSC_TASKMASTER_INTEGRATION.md` | TSC website integration |
| `docs/GOOGLE_META_APP_VERIFICATION.md` | OAuth app review |
| `docs/INTEGRATION_DATA_CATALOG.md` | Integration data map |
| `docs/IMPROVEMENT_ROADMAP.md` | Phased backlog |
| `docs/UX_ARCHITECTURE_1.0.0_ROADMAP.md` | UX acceptance criteria |
| `docs/VERSION_HISTORY.md` | Release notes |
| `docs/ARCHITECTURE_DEBT.md` | Known debt |
| `docs/LEGACY_FREEZE.md` | Frozen legacy APIs |
| `docs/LINT_DEBT.md` | ESLint debt |
| `docs/MONITORING_ALERTS.md` | Monitoring setup |
| `docs/SENTRY_ALERTS.md` | Sentry config |
| `docs/GLOBAL_SCALE.md` | Scale considerations |
| `docs/transaction_architecture.md` | DB transactions |
| `docs/TENANT_SECURITY_PHASE.md` | Tenant security |
| `CONTRIBUTING.md` | PR checklist |

---

## 28. Recent Changes & In-Flight Work

### v1.0.7 (current)

- Unified same-origin `/api` on every device
- Login gated on `/api/auth/me`
- `/socket.io` Vercel rewrite
- Local dev always uses Vite proxy

### v1.0.4–v1.0.6 highlights

- Git history redaction completed (`main` + `testing`)
- Production hosts locked in `.cursor/production-hosts.local.json`
- Zod validation on major routes
- Onboarding tour (24 desktop / 13 mobile steps)
- E2E Playwright smoke + auth specs
- Mail Template Studio + approver workflow
- Task creator/assignee split
- Frontend performance (Lighthouse, lazy dashboard widgets)
- Google OAuth ticket flow
- Self-service password reset
- Manual Office/WFH attendance
- PWA icon generation pipeline
- Admin script runner whitelist

### Jun 2026 — CRM registered location breakdown

- Campaign + aggregate analytics attribute opens/clicks to **CRM city** (not IP geo)
- `server/utils/campaignRegisteredLocation.js`
- `RegisteredLocationBarChart` component
- Rebuild scripts for post-Resend backfill

### In-flight (uncommitted work snapshot)

- **Backend migration (Strangler Fig):** `nestjs-server/` sandbox scaffolded; Phases 0–6 per `docs/BACKEND_MIGRATION_PLAYBOOK.md` — Prisma schema, ETL, attendance tracer bullet, mail tracking cutover, final QA
- Express domain extraction (`server/domains/`, `server/app/`) — boot + Jest cleanup in progress
- Supabase secondary store expansion (sync worker, fast migrate, health routes)
- Email block spacing (`shared/emailBlockSpacing.cjs`)
- Visual email HTML tests (`visualEmailHtml.test.js`)
- Local notification store (`localNotificationStore.js`)
- Render deploy workflow (`.github/workflows/deploy-render.yml`)
- Campaign registered location tests
- Atlas storage cleanup scripts

**Full changelog:** [`changelog/recent-changes.md`](changelog/recent-changes.md) + `docs/VERSION_HISTORY.md`

---

## 29. Related Memory Files

| File | When to read |
| --- | --- |
| [`INDEX.md`](INDEX.md) | **Start here** — navigation to all component docs |
| [`MASTER.md`](MASTER.md) | **This file** — complete project context |
| [`platform/overview.md`](platform/overview.md) | Quick product + stack summary |
| [`architecture/data.md`](architecture/data.md) | Supabase, backups, email analytics |
| [`operations/conventions.md`](operations/conventions.md) | Audits + locked area reminders |
| [`changelog/recent-changes.md`](changelog/recent-changes.md) | Latest session delta |

---

## 30. Backend Migration (NestJS + Prisma + Supabase)

> **Goal:** Migrate from Express + MongoDB to a strict **Modular Monolith** on NestJS + Prisma + Supabase PostgreSQL using the **Strangler Fig** pattern — no big-bang rewrite.  
> **Playbook:** `docs/BACKEND_MIGRATION_PLAYBOOK.md` (step-by-step execution manual).

### Old vs new stack

| Layer | Current (legacy) | Target (new) | Why |
| --- | --- | --- | --- |
| **Framework** | Express.js (`server/`) | **NestJS** (`nestjs-server/`) | Enforces `domains/` module boundaries via DI; prevents cross-domain spaghetti imports |
| **Database** | MongoDB Atlas (primary) + Supabase Postgres (secondary mirror) | **Supabase PostgreSQL** (primary & only) | Relational model fits multi-tenant CRM, attendance, finance; reuse existing Supabase wiring |
| **ORM** | Mongoose | **Prisma** | Type-safe queries, schema migrations, shared TypeScript types |
| **Queues / workers** | BullMQ + `server/workers/*.js` | **@nestjs/bullmq** `@Processor()` classes | Queue consumers live inside domain modules |
| **Real-time** | Socket.IO on Express | **NestJS WebSockets** (Gateways) | Same transport, tenant-aware gateways |
| **Hosting** | Render (Express API + Redis) | Render (compiled NestJS + same Redis) | No provider change; new Render web service for NestJS during transition |
| **Validation** | `server/validation/` Zod | **`@coreknot/contracts`** (`shared/contracts/`) | Identical payloads validated on both backends during cutover |

### Monorepo layout (dual backend)

```
Taskmaster/
├── server/                 # Legacy Express — production today (port 5000)
│   ├── app/                # createApp, registerRoutes, startServer, cors, rateLimits
│   ├── domains/            # Extracted domain modules (crm, mail, tasks, …)
│   ├── models/             # @deprecated Mongoose shims → domains/*/models
│   ├── routes/             # @deprecated route shims → domains/*/routes
│   └── workers/            # BullMQ workers (until ported to NestJS)
├── nestjs-server/          # New NestJS modular monolith (port 5001)
│   ├── prisma/schema.prisma
│   └── src/
│       ├── infrastructure/ # Config, Prisma, Auth, BullMQ, exception filter
│       └── domains/        # attendance, gamification, mail, … (ported incrementally)
└── shared/contracts/       # @coreknot/contracts — Zod schemas shared by both backends
```

**npm workspaces:** `client`, `server`, `nestjs-server`, `shared/contracts` (root `package.json`).

### Strangler Fig phases (0–6)

| Phase | Name | Summary |
| --- | --- | --- |
| **0** | Monorepo sandbox | Scaffold `nestjs-server/` (port 5001), wire `@coreknot/contracts`, Vite proxy template for per-route cutover |
| **1** | Database design | Survey Mongoose models → `prisma/schema.prisma` (PostgreSQL); flatten nested arrays; Person spine FKs; `tenantId` on all scoped tables |
| **2** | Core infrastructure | ConfigModule, PrismaModule + tenant extension, AuthGuard, GlobalExceptionFilter, BullMQModule — parity with `server/app/` + `authMiddleware.js` |
| **3** | ETL data bridge | Mongo → Postgres sync script (cursor batches, topological insert order); staging count validation |
| **4** | Route-by-route replacement | Port one domain at a time; auth bridge (read-only JWT); continuous sync cron; Vercel/Vite proxy flips per route prefix |
| **5** | High-risk async | Email tracking pixels (`/open`, `/click`), Resend webhooks — accept fast, queue, process in background; **email engine logic LOCKED** (`docs/EMAIL_ENGINE_LOCKED.md`) |
| **6** | QA & final cutover | Shadow JSON compare, Playwright E2E against NestJS, maintenance window, final delta ETL, global `/api/*` → NestJS, decommission Express + Mongo |

### Domain migration order

Migrate at the **Vercel/Vite proxy** layer — specific path prefixes to NestJS Render service before the catch-all legacy rule.

| Order | Domains | Rationale |
| --- | --- | --- |
| **1** | **Attendance, Gamification** (+ Notes, Pinboard leaf nodes) | Small boundaries; tracer bullet for auth + Prisma + proxy |
| **2** | **Projects, Tasks, Schedule** | Core workflows; moderate cross-domain reads (served by ETL sync) |
| **3** | **Mail** | Heavy webhooks + BullMQ; port queues with domain; tracking behavior must match locked spec |
| **4** | **CRM, Data Hub** | Person spine, large services — split into NestJS sub-modules; 80% traffic already on NestJS |
| **5** | **Auth** (last) | Login, register, OAuth, session sliding — port only after all other routes moved; then strangle Express root |

### Prisma ID strategy (Mongo ObjectId preserved)

- **Do not generate new UUIDs** for migrated records — breaks `/projects/:id`, bookmarks, frontend state.
- Prisma: `id String @id` on all entity tables; insert legacy Mongo `_id` hex strings (24-char) directly.
- Foreign keys (`personId`, `tenantId`, `projectId`, …) are also `String` columns holding ObjectId hex.
- Validation: `/^[0-9a-fA-F]{24}$/` where legacy code used `mongoose.Types.ObjectId.isValid`.

### Auth bridge rules (transition)

| Rule | Detail |
| --- | --- |
| **Shared secret** | NestJS `JWT_SECRET` must match Express exactly |
| **Cookie** | Both backends read `coreknot_token_v3` HttpOnly cookie |
| **Read-only NestJS auth** | During transition, NestJS **validates only** — no password reset, no session slide, no cookie mutation |
| **Auth mutations** | Express handles login, register, logout, OAuth, session revoke until Phase 4.7 / final auth port |
| **Context** | AuthGuard attaches `user` + `tenantId` to request (same as `authMiddleware.js`) |
| **Sliding session** | 7-day inactivity, 30-day absolute max, 60-min refresh throttle — Express owns writes until cutover |

### Vercel proxy pattern (production)

Use placeholders from `.cursor/production-hosts.local.example.json` — never hardcode legacy hosts.

**Local dev (`client/vite.config.js`):** default `/api` → `localhost:5000`; uncomment `/api/attendance` → `localhost:5001` when NestJS owns attendance.

**Production (`client/vercel.json` or generated config):** domain-specific rewrites **above** the catch-all:

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

Add one rewrite block per migrated domain (`/api/gamification`, `/api/projects`, …). Final state: single rewrite of `/api/:match*` → NestJS only.

**Cross-domain reads during migration:** run Mongo→Postgres ETL on a tight cron (e.g. every 1 min) so NestJS reads User/Department data from its own Postgres copy — avoid HTTP calls between Express and NestJS.

### Locked zones during migration

| Zone | Rule |
| --- | --- |
| **Email engine** | `docs/EMAIL_ENGINE_LOCKED.md` — tracking URLs, geo, open pixel, HolySheet defaults unchanged; port verbatim |
| **Production hosts** | `.cursor/production-hosts.local.json` — use `YOUR-PRODUCTION-API` / `YOUR-NESTJS-API` placeholders in docs; never `CoreKnot-jfw0.onrender.com` |
| **Logo / spinner** | `docs/LOGO_LOCKED.md` — frontend unchanged |

### ETL insert order (FK safety)

1. **Tier 1:** Tenants, Users, Departments, PlatformSettings  
2. **Tier 2:** Projects, Persons, Teams, Workspaces  
3. **Tier 3:** Tasks, Leads, ExlyBookings, Attendance, Gamification  
4. **Tier 4:** TaskActivity, MailEvents, Notifications, CRM audits  

Batch size: 500 documents per `createMany`; use Mongoose cursors — never load full collections into memory.

### Verification gates (Phase 6)

- `cd server && npm test` — legacy domain structure green
- `cd nestjs-server && npm run build && npx prisma validate`
- Root `npm run typecheck` — `@coreknot/contracts` resolves
- NestJS `GET /api/health` → 200 on port 5001
- Playwright smoke + auth flows against proxied NestJS routes
- Shadow-run: mirror production GETs to NestJS, diff JSON responses

---

*CoreKnot / Taskmaster — compiled for agent and developer context. Update this file when major architecture shifts occur. Do not store secrets here.*
