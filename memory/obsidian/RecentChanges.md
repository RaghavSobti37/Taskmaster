# Recent changes

Session deltas appended by `/git-push`, `memory-sync`, and agent ship workflows. Newest first.

---

## 2026-07-14 — Login: stop stale-session signOut race + forgot-password UX

- **What:** `ClerkStaleSessionRecovery` no longer `signOut()` on null `getToken()` (JWT warm window after password) — only on 401/403. Helper `clerkStaleSession.js` + tests. `/forgot-password` → `/login?forgot=1` hint (hash reset was broken); visible Forgot password link on start form.
- **Why:** Null token after password raced `clerk-establish` → bounce back to SignIn. Combined email+password start hid Clerk’s Forgot link.
- **Files:** `ClerkStaleSessionRecovery.jsx`, `clerkStaleSession.js`, `LoginPage.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, docs inventory.
- **Commits:** `9cd42c7e` (#116) · docs `d2b777d3` (#117) on `main`.
- **Verify:** `npx vitest run src/lib/clerkStaleSession.test.js src/lib/clerkSignInFlow.test.js` (14 pass).
- **Deploy:** Auto-deploy off — redeploy **coreknot-auth** from `main` for prod: `node scripts/deploy-coreknot-auth.mjs` (needs `VERCEL_TOKEN`).

---

## 2026-07-07 — Connected Apps intake, KE removal, local integrations demo, docs + memory

- **What:** Trimmed Connected Apps to five providers; Website Forms (embed + public API); full Knowledge Engine removal from CoreKnot; local demo seed `seed:local-integrations-demo`; in-depth docs `CONNECTED_APPS_AND_INTAKE.md`, `KNOWLEDGE_ENGINE_REMOVAL.md`, `LOCAL_DEV_DEMO_DATA.md`.
- **Why:** Product focus on CRM intake + mail/WhatsApp; KE never shipped in prod; local UI needed dummy integration data.
- **Files:** `server/domains/integrations-hub/`, `server/domains/forms/`, deleted `server/domains/knowledge-engine/**`, `seedLocalDevIntegrationsDemo.js`, `docs/features/*`, `memory/obsidian/ConnectedAppsAndIntake.md`, `KnowledgeEngineRemoval.md`.
- **Verify:** `npm run docs:generate` (140 pages); `npm test --prefix server`; `npm run build --prefix client`.

---

## 2026-07-07 — TSC platform tenant, org slug routes, prod→local sync, Clerk auth fixes

- **What:** Single platform org **The Shakti Collective** (`slug: tsc`, id `6a14c0d1d2ce3fb936553e35`). Org-scoped URL prefix `/:orgSlug/*` behind `VITE_ORG_SLUG_ROUTES` (default on); `GET /api/orgs/:slug/context`, `OrgContext`, `orgPaths.js`, feature catalog `shared/orgFeatures.cjs`, create-org wizard + `PATCH /api/tenants/:id/features`. Consolidation script removes other tenants; `PLATFORM_TENANT_SLUG=tsc` on local + Render prod API.
- **Prod → local (TSC):** `npm run sync:prod-tenant-tsc` (`syncProdTenantToLocal.js`) — tenant-filtered copy; skips CRM/Data Hub + Exly heavy collections; finance = folders + metadata only (no `extractedText` / file URLs). Verified: 31 projects, 395 tasks, 12 users.
- **Auth:** Clerk `session/touch` 401 loop fixed — `ClerkOrgActivator` skips `setActive` on auth host; `clerkEstablishToken` tolerates `setActive` failure (server pins org via `CLERK_ORGANIZATION_ID`). **Clear cookies** always in auth legal footer (`AuthLegalFooter` + `ClearSessionCookiesButton` `variant="footer"`).
- **Dashboard UX:** Removed amber `ProfileCompletionAlerts` from `MainLayout` (keep dashboard **Get started** = `OrgOnboardingChecklist`). Clerk users skip `ForcePasswordChangeGate`; `mustChangePassword` cleared on clerk-establish + `restorePlatformTenantSetup.js`.
- **Scripts:** `consolidatePlatformTenant.js`, `restorePlatformTenantSetup.js`, `syncProdTenantToLocal.js`; `server/config/syncCollections.js` — `TENANT_SYNC_SKIP`, `slimFinanceDocument`.
- **Docs:** `LOCAL_DEV_DATABASE.md`, `SCRIPTS_RUNBOOK.md`, `DATA_ENV_TOPOLOGY.md`, `README.md`, `environments.md`, `COREKNOT_MASTER.md`, `MASTER.md`, `VERSION_HISTORY.md`, `prod-data-sync` skill.
- **Deploy:** `038740c9` auth footer → `coreknot-auth`; `977274a7` dashboard/auth fixes → taskmaster API. Restart local API after tenant sync.

---

## 2026-07-06 - Code/docs/config/contract mismatch reconciliation

- **What:** Reconciled the extended mismatch audit across client routes, API contracts, generated docs, OpenAPI, server debug code, and NestJS sync routing. Legacy `/relegends` now redirects to `/login`; deleted the stale OTP page that called missing `/api/otp/*`; `/developers` now uses `admin_developers`; `/data-hub` redirects to `/admin`; Nest sync token route now resolves at `/api/v1/sync/token`; mail streams stay GET-only; orphan attendance/update and CSV importer contracts were cleaned up.
- **Docs:** Regenerated page inventory + `COREKNOT_MASTER`; updated auth/frontend memory, operations links, logo locked path, Render preview-CORS comment, OpenAPI `/v1/leads` + `tenantApiKey`, and added `docs/operations/COREKNOT_MISMATCH_AUDIT_2026-07-06.md`.
- **Verify:** Memory gate passed with `npm test --prefix coreknot/Taskmaster/client && NODE_OPTIONS=--max-old-space-size=8192 npm test --prefix coreknot/Taskmaster/server && npm run build --prefix coreknot/Taskmaster/client`; Nest build also passed separately with `npm run build --prefix nestjs-server`.
- **Ledger:** `.cursor/loop-engineering/coreknot-mismatch-reconciliation-ledger.json` marked `satisfaction: pass` only after verify exited 0.

---

## 2026-07-05 — Finance payment dates: PDF screenshot OCR + prod backfill complete

- **What:** `documentParser` PDF screenshot OCR via `pdf-parse` `getScreenshot` + Tesseract when text layer &lt; 20 chars; `shouldRunPdfOcr` guards; `reparseFinanceOcr.js --ocr-scanned`; Uber weekday + invoice-month date patterns; xlsx/docx upload-date fallback for zero-text imports.
- **Why:** ~41 prod finance docs missing `metadata.date`; project rollups need payment dates.
- **Prod:** Reuse-text pass +22 dates; spreadsheet pass +19; **0 missing** `metadata.date` remaining.
- **Files:** `server/utils/documentParser.js`, `server/utils/financeOcrLimits.js`, `server/scripts/reparseFinanceOcr.js`, `server/tests/documentParser.test.js`
- **Verify:** `npm test --prefix server -- tests/documentParser.test.js` (20 pass); `node server/scripts/enterpriseSmoke.cjs` (16/16)

---

## 2026-07-05 — Dev branch ship batch (finance, staging, enterprise)

- **Commits:** `b8ddb278` finance date extraction + reparse tooling; `155f934c` Clerk establish on preview + prod DB banner; `8e1ef30a` boot timeout AppErrorPage; `437c7bab` enterprise APIs + staging prod API/DB; `09a1ce8b` CSP blob frame-src; `e57875be` delegated task done by creator.
- **Branch:** `dev` → merged local `main` (not pushed per user request).

---

## 2026-07-05 — Agentic memory loop (read-first + sync-after-ship)

- **What:** `memory-first.mdc` always-on rule; `MEMORY_PROTOCOL.md`; `session-patterns.md`; `memory-sync` skill; `scripts/sync-agent-memory.mjs` (`memory:report` / `memory:stamp`); updated `AGENTS.md`, session-boot, INDEX, git-push.
- **Why:** User wants every agent chat to read `.specify/memory/` first and update memory after commits with patterns from prior chats.
- **Files:** `.cursor/rules/memory-first.mdc`, `.cursor/skills/memory-sync/`, `.specify/memory/MEMORY_PROTOCOL.md`, `.specify/memory/changelog/session-patterns.md`, `scripts/sync-agent-memory.mjs`, `AGENTS.md`
- **Patterns:** See `session-patterns.md` § 2026-07-05

---

## 2026-07-02 — Documentation reorganization + COREKNOT_MASTER page catalog

- **What:** Reorganized `docs/` into `reference/`, `operations/`, `architecture/`, `features/`, `auth/`, `archive/`. Merged Artist OS + Google OAuth docs. Added `docs/reference/COREKNOT_MASTER.md` (1,710 lines, all 120 page files with routes/hooks/APIs). Scripts: `generate-page-inventory.mjs`, `generate-master-doc.mjs`. README rewritten for engineers. Redirect stubs at legacy paths.
- **Why:** Single canonical product bible; reduce duplicate/outdated agent context.
- **Files:** `docs/**`, `README.md`, `.specify/memory/INDEX.md`, `scripts/generate-*.mjs`
- **Regenerate master:** `node scripts/generate-page-inventory.mjs && node scripts/generate-master-doc.mjs`

---

## 2026-06-27 — Attendance overview metric card layout

- **What:** `MetricCard` no longer stretches to full height by default (`fill` prop for grid use); attendance widget drops redundant period label and keeps metric + chart compact.
- **Why:** Dashboard attendance widget had huge empty gap — value pinned to bottom, chart clipped.
- **Files:** `client/src/components/ui/MetricCard.jsx`, `client/src/components/dashboard/AttendanceOverviewCard.jsx`
- **Branch:** `main` · **Commit:** `9d3ac3b8`

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
