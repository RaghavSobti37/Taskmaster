# CoreKnot Production Failure Audit

**Date:** 01/07/2026  
**Scope:** Full read-only audit — deployments, CI/CD, tests, infrastructure, every routed page/subpage, integrations, and ops. **No code was changed** during this audit.  
**Method:** Live production probes (`curl`), local verification runs (`npm test`, `npm run build`, `npm run ci`, `production:readiness`, `migration:readiness`), codebase grep, route inventory, and cross-check against existing backlog docs (`FULL_APP_REVIEW_BACKLOG.md`, `weakness_report.md`, `TENANT_SECURITY_PHASE.md`).

---

## Executive summary

Production is **partially up** but **operationally degraded**. The API responds `200` on `/api/health`, MongoDB and UploadThing are connected, and all three frontend hosts (`tsccoreknot.com`, `auth.tsccoreknot.com`, `landing.tsccoreknot.com`) return `200`. However:

| Severity | Finding | Impact |
|----------|---------|--------|
| **P0** | **Redis unavailable on production API** (`redis.ok: false`) | BullMQ queues, distributed locks, token revocation, Resend rate gate, and idempotency fall back to **in-memory** — jobs lost on restart, broken multi-instance behavior, unreliable email/CRM background work |
| **P0** | **Canonical API hostname chaos** (`taskmaster-jfw0` vs `CoreKnot-jfw0` vs `YOUR-PRODUCTION-API`) | Wrong env/docs → broken OAuth, tracking pixels, mobile `/api` proxy, deploy scripts |
| **P0** | **`preflightEnv.js` marks live host `taskmaster-jfw0` as RETIRED** while `vercel.json` proxies to it | Local preflight/deploy checks fail or contradict production; engineers misconfigure `SERVER_URL` |
| **P1** | **NestJS staging Postgres disconnected**; Nest build/Prisma validate fail locally | Staging strangler path broken; `migration:readiness` exits 1 |
| **P1** | **Render Blueprint URL placeholders** (`YOUR-PRODUCTION-API`) | Blueprint redeploy can wipe real `TRACKING_BASE_URL` / `FRONTEND_URL` |
| **P1** | **Cron jobs in blueprint likely unprovisioned** | Daily backup + subscription reminders not running automatically |
| **P1** | **Root `npm run ci` fails** (TypeScript) | Full monorepo CI gate not green |
| **P2** | **npm audit broken** (`Unable to resolve reference $@opentelemetry/core`) | Dependency audit in CI is unreliable |
| **P2** | **Authenticated E2E skipped** without GitHub secrets | Core user paths untested in CI |
| **P2** | **~31 Mongoose models without `tenantPlugin`** | Cross-tenant data leak risk before second org |
| **P2** | **Dozens of pages lack `QueryErrorBanner`** | API failures show blank/partial UI on many subpages |

**Bottom line:** The app can load and authenticate, but **background processing, staging migration, deploy safety nets, and large parts of the test/CI pipeline are broken or hollow**. The highest-impact fix is **restore Redis on Render production** and **pick one canonical API hostname** documented everywhere.

---

## 1. Live production probes (01/07/2026)

### 1.1 API health

| Endpoint | HTTP | `ok` | MongoDB | Redis | Supabase | UploadThing | Notes |
|----------|------|------|---------|-------|----------|-------------|-------|
| `https://taskmaster-jfw0.onrender.com/api/health` | 200 | true | connected | **unavailable** | enabled | ready | **Live production API** (uptime ~15 min at probe time) |
| `https://CoreKnot-jfw0.onrender.com/api/health` | — | — | — | — | — | — | **Connection failed** (host does not resolve / retired) |
| `https://tsccoreknot.com/api/health` (Vercel proxy) | 200 | true | connected | **unavailable** | enabled | ready | Same payload as direct API — proxy works |
| `https://coreknot-api-staging.onrender.com/api/health` | 200 | true | connected | **unavailable** | enabled | ready | Staging Express also missing Redis |
| `https://coreknot-nest-staging.onrender.com/api/health` | 200 | true | — | configured | — | — | **`status: STARTING`**, Postgres **disconnected** |

### 1.2 Frontends (multi-site)

| Host | HTTP | Site mode | Routes served |
|------|------|-----------|---------------|
| `https://tsccoreknot.com` | 200 | `app` | Full workspace SPA |
| `https://auth.tsccoreknot.com` | 200 | `auth` | Login, register, OAuth success |
| `https://landing.tsccoreknot.com` | 200 | `landing` | Marketing `/`, legal pages |

### 1.3 WebSocket

| Endpoint | HTTP | Notes |
|----------|------|-------|
| `https://taskmaster-jfw0.onrender.com/socket.io/?EIO=4&transport=polling` | 200 | Socket transport reachable |

Desktop production uses **direct Render origin** for Socket.io (`client/src/utils/apiBase.js` → `getRealtimeOrigin()`). Mobile/PWA uses same-origin Vercel rewrite. If `VITE_API_URL` is wrong on Vercel, realtime features break on desktop.

### 1.4 Protected admin endpoints (unauthenticated)

| Endpoint | Response | Expected |
|----------|----------|----------|
| `GET /api/admin/system-health` | `401 Not authorized` | Correct — requires auth |

---

## 2. P0 — Infrastructure failures

### 2.1 Redis unavailable (production + staging Express)

**Evidence:** Health JSON on prod and staging Express: `"redis": { "ok": false, "state": "unavailable" }`.

**Code behavior when Redis is down** (`server/services/backgroundQueue.js`):

- Logs: `"Redis connect failed. Falling back to memory-based delayed execution."`
- Initializes **in-memory scheduler** instead of BullMQ workers
- HolySheet sync, CSV backup, gamification queues run in-process or not at all across restarts

**Downstream failures:**

| Component | File | Degraded behavior |
|-----------|------|-------------------|
| BullMQ job queues | `server/services/backgroundQueue.js` | In-memory batching; jobs lost on deploy/restart |
| Notification distributed locks | `server/services/notificationService.js` | **Bypasses lock** when Redis unavailable — duplicate notifications possible |
| Token revocation | `server/utils/tokenRevocation.js` | Memory fallback — logout revocation not shared across instances |
| Resend send rate gate | `server/utils/resendSendGate.js` | Memory spacing fallback — campaign sends can burst |
| API idempotency | `server/middleware/apiIdempotency.js` | Requires Redis — may fail open |
| Import worker | `server/workers/importWorker.js` | Creates own IORedis connection — **fails silently** if Redis down |
| Webhook worker | `server/workers/webhookWorker.js` | Same |
| System health probe | `server/services/systemHealthProbeService.js` | Reports Redis **down** in production |
| Booked-call rep round-robin | `server/utils/bookedCallRepAssignment.js` | Falls back to Mongo counter |

**Render blueprint** (`render.yaml`) wires `REDIS_URL` from `taskmaster-redis` Key Value service — either:

1. Key Value instance not provisioned / not linked in Dashboard, or  
2. `REDIS_URL` wrong / internal URL not reachable, or  
3. Redis instance exists but connection fails (policy, network, credentials)

**Required fix (ops):** Render Dashboard → `CoreKnot-api` → verify `REDIS_URL` from `taskmaster-redis` with **`noeviction`** policy. Repeat for `coreknot-api-staging` → `taskmaster-redis-staging`.

### 2.2 API hostname schizophrenia

Three different “production API” names appear across the repo:

| Host | Where used | Live? |
|------|------------|-------|
| `taskmaster-jfw0.onrender.com` | **Committed** `vercel.json`, `client/vercel.json`, `sites/*/vercel.json`, tests | **Yes — health 200** |
| `CoreKnot-jfw0.onrender.com` | `docs/AI_AGENT_PROJECT_CONTEXT.md`, `docs/EMAIL_ENGINE_LOCKED.md`, `docs/GOOGLE_META_APP_VERIFICATION.md`, cursor email rule | **No — does not resolve** |
| `YOUR-PRODUCTION-API` / `YOUR-RENDER-SERVICE` | `render.yaml`, `.env.example`, many docs | Placeholder only |

**Contradiction:** `server/scripts/preflightEnv.js` lists `taskmaster-jfw0.onrender.com` in `RETIRED_RENDER_HOSTS` and **errors** if `SERVER_URL` / `TRACKING_BASE_URL` / `VITE_API_URL` contain it — but production Vercel rewrites **require** that exact host today.

**Contradiction:** `.cursor/rules/production-hosts-locked.mdc` bans `CoreKnot-jfw0` but committed proxy uses `taskmaster-jfw0`. `FULL_APP_REVIEW_BACKLOG.md` says `taskmaster-jfw0` is correct — other docs still say `CoreKnot-jfw0`.

**Impact:**

- OAuth redirect URIs registered to wrong host → Google/Meta/Spotify login fails
- Email open/click pixels (`TRACKING_BASE_URL`) point to dead host → tracking broken
- `production:readiness` / deploy scripts using wrong host → false pass/fail
- New engineers copy wrong URL from `AI_AGENT_PROJECT_CONTEXT.md`

### 2.3 Missing gitignored production hosts file

`npm run production:readiness` **exits 1** on this machine:

```
✗ Missing .cursor/production-hosts.local.json
```

The canonical URL map is **gitignored** — CI agents, cloud VMs, and new clones cannot validate production without manual copy from `production-hosts.local.example.json`. Deploy automation (`scripts/deploy-production-render.js`, `scripts/stagingReadiness.js`) depends on this file.

### 2.4 Render Blueprint placeholder env vars

`render.yaml` production web service (`CoreKnot-api`) still commits:

```yaml
TRACKING_BASE_URL: https://YOUR-PRODUCTION-API
SERVER_URL: https://YOUR-PRODUCTION-API
FRONTEND_URL: https://YOUR-PRODUCTION-FRONTEND
```

If Blueprint sync overwrites Dashboard values, **email tracking, OAuth callbacks, and CORS break** until manually repaired.

**Service name mismatch:** Blueprint names service `CoreKnot-api`; live URL is `taskmaster-jfw0.onrender.com` — Dashboard manual service vs blueprint drift.

### 2.5 Cron jobs — blueprint only

`render.yaml` defines:

| Cron | Schedule | Script | Status |
|------|----------|--------|--------|
| `CoreKnot-daily-backup` | `31 18 * * *` | `runDailyBackup.js` | Likely **not provisioned** (per `deployment.md`, `AI_AGENT_PROJECT_CONTEXT.md`) |
| `CoreKnot-subscription-reminders` | `30 3 * * *` | `runSubscriptionReminders.js` | Likely **not provisioned** |

**Removed:** `keep-warm` cron and `.github/workflows/keep-warm.yml` — docs disagree (`FULL_APP_REVIEW_BACKLOG.md` says GHA keep-warm shipped; `EXTERNAL_KEEP_WARM.md` says removed Jun 2026). No keep-warm workflow exists in repo today.

**Fallback:** Admin DB Backup widget or `npm run backup:daily` — manual, easy to miss.

---

## 3. P1 — CI/CD and deployment pipeline

### 3.1 GitHub Actions CI (`.github/workflows/ci.yml`)

| Job | What it runs | Gap / failure mode |
|-----|--------------|-------------------|
| `server-test` | Jest + coverage | Passes locally (126 suites, 650 tests) but **`forceExit: true`** — open handles masked |
| `client-check` | ESLint, Vitest, build | Passes locally; build can **flap** on PWA injectManifest (see §4.3) |
| `lighthouse-public` | a11y ≥90 on `/`, `/login` | Only 2 public routes — not workspace |
| `e2e-public` | Playwright public smoke | Requires `npx playwright install` — fails on fresh CI if step order wrong |
| `e2e-core-confidence` | **Conditional** on `secrets.E2E_PASSWORD` | **Skipped entirely** if secret unset |
| `e2e-auth` | **Conditional** on `E2E_EMAIL` + `E2E_PASSWORD` | **Skipped entirely** if secrets unset |
| Dependency audit | `npm audit --audit-level=high` | **`continue-on-error: true`** — does not block merges |

**Not in CI.yml but in root `npm run ci`:**

| Step | Result (01/07/2026) |
|------|---------------------|
| `npm run typecheck` | **FAIL** — `TS5101` baseUrl deprecated (exit 2) |
| `npm run build --workspace=nestjs-server` | **FAIL** — npm override `$@opentelemetry/core` unresolved |
| `npm run test:e2e --workspace=nestjs-server` | **FAIL** (migration readiness) |
| `npm run audit:boundaries` | Pass |
| `npm run test:packages` | Pass |

**Implication:** GitHub CI can be green while **full monorepo `npm run ci` is red**.

### 3.2 Deploy Render (`.github/workflows/deploy-render.yml`)

- Triggers only after CI success on `main`
- Production deploy uses `secrets.RENDER_DEPLOY_HOOK_API`
- **If secret unset:** logs warning and **`exit 0`** — deploy silently skipped
- Same pattern for staging and nest staging hooks
- Production Render service has `autoDeploy: false` in blueprint — **deploy only via hook or manual**

**Risk:** Merges to `main` can pass CI without ever deploying API.

### 3.3 Staging deploy (`.github/workflows/deploy-render-staging.yml`)

- Triggers on `staging` branch push
- Prefers `RENDER_API_KEY` + `scripts/deploy-staging-render.js`
- Falls back to deploy hooks — individual hooks can be missing with warning only

### 3.4 Render build script

`scripts/render-build.sh`:

- Deletes entire `node_modules` on every deploy (slow but avoids ENOTEMPTY)
- Production API install: `npm ci --omit=dev --workspace=coreknot-server` only — **no client build in API deploy** (client on Vercel)
- Nest target builds Nest workspace — **fails** with same OpenTelemetry override issue

### 3.5 Vercel build requirements

From `client/vite.config.js`:

- **Production build throws** if `VITE_CLERK_PUBLISHABLE_KEY` starts with `pk_test_` on Vercel production
- `VERCEL_FORCE_NO_BUILD_CACHE: "1"` in vercel.json — every deploy full rebuild (slow, costly)
- `installCommand` runs `generateVercelConfig.cjs` — if `RENDER_API_PROXY_URL` unset on Vercel, committed `vercel.json` rewrites used as-is

---

## 4. P1 — Test suite failures and gaps

### 4.1 Local test results (after `npm ci`)

| Command | Result |
|---------|--------|
| `npm test --prefix server` | **PASS** — 126 suites, 650 tests (~266s); `Force exiting Jest` warning |
| `npm test --prefix client` | **PASS** — 67 files, 275 tests |
| `npm run lint --prefix client` | **PASS** |
| `npm run build --prefix client` | **PASS** (second run); first run hit PWA error (§4.3) |
| `npm run test:e2e:public` | **FAIL** without `playwright install`; **PASS** after install (4 tests) |
| `npm run production:readiness` | **FAIL** — missing `production-hosts.local.json` |
| `npm run migration:readiness` | **FAIL** — Prisma validate, Nest build, Nest e2e |
| `npm run ci` (root) | **FAIL** at typecheck |

### 4.2 E2E coverage vs routes

**Tested in default CI** (`e2e-public`):

- `/` landing load
- `/login` render
- PWA service worker registration + precache

**Tested only with secrets** (`e2e-core-confidence`, `e2e-auth`):

- `/dashboard`, `/todo`, `/crm`, `/settings`, password gate, artist tab

**Explored in `e2e/explore-page.smoke.js`** (permission archetypes):

- `/dashboard`, `/projects`, `/calendar`, `/todo`, `/inbox`, `/attendance`, `/logs`, `/notes`, `/assets`, `/schedule`, `/emails`, `/crm`, `/office`, `/management`, `/admin/console`, `/settings`

**Not in automated Playwright CI** (manual sweeps only):

| Area | Routes / pages |
|------|----------------|
| **Landing site** | `landing.tsccoreknot.com` — CI uses single preview server, not split deploy |
| **Auth site** | `auth.tsccoreknot.com` — external auth redirects untested in CI |
| **Email workspace** | `/emails/templates`, `/emails/create`, `/emails/newsletter/*`, `/campaign/:id` |
| **Admin** | Most `/admin/*` (except via manual `admin-explorer-sweep.mjs`) |
| **Projects** | `/projects/:id`, `/projects/:id/analytics`, `/workspaces/:name`, `/projects/new` |
| **Artists** | `/artists/:id/*`, `/artist-workspace/:id/*`, `/artists/portfolio`, `/artist/:slug` (public) |
| **Tools** | `/office-assets`, `/features`, `/workflows`, `/components` |
| **Legal/public** | `/unsubscribe`, `/privacy`, `/userdata`, `/oauth/meta/callback` |
| **Orphan** | `AdminExly.jsx` imported in `App.jsx` but **no route** — dead code path |

### 4.3 Client build flakiness (PWA)

Intermittent failure on first build after install:

```
Error: Unable to find a place to inject the manifest … swSrc and swDest configured to the same file
```

Second build succeeded. Suggests **race or cache state** in `vite-plugin-pwa` injectManifest — can break Vercel/CI builds nondeterministically.

### 4.4 npm audit broken

Both workspaces:

```
npm error Unable to resolve reference $@opentelemetry/core
```

Root `package.json` uses npm overrides referencing `$@opentelemetry/core` — audit resolution fails. CI runs audit with `continue-on-error: true` so merges proceed with unknown vulnerability state. **32 vulnerabilities** reported at install (3 high).

### 4.5 Jest hygiene

- `forceExit: true` in `server/jest.config.js` — tests pass but async leaks (queue schedulers log hundreds of `"In-memory scheduler initialized"` lines)
- Coverage threshold very low (15% lines) — does not guarantee critical path coverage

---

## 5. P1 — NestJS / Postgres migration path broken

Staging Nest service (`coreknot-nest-staging`) health:

```json
{
  "ok": true,
  "status": "STARTING",
  "dependencies": {
    "postgres": { "ok": false, "state": "disconnected" },
    "redis": { "ok": true, "state": "configured" }
  }
}
```

**Local `migration:readiness` blockers:**

| Check | Failure |
|-------|---------|
| Prisma validate | P1012 — `url` in `schema.prisma` deprecated under Prisma CLI 7.x (project pins 6.11.1 in build script but `npx prisma` resolves 7.8.0) |
| NestJS production build | `Unable to resolve reference $@opentelemetry/core` |
| NestJS e2e | Fails (cascade) |

**Implication:** Supabase/Postgres cutover, preview ETL, and Nest strangler routes cannot be validated or shipped. Express remains sole production API (acceptable) but **staging migration QA is non-functional**.

---

## 6. P1 — Security and multi-tenancy

### 6.1 Tenant plugin coverage

~59 of ~90 Mongoose models use `tenantPlugin`. **Models without tenant scoping include business-critical:**

| Model | Risk |
|-------|------|
| `Lead.js` | CRM core — cross-tenant leak on missing context |
| `Task.js`, `TaskActivity.js`, `TaskAssignment.js` | Project/work data |
| `Project.js`, `Phase.js`, `ProjectGoal*.js` | Workspace isolation |
| `MailCampaign.js`, `MailEvent.js`, `MailTemplate.js` | Email engine |
| `Contact.js`, `EMI.js` | CRM/finance |
| `Campaign.js` (legacy) | Mail parity |
| `CRMImport.js`, `CRMAudit.js`, `CRMConfig.js`, `CRMStatSnapshot.js` | CRM ops |
| `EmailProfile.js`, `EmailLog.js` | Mail |
| `ArtistAuth.js`, `ArtistMetrics.js`, `ArtistConnection.js` | Artist integrations |
| `PlatformSettings.js`, `GamificationConfig.js` | Global config (may be intentional) |
| `Tenant.js` | Root tenant record (expected) |

See `docs/TENANT_SECURITY_PHASE.md` — **planned work remains** (bypass grep automation, remaining aggregations, compound unique indexes).

### 6.2 bypassTenant usage

40+ production paths still use `bypassTenant` (tracking, attendance, calendar, scripts). Policy documented in `docs/TENANT_BYPASS_ALLOWLIST.md` but **not fully enforced** in CI for new route handlers.

### 6.3 Webhook / staging secrets

`FULL_APP_REVIEW_BACKLOG.md` T0-13: webhook secrets may be weak/missing on staging — **public staging URL** allows unauthenticated webhook posts if secrets not set.

### 6.4 DEBUG_BYPASS

Blocked in production (`authMiddleware.js`) — **shipped**. NestJS guard still reads `DEBUG_BYPASS` — ensure unset on Render.

### 6.5 JWT / session

- Logout revocation uses Redis with memory fallback — **degraded with Redis down**
- Global 401 handler shipped on client — depends on API reachability

---

## 7. P2 — Page and subpage reliability matrix

Router: `client/src/App.jsx`. Below: **production UX risk when API fails or env is wrong**, not auth/RBAC (see subagent inventory).

### 7.1 App host — public routes

| Path | Component | Error handling | Production risk |
|------|-----------|----------------|-----------------|
| `/` | `AppRootRedirect` | N/A | Wrong `VITE_LANDING_URL` / `VITE_AUTH_URL` → redirect loop or wrong host |
| `/landing` | Landing or external redirect | Static | Split-deploy misconfig |
| `/login/*`, `/register/*`, … | Auth or `ExternalAuthRedirect` | Form-level | **Mobile** needs Vercel `/api` proxy; **desktop** needs `VITE_API_URL` |
| `/oauth/meta/callback` | `MetaOAuthCallback` | Partial | OAuth state mismatch if `FRONTEND_URL` wrong on API |
| `/unsubscribe` | `UnsubscribePage` | Form errors only | Public; depends on `TRACKING_BASE_URL` / API |
| `/artist/:slug` | `ArtistPublicProfile` | Limited | Public profile API failures — weak empty state |
| `/preview/artist/:id/*` | `ArtistDetail` preview | Same as artist OS | Preview token/path drift |

### 7.2 App host — CRM hub (`/crm?tab=`)

| Tab | Component | QueryErrorBanner | Notes |
|-----|-----------|------------------|-------|
| `leads` | `LeadsPage` | Yes | Lock/423 paths — critical daily use |
| `followups` | `FollowupsPage` | Yes | Lock shipped Jun 2026 |
| `bookings` | `ExlyBookingsPage` / `ArtistBookingEnquiriesPage` | Via `ExlyDataContent` custom error | Exly API dependency |

### 7.3 App host — Office hub (`/office?tab=`)

| Tab | Component | QueryErrorBanner | Notes |
|-----|-----------|------------------|-------|
| `equipment` | `EquipmentPage` | Yes | |
| `contacts` | `ContactsPage` | Yes | |
| `subscriptions` | `SubscriptionsPage` | Yes | Renewal reminders cron may be off |

### 7.4 App host — Management hub (`/management?tab=`)

| Tab | Component | QueryErrorBanner | Notes |
|-----|-----------|------------------|-------|
| `finance` | `FinancePage` | Yes | Large monolithic file — perf risk |
| `announcements` | `AnnouncementsPage` | Yes | |
| `artists` | `ArtistsCollection` | Yes | |

### 7.5 App host — standalone workspace routes

| Path | Component | QueryErrorBanner | Loading | Notes |
|------|-----------|------------------|---------|-------|
| `/dashboard` | `Dashboard` | Yes | Skeleton | Widget partial failure possible per-widget |
| `/projects` | `ProjectsView` | Yes | Yes | |
| `/projects/new` | `ProjectCreate` | **No** | Partial | Uses mutations; error UX weaker |
| `/projects/:id` | `ProjectDetail` | Yes | Yes | 404 vs error distinction shipped |
| `/projects/:id/analytics` | `ProjectAnalyticsPage` | **Inline text only** | Skeleton | Weak error UX |
| `/workspaces/:name` | `WorkspaceSettings` | Partial | Yes | |
| `/calendar` | `CalendarView` | Yes | Yes | |
| `/todo` | `TodoPage` | Yes | Yes | |
| `/inbox` | `InboxPage` | Yes | Yes | |
| `/attendance` | `AttendancePage` | Yes | Yes | Nest strangler **removed** from prod vercel — Express only |
| `/schedule` | `SchedulePage` | **EmptyState** (not banner) | Skeleton | Inconsistent pattern |
| `/logs` | `DailyLogPage` | Yes | Yes | |
| `/notes`, `/notes/:id` | `NotesPage`, `NoteEditorPage` | Yes | Yes | |
| `/assets` | `AssetsPage` | Yes | Partial | Legacy fetch patterns |
| `/assets/accounts` | `OrgAccountsPage` | `PageLoadGuard` | Skeleton | ArtistOrAdmin gate |
| `/office-assets` | `OfficeAssetsPage` | `PageLoadGuard` | Skeleton | |
| `/features` | `FeaturesPage` | N/A static | N/A | Marketing copy only |
| `/workflows` | `WorkflowCanvas` | Yes | Partial | |
| `/settings` | `SettingsPage` | Partial (tabs vary) | Yes | Profile read-only role shipped |
| `/emails` | `EmailsOverviewPage` | Yes | Yes | |
| `/emails/campaigns` | `EmailsCampaignsPage` | Delegated | Minimal | |
| `/emails/templates` | `EmailsTemplatesPage` | Via `MailTemplateStudio` | Child | |
| `/emails/profiles` | `EmailsProfilesPage` | Yes | Yes | |
| `/emails/analytics` | `EmailsAnalyticsPage` | Yes | Yes | Geo depends on email engine |
| `/emails/newsletter` | `NewsletterPage` | Yes | Yes | |
| `/emails/newsletter/curate` | `NewsletterCuratePage` | **No** | Text only | Admin gate + **no isError UI** |
| `/emails/newsletter/send/:id` | `NewsletterSendPage` | Partial | Yes | Admin gate |
| `/emails/create` | `CreateCampaignPage` | Wizard internal | Wizard | Large payloads need direct `VITE_API_URL` |
| `/campaign/:id` | `CampaignDetails` | Yes | Yes | Activity stream geo locked spec |
| `/artists/portfolio` | `PortfolioDashboard` | Yes | Yes | |
| `/artists/:id/*` | `ArtistDetail` + tabs | Mixed per tab | Yes | Many tabs (`ArtistOsQueryShell`) |
| `/artist-workspace/:id/*` | `ArtistWorkspaceShell` | Partial | Yes | **No PageRoute** — membership only |
| `/admin/console` | `AdminConsole` | Hub shell | Yes | |
| `/admin` | `DataHubPage` | `ListPageLayout` | Table | PersonIndex dual-write debt |
| `/admin/control` | `AdminPanel` | Partial | Yes | |
| `/admin/qa` | `QATestingPage` | Yes | Yes | Can surface prod issues |
| `/admin/users` | `AdminUsers` | Yes | Yes | |
| `/admin/roles` | `AdminRolesPage` | Yes | Yes | Page permission matrix |
| `/admin/teams` | `AdminTeamsPage` | Yes | Yes | |
| `/admin/scripts` | `AdminScriptsPage` | `queryError` prop | Skeleton | **Blast radius** — prod scripts |
| `/admin/exly-campaigns` | `ExlyCampaignsPage` | Via `ExlyDataContent` | Loading | |
| `/admin/lead-audits` | `LeadAuditsPage` | **No** | Table loading | Extra `isAdminUser()` gate |
| `/admin/crm-stats` | `CrmStatsPage` | Yes | Yes | Worker depends on Redis |
| `/admin/media-list` | `MediaListPage` | Yes | Yes | |
| `/admin/gamification` | `AdminGamification` | Yes | Yes | Queue depends on Redis |
| `/admin/ops-hub` | `OpsHubPage` | Yes | Yes | |
| `/admin/project-analytics` | `AdminProjectAnalyticsPage` | Yes | Yes | |
| `/admin/platform-settings` | `AdminPlatformSettings` | Yes | Yes | |
| `/admin/artist-path` | `ArtistPathPage` | Inline block | `loading` prop | |
| `/components` | `ComponentsShowcase` | Dev only | Yes | `admin_data` gate |
| `*` | `NotFoundPage` | N/A | N/A | Shipped inside `MainLayout` |

### 7.6 Landing site routes

| Path | Component | Notes |
|------|-----------|-------|
| `/` | `LandingPage` | Only route on landing host |
| `/privacy`, `/userdata` | Legal | |
| `*` | → `/` | |

### 7.7 Auth site routes

| Path | Component | Notes |
|------|-----------|-------|
| `/login/*`, `/register/*`, `/forgot-password`, `/reset-password` | Auth pages | Clerk + legacy auth; cookie domain `.tsccoreknot.com` |
| `/relegends` | OTP | |
| `/auth/google/success` | Google success | Redirect to `VITE_APP_URL` |
| `/`, `*` | → `/login` | |

### 7.8 Artist OS sub-tabs (under `/artists/:id/*`)

Each tab has varying error handling via `ArtistOsQueryShell` / per-tab loaders:

- Overview, Analytics, Calendar, Content, Contracts, Documents, Finance, Gigs, Inquiries, Notes, Releases, Bookings

**E2E:** Only `?tab=overview` in core-confidence spec — other tabs untested in CI.

---

## 8. P2 — Integrations and external dependencies

| Integration | Config vars | Failure mode in prod |
|-------------|-------------|-------------------|
| **Resend** | `RESEND_API_KEY` | Health probe degrades if unset/mock; campaigns fail |
| **UploadThing** | `UPLOADTHING_TOKEN` | Health shows **ready** on prod probe |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, redirect on **API host** | Wrong host in GCP console → login fail |
| **YouTube/Spotify artists** | Redirect mix: API vs frontend domain | Doc inconsistency (`GOOGLE_META_APP_VERIFICATION.md` still lists `CoreKnot-jfw0`) |
| **Meta/Instagram** | Webhooks on API host | Stale URLs in Meta dashboard if host renamed |
| **HolySheet** | Google Sheets API | Queue in memory — sync delayed/lost without Redis |
| **Exly** | API keys + webhooks | `ExlyDataContent` errors on bookings/campaigns pages |
| **Clerk** | `VITE_CLERK_PUBLISHABLE_KEY`, `__clerk` proxy | `pk_test_` blocks Vercel prod build; proxy rewrite to API |
| **PostHog** | `VITE_POSTHOG_*`, `/ph` rewrites | Rewrite order must precede SPA catch-all — verified in tests |
| **Supabase secondary** | `SUPABASE_*` | Enabled on prod; backup destination |
| **TSC website webhooks** | `BOOK_CALL_WEBHOOK_SECRET`, etc. | Point to `SERVER_URL` — must match live API |
| **MongoDB Atlas** | `MONGODB_URI_PROD` | Connected on probe |
| **Stripe/billing** | — | **Deferred** per roadmap |

### 8.1 Email engine (locked)

Tracking must use same host as production API (`TRACKING_BASE_URL`). Docs still cite `CoreKnot-jfw0` in `EMAIL_ENGINE_LOCKED.md` and `.cursor/rules/email-engine-locked.mdc` — **contradicts live `taskmaster-jfw0`**.

`server/utils/trackingUrls.js` default fallback: `https://YOUR-RENDER-SERVICE.onrender.com` — if env missing, pixels break.

---

## 9. P2 — Data integrity and background jobs

| Issue | Detail |
|-------|--------|
| PersonIndex dual-write | `ContactService` still dual-writes; parity script exists but cutover not done |
| Project task counters | Partial fix — list APIs aggregate live; stored `$inc` counters may drift |
| `Lead.nextFollowupDate` as string | Timezone/sort edge cases — migration open |
| CSV import worker | Rep mapping uses `departmentId` (fixed from `role`?) — import unused in prod per backlog |
| Attendance write-on-read | GET may mutate rows — perf risk at scale |
| Legacy `Campaign` collection | MailCampaign parity incomplete |
| Gamification queue | Depends on Redis — in-memory unreliable |

---

## 10. P2 — Observability and ops gaps

| Tool | Status |
|------|--------|
| Sentry | Wired; DSN often **unset** — no server/browser error tracking |
| Datadog | Documented; setup **paused** per `production-hosts.local.example.json` |
| PostHog | Partial — needs Vercel env tokens |
| SystemLog / admin QA | Live fallback diagnostics |
| Render logs | Need `VITE_RENDER_SERVICE_ID_*` for deep links from client |
| Health endpoint | Liveness only — Redis reported inside JSON but **still returns `ok: true`** overall |

**Misleading health:** `/api/health` returns `"ok": true` while Redis is down — load balancers think service healthy; background work silently degraded.

---

## 11. Documentation contradictions (causes misconfiguration)

| Doc A says | Doc B / code says | Live truth |
|------------|-------------------|------------|
| API is `CoreKnot-jfw0` (`AI_AGENT_PROJECT_CONTEXT.md`, `EMAIL_ENGINE_LOCKED.md`) | Banned host per `production-hosts-locked.mdc` | **`taskmaster-jfw0` resolves** |
| `taskmaster-jfw0` is correct (`FULL_APP_REVIEW_BACKLOG.md`) | `preflightEnv.js` RETIRED_RENDER_HOSTS includes `taskmaster-jfw0` | Proxy uses taskmaster |
| GHA keep-warm shipped (`FULL_APP_REVIEW_BACKLOG.md`) | `EXTERNAL_KEEP_WARM.md` says removed; no workflow file | N/A on paid Render |
| `MASTER.md`: never use `taskmaster-jfw0` in new code | `vercel.json` committed with taskmaster | Production depends on it |
| `importWorker` uses `User.role` (audit) | Code uses `departmentId` | Audit stale |

---

## 12. Architectural / code-quality risks (production impact)

From `weakness_report.md` and codebase review:

| Risk | Production impact |
|------|-------------------|
| Lead lock 15m TTL | Crash leaves CRM record locked 15 minutes |
| No table virtualization (Leads) | Large datasets → browser memory pressure |
| 22 monolithic files (60+ fns) | Slow fixes, high regression rate |
| 196+ architectural inversions (utils→UI) | Bundle size, circular import risk |
| Legacy unmounted routes in `server/routes/` | Confusion — domains replaced flat routes |
| `track.js` double-mounted at `/` and `/api/track` | Duplicate webhook/pixel paths — careful when changing |
| Clerk SDK deprecated (`@clerk/clerk-sdk-node` EOL Jan 2025) | Future auth breakage |

---

## 13. Complete route inventory (reference)

### 13.1 Client — all app routes (from `App.jsx`)

**Public:** `/`, `/landing`, `/login/*`, `/register/*`, `/forgot-password`, `/reset-password`, `/relegends`, `/auth/google/success`, `/privacy`, `/userdata`, `/oauth/meta/callback`, `/preview/artist/:id/*`, `/unsubscribe`, `/artist/:slug`

**Protected:** `/artist-workspace/:id/*`, `/dashboard`, `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/analytics`, `/workspaces/:name`, `/calendar`, `/settings`, `/logs`, `/attendance`, `/attendance/all`, `/schedule`, `/inbox`, `/todo`, `/notes`, `/notes/new`, `/notes/:id`, `/components`, `/crm`, `/office`, `/management`, `/admin/console`, `/assets`, `/assets/accounts`, `/office-assets`, `/features`, `/workflows`, `/admin/artist-path`, `/admin`, `/admin/control`, `/admin/qa`, `/admin/media-list`, `/admin/lead-audits`, `/admin/crm-stats`, `/admin/users`, `/admin/platform-settings`, `/admin/teams`, `/admin/roles`, `/admin/exly-campaigns`, `/admin/scripts`, `/admin/gamification`, `/admin/ops-hub`, `/admin/project-analytics`, `/campaign/:campaignId`, `/emails`, `/emails/campaigns`, `/emails/templates`, `/emails/profiles`, `/emails/analytics`, `/emails/newsletter`, `/emails/newsletter/curate`, `/emails/newsletter/send/:issueId`, `/emails/create`, `/artists/portfolio`, `/artists/:id/*`, catch-all `NotFoundPage`

**Legacy redirects:** `/chat`, `/leads`, `/followups`, `/bookings`, `/equipment`, `/contacts`, `/subscriptions`, `/finance`, `/announcements`, `/artists`, `/management/*`, `/workspace/emails/*`, `/admin/audits`, `/artists/:id/analytics*`

### 13.2 Server — mounted API prefixes (from `registerRoutes.js`)

`/api/health`, `/api/openapi.json`, `/api/public/*`, `/api/auth`, `/api/users`, `/api/v1/sync`, `/api/projects`, `/api/tasks`, `/api/artists`, `/api/v2/artists`, `/api/artist-path`, `/api/crm`, `/api/dashboard`, `/api/data-hub`, `/api/mail`, `/api/campaigns`, `/api/google`, `/api/google/accounts`, `/api/integrations`, `/api/exly`, `/api/logs`, `/api/teams`, `/api/gamification`, `/api/gamification-admin`, `/api/qa`, `/api/customization`, `/api/assets`, `/api/proxy`, `/api/calendar`, `/api/departments`, `/api/schedule`, `/api/notifications`, `/api/notes`, `/api/search`, `/api/pinboard`, `/api/ses`, `/api/tsc`, `/api/analytics`, `/api/webhooks`, `/api/office-assets`, `/api/subscriptions`, `/api/org-accounts`, `/api/contacts`, `/api/newsletter`, `/api/finance`, `/api/attendance`, `/api/announcements`, `/api/ops-hub`, `/api/admin/*`, `/api/uploadthing`, `/api/track`, root tracking routes, `POST /api/crm/unsubscribe`, `/__clerk` proxy

---

## 14. Prioritized remediation checklist (ops-first)

No code changes made in this audit — recommended order for whoever fixes:

### Immediate (P0) — restores core production behavior

1. **Fix Redis on Render production** — link `taskmaster-redis` to `CoreKnot-api` / `taskmaster-jfw0` service; verify `noeviction`; confirm health `redis.ok: true`
2. **Fix Redis on staging Express** — `taskmaster-redis-staging` → `coreknot-api-staging`
3. **Publish canonical API URL** in gitignored `production-hosts.local.json` for team; align Dashboard `SERVER_URL`, `TRACKING_BASE_URL`, `FRONTEND_URL`
4. **Reconcile hostname docs** — one name only in OAuth consoles, Meta, Google Cloud, Resend, TSC webhooks
5. **Verify Render Dashboard env** not overwritten by blueprint placeholders on next sync

### Short-term (P1) — deployments and tests trustworthy

6. Set GitHub secrets: `RENDER_DEPLOY_HOOK_API`, `E2E_EMAIL`, `E2E_PASSWORD`
7. Fix npm overrides so `npm audit` and Nest build work; pin Prisma CLI to 6.x in nestjs-server
8. Fix root `npm run ci` typecheck (TS 6 deprecation) or remove from agent gate until fixed
9. Provision Render cron jobs or document manual backup/reminder SOP
10. Fix Nest staging `DATABASE_URL` — Postgres disconnected
11. Align `preflightEnv.js` RETIRED hosts with actual production host OR migrate Vercel rewrites to new host

### Medium-term (P2) — product hardening

12. Complete `TENANT_SECURITY_PHASE` before second org
13. Roll `QueryErrorBanner` to remaining data pages (§7)
14. Expand E2E to email + project detail + admin critical paths
15. Health endpoint should return non-ok when Redis down in production
16. Purge stale docs referencing `CoreKnot-jfw0`
17. Resolve PWA injectManifest flakiness in CI

---

## 15. Verification commands (repeat this audit)

```bash
# Install
npx --yes npm@11.13.0 ci

# Unit tests
npm test --prefix server
npm test --prefix client

# Full monorepo gate (currently fails typecheck + nest)
npm run ci

# Production readiness (needs .cursor/production-hosts.local.json)
npm run production:readiness

# Migration / Nest path
npm run migration:readiness

# Public E2E (needs playwright browsers)
npx playwright install chromium --with-deps
npm run test:e2e:public

# Live health
curl -s https://taskmaster-jfw0.onrender.com/api/health | jq .
curl -s https://tsccoreknot.com/api/health | jq .
```

---

## 16. Sources consulted

| Source | Path |
|--------|------|
| CI workflow | `.github/workflows/ci.yml` |
| Deploy workflows | `.github/workflows/deploy-render.yml`, `deploy-render-staging.yml` |
| Render blueprint | `render.yaml` |
| Vercel routing | `vercel.json`, `client/vercel.json`, `sites/*/vercel.json` |
| Preflight / readiness | `server/scripts/preflightEnv.js`, `scripts/productionReadiness.js`, `scripts/stagingReadiness.js`, `scripts/migrationReadiness.js` |
| Backlog | `docs/FULL_APP_REVIEW_BACKLOG.md`, `docs/weakness_report.md` |
| Tenant security | `docs/TENANT_SECURITY_PHASE.md`, `docs/TENANT_BYPASS_ALLOWLIST.md` |
| Environment matrix | `docs/ENVIRONMENT_MATRIX.md`, `docs/DEPLOY_ENV.md` |
| Route inventory | `client/src/App.jsx`, `server/app/registerRoutes.js` |
| Prior heal ledger | `.cursor/multiagent/prod-console-heal-ledger.json` |

---

*End of audit. Re-run probes and verification commands after infra changes; update this document with dated deltas only — do not duplicate into multiple backlog files without cross-linking.*
