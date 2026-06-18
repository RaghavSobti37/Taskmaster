# Recent changes

Session deltas appended by `/git-push` and agent ship workflows. Newest first.

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
