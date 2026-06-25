# Recent changes

Session deltas appended by `/git-push` and agent ship workflows. Newest first.

---

## 2026-06-25 — Vercel Web Analytics on all CoreKnot frontends

- **What:** `@vercel/analytics` + `<Analytics />` in `client/src/main.jsx` — covers `tsccoreknot.com`, `landing.tsccoreknot.com`, and `auth.tsccoreknot.com` (shared client bundle per `VITE_SITE_MODE`).
- **Why:** Page-view telemetry in Vercel dashboard for app, landing, and auth deploys.
- **Files:** `client/package.json`, `client/src/main.jsx`
- **Branch:** `main` · **Commit:** `667bb0da`

---

## 2026-06-25 — Multi-site deploy, OG previews, cookie consent, onboarding checklist

- **What:** Split marketing/auth from main app via `VITE_SITE_MODE` (`landing` / `auth` / `app`). Landing → `landing.tsccoreknot.com`; auth slugs on `auth.tsccoreknot.com` (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/relegends`, `/auth/google/success`); app host redirects `/` and auth paths externally. Session cookie `domain: .tsccoreknot.com` for cross-subdomain login. OG preview banner 1200×630 (`icons/og-preview.png`). Functional cookie banner gates Sentry/Datadog/PostHog. Amber **Onboarding checklist** in `ProfileCompletionAlerts` (profile + tour). `public/sitemap.xml` + robots fix.
- **Why:** Separate deploy surfaces for marketing vs auth vs workspace; compliant analytics consent; better link previews; guided onboarding in-dashboard.
- **Files:** `client/src/config/siteMode.js`, `client/src/config/siteUrls.js`, `client/src/App.jsx`, `client/src/components/CookieBanner.jsx`, `client/src/lib/cookieConsent.js`, `client/src/components/ProfileCompletionAlerts.jsx`, `client/scripts/generate-og-preview.mjs`, `sites/landing/vercel.json`, `sites/auth/vercel.json`, `server/utils/authCookie.js`, `server/app/cors.js`
- **Deploy:** Two extra Vercel projects — root `sites/landing` + `sites/auth`; build `npm run vercel-build:landing` / `vercel-build:auth`. Redeploy Render API for cookie domain + CORS.
- **Branch:** `main` · **Commit:** _(pending push)_

---

## 2026-06-20 — Legacy server script cleanup and finance OCR limits

- **What:** Removed ad-hoc migration/test scripts from `server/` root; extracted `financeOcrLimits.js` (max bytes, skip image OCR on Render); shared AiSensy client in CRM lead writes; dropped AuthContext idle keep-warm polling; synced Vercel rewrite config.
- **Why:** Reduce repo noise and Render OOM risk on finance OCR; centralize WhatsApp dispatch.
- **Files:** `server/utils/financeOcrLimits.js`, `server/domains/crm/services/leadWriteService.js`, `client/src/contexts/AuthContext.jsx`, `vercel.json`, `client/vercel.json`
- **Branch:** `main` · **Commit:** `b58779ea`

---

## 2026-06-18 — Render build ENOTEMPTY fix (cache-safe npm ci)

- **What:** `scripts/render-build.sh` wipes cached `node_modules` then `npm ci`; `render.yaml` + `syncRenderBuildCommands.js` sync Dashboard build settings. Replaces bare `npm install` that failed with ENOTEMPTY on Render cache.
- **Why:** Production deploy failed — Dashboard still used `npm install` at repo root against 536MB cached node_modules.
- **Files:** `scripts/render-build.sh`, `scripts/syncRenderBuildCommands.js`, `render.yaml`, `package.json`
- **Branch:** `main` · **Commit:** `cc7ca74a`
- **Ops:** Run `npm run render:sync-build:deploy` with `RENDER_API_KEY`, or set build command manually + clear build cache.

---

## 2026-06-18 — Projects sidebar badge matches project overdue counts

- **What:** `/api/notifications/status-counts` returns `projects.overdue` and `projects.review`; sidebar Projects badge uses those (not global todo overdue + review sum).
- **Why:** Sidebar showed 22 while Projects page showed 3 overdue — badge counted all assigned tasks, not project-scoped overdue on cards.
- **Files:** `server/utils/projectStatusCounts.js`, `server/routes/notificationRoutes.js`, `client/src/utils/navStatusCounts.js`, `client/src/hooks/useStatusCounts.js`, `client/src/components/OutletSidebar.jsx`
- **Branch:** `main` · **Commit:** `8ba2e4a8`

---

## 2026-06-18 — Dependabot npm audit dependency patches

- **What:** Bumped `vite` 6.4.3, `multer` 2.2.0, `quill`/`effect` 2.x/3.21+, `js-cookie`/`ip-address` overrides; expanded root `package.json` `overrides` for `ws`, OpenTelemetry, `systeminformation`, Clerk, uploadthing, jest `js-yaml`.
- **Why:** Clear high/moderate Dependabot alerts on `package-lock.json` without dropping lockfiles.
- **Files:** `package.json`, `package-lock.json`, `client/package.json`, `server/package.json`, `nestjs-server/package.json`
- **Branch:** `main` · **Commit:** `c5162078`

---

## 2026-06-18 — Platform settings admin UI for email and role routing

- **What:** Admin → Platform settings (`/admin/platform-settings`) — user pickers for CRM digest recipients, backup alerts, subscription fallback, password-reset CC, CRM call reps, root admins, QA exclusions, mail approvers, auto project members, etc. Mongo `PlatformSettings` drives runtime; env vars remain fallback only.
- **Why:** Stop hardcoding ops emails in `render.yaml` / `.env`; configure recipients in-app.
- **Files:** `server/routes/platformSettingsRoutes.js`, `server/utils/platformNotificationRecipients.js`, `client/src/pages/admin/AdminPlatformSettings.jsx`, `shared/platformRoleDefinitions.js`
- **Branch:** `main` · **Commit:** `59dc9d37`

---

## 2026-06-18 — Fix Vercel build: PlatformSettingsUserField import

- **What:** `PlatformSettingsUserField.jsx` imports `NexusDropdown` from `../ui/NexusDropdown` (was wrong `./NexusDropdown`).
- **Why:** New platform settings UI broke Vite production build — module not found on Linux.
- **Files:** `client/src/components/admin/PlatformSettingsUserField.jsx`
- **Branch:** `main` · **Commit:** `7b7bb719`

---

## 2026-06-18 — Fix Vercel build: crmDigestProjects ESM facade

- **What:** Split `shared/crmDigestProjects` into `.cjs` (Node) + `.js` ESM facade (Vite); server requires point at `.cjs`.
- **Why:** Vite/Rollup could not resolve `CRM_DIGEST_PLAN_OPTIONS` named export from CJS `module.exports` — production build failed on `ProjectCrmDigestSettings.jsx`.
- **Files:** `shared/crmDigestProjects.cjs`, `shared/crmDigestProjects.js`, `server/services/crmDigestSettingsService.js`, `server/domains/projects/*`
- **Branch:** `main` · **Commit:** `5b888a6b`

---

## 2026-06-18 — Workspace goals, CRM digest settings, migration ETL

- **What:** Workspace-level goals API/UI; per-project CRM digest settings (monthly target, plan values) on TSC projects; expanded Mongo→Postgres ETL + `validate-counts`; NestJS staging service in `render.yaml`; lead follow-up datetime + notification dispatcher fixes; migration readiness scripts (`migrationReadiness`, `productionReadiness`, `verifyLocalMigration`).
- **Why:** Ops leads configure digest targets in-app instead of env-only; Postgres cutover prep; strangler Nest deploy on Render staging.
- **Files:** `server/domains/projects/*workspaceGoals*`, `server/services/crmDigestSettingsService.js`, `client/src/components/project/ProjectCrmDigestSettings.jsx`, `nestjs-server/scripts/etl/mongo-to-postgres.ts`, `render.yaml`, `scripts/migrationReadiness.js`
- **Branch:** `main` · **Commit:** `20f1e743`

---

## 2026-06-18 ? CRM lead filters for all users

- **What:** Interest / Meaningful Connect / Source / Quality / Agent filters always visible on Leads; sales team browses shared pipeline; delete still scoped per rep.
- **Why:** Artist-management users only saw artist-specific filters; sales reps had `restrictToOwn` blocking Agent and team-wide filters.
- **Files:** `client/src/pages/crm/LeadsPage.jsx`, `client/src/utils/crmScope.js`, `server/utils/crmScope.js`
- **Branch:** `main` ? **Commit:** `4ca03e83`

---
