# Recent Changes

> Updated each push-and-document session. Full version history: `docs/VERSION_HISTORY.md`

---

## 2026-06-11 � Raw HTML mail template inline images

- **Request:** Upload and embed inline `<img>` in raw HTML email templates through editor ? approval ? campaign send
- **Root cause:** No upload path or insert UX in Mail Template Studio raw HTML mode; send pipeline had no img URL normalization
- **Fix:** `mailTemplateImageUploader` (Uploadthing); `MailTemplate.assets[]`; Insert Image button + gallery in `MailTemplateStudio.jsx`; Quill image toolbar parity; `ensureAbsoluteImageUrls` in `buildFinalEmailHtml.js`
- **Verify:** `npx jest tests/emailFlow.integration.test.js --testNamePattern=buildFinalEmailHtml`; `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 � Campaign recipient delivery log CSV export

- **Request:** Download CSV of filtered campaign recipients (name, phone, email) from delivery log tabs
- **Root cause:** No export path existed; paginated table only showed current page; `unsubscribed` filter missing from server status groups
- **Fix:** `GET /api/campaigns/:id/recipients/export` with shared `campaignRecipientExport.js` helper; Download CSV button on `CampaignDetails.jsx`; added `unsubscribed` to `RECIPIENT_STATUS_GROUPS`
- **Verify:** `npx jest tests/campaignRecipientExport.test.js`; `npm run build --prefix client`; `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 � Remove duplicate registered location chart on campaign details

- **Request:** Campaign analytics showed two registered-location charts; remove top standalone duplicate
- **Root cause:** `CampaignDetails.jsx` rendered `RegisteredLocationBarChart` twice � once full-width above toolbar, again in bottom grid as breakdown
- **Fix:** Removed top `RegisteredLocationBarChart` (`title="Registered location"`); kept Engagement Over Time + Registered location breakdown pair
- **Verify:** `npm run build --prefix client`; `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 � Open task assignment (any user ? any tenant user)

- **Request:** Anyone can assign tasks to anyone; assigner becomes `createdBy`; drop project-role gate for assignment
- **Root cause:** `canAssignTasks` required admin/manager/artist_management; `assertAssigneesInTaskScope` required project membership
- **Fix:** `assertAssigneesAreTenantUsers` in `taskAccess.js`; removed role gate in `TaskService`; reassign sets `createdBy` to assigner; task create modal uses full user directory
- **Verify:** `npx jest tests/taskAssigneeScope.test.js tests/taskReview.test.js`; `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 - Cursor agent rules and repo skills

- **Rules:** `backend-standards`, `component-standards`, `frontend-design`, `minimal-production-fix`, `no-plan-edits`, `pagination-default-10`, `rbac-defense`, `react-query-errors`, `tenant-security-guard`, `zero-fluff-data` under `.cursor/rules/`
- **Skills:** `coreknot-session-boot`, `failure-modes-map`, `prod-data-sync`, `rbac-audit`, `resend-email-debug` under `.cursor/skills/`
- **Verify:** `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 - Artist Workspace phases 4-7 + overview

- **Overview:** Shared `ArtistOverviewPanel` on Artist OS command center and workspace home (KPI strip, alerts, quick links).
- **Phase 4:** Content hub assets + release tracker CRUD (`ArtistContentTab`, `ArtistReleasesTab`, `ArtistReleaseCampaign` / `ArtistAsset` APIs).
- **Phase 5:** Booking pipeline widgets (`ArtistBookingsTab`, inquiries) + finance tab summaries (`ArtistFinanceEntry`).
- **Phase 6:** Portfolio dashboard KPIs, rankings, alerts (`PortfolioDashboard` + `artistOsService` portfolio endpoints).
- **Phase 7:** Public profile polish (`ArtistPublicProfile`) + slug editor in workspace settings.
- **Tests:** `server/tests/artistWorkspace.test.js`; updates to `artistPortfolioPublic`, `artistRouteAccess`, `artistOs` suites.
- **Verify:** `npm test --prefix server -- artistWorkspace artistPortfolioPublic artistRouteAccess artistOs`; `npm run audit:exposure`; `npm run audit:deadcode`

---
## 2026-06-11 � Connection hub socials RBAC alignment

- **Gap:** `tracked-video` + `setPrimaryConnection` used `artistOrAdmin`; hub/sync used `artistMembershipAccess('socials')`
- **Fix:** Both endpoints now use `artistMembershipAccess('socials')`; added `mailTemplateAccess.test.js` + connection hub route tests
- **Verify:** `npx jest mailTemplateAccess connectionProvider artistMembership`; audits pass

---

## 2026-06-11 � Mail template submit RBAC regression

- **Error:** `Not authorized � page access required` on `POST /api/mail/templates/:id/submit` (TraceID f02378db-25d9-42f4-916f-4f2f6e9bcf7a)
- **Root cause:** d1857129 added `requirePageAccess('emails')` on mail template routes and removed the Jun 4 universal `emails` bypass � users with custom department pagePermissions (no `emails` key) hit 403 on submit
- **Fix:** Restored `hasPageAccess('emails')` universal grant for any authenticated user on client + server; updated `mailTemplateApprovers.test.js`
- **Verify:** `npx jest mailTemplateApprovers.test.js`; `npm run audit:exposure`; `npm run audit:deadcode`

---

## 2026-06-11 � Vercel installCommand fix

- **Root cause:** Vercel Root Directory `client/` � old `installCommand` called `node ../scripts/generateVercelConfig.js` ? file not found ? exit 127
- **Fix:** Canonical generator at `client/scripts/generateVercelConfig.cjs`; `vercel.json` / `client/vercel.json` / `client/package.json` scripts updated; root `scripts/generateVercelConfig.js` delegates to `.cjs`
- **Deploy:** Set `RENDER_API_PROXY_URL` on Vercel; script writes `/api` + `/socket.io` rewrites at install time
- **Fallback:** On Vercel without env, keeps committed `client/vercel.json` when rewrites already valid; root `scripts/generateVercelConfig.cjs` wrapper for monorepo-root installs
- **Install root cause:** Monorepo `prepare: husky` ran during Vercel workspace install before husky on PATH � fixed via `scripts/prepare.js` (skip when `VERCEL`/`CI`/`HUSKY=0`) + `HUSKY=0` in installCommand
- **NestJS:** `server-nest/dist/` gitignored (prior commit)

---

## 2026-06-11 � Access control, error UX, Artist OS

- **Page permission API gates:** Mail, admin, workspace, CRM, proxy, and related Express routes enforce department pagePermissions (aligned with client hasPageAccess / navPageAccess).
- **QueryErrorBanner:** Rolled out on query-driven pages for consistent failure states and retry actions.
- **CRM:** Lock parity and scoped delete; sales reps can see legacy leads missing crmType.
- **Tenant security:** Partial hardening on tenant-scoped operations (see auth/security.md).
- **Artist OS:** Tabbed artist workspace, React Query hooks (artistOs.js), team access utilities.
- **Assets / nav:** Assets hub RQ loaders; navigation respects page permissions.
- **Tests:** Vitest for ForcePasswordChangeGate, QueryErrorBanner, query defaults, artist OS shell, login return path, session merge; server tests for gates.
- **Audits:** audit:exposure allows YOUR-PRODUCTION-API placeholders in *.example env templates.

## 2026-06-10 � Memory restructure

- Reorganized `.specify/memory/` into component folders with `INDEX.md` + `MASTER.md`
- Removed duplicate `agentic_memory/` and stale flat memory files
- Component docs: platform, architecture, frontend, backend, auth, features, operations, changelog

---

## 2026-06-10 � Supabase IPv4 fix for Render

- **Root cause:** `db.*.supabase.co` direct Postgres is IPv6-only; Render outbound is IPv4 ? `ENETUNREACH`
- **Fix:** `SUPABASE_PG_MODE=rest` on Render. Runtime metadata writes use PostgREST (`restQuery.js`)
- **Files:** `server/services/supabase/restQuery.js`, `backupStore.js`, `snapshotStore.js`, `mailRollupStore.js`, `batchInsert.js`, `logStore.js`, `syncService.js`, `health.js`, `config/supabase.js`
- **Render:** `render.yaml` sets `SUPABASE_PG_MODE=rest` + `SUPABASE_SECRET_KEY` on API, staging, backup cron

---

## 2026-06-10 � Supabase secondary store & backup migration

- Supabase Postgres + Storage offloads logs, audits, rollups, CRM snapshots, production backups from Atlas M0
- Mongo primary for live CRM/email; mirrors async; GridFS purged after successful Supabase dump
- Verified locally: `npm run backup:verify-supabase`

---

## 2026-06-10 � Mobile login stable

- Committed `client/vercel.json` rewrite + proxy health fallback
- Phone/PWA: same-origin `/api/*` via Vercel rewrite
- Fallback: `apiProxyHealth.js` + `loginRequest.js` ? direct `VITE_API_URL` if proxy 404
- Smoke: `npm run verify:mobile-proxy` ? 200 on `/api/health`

---

## v1.0.7 (current release)

- Unified same-origin `/api` on every device
- Login gated on `/api/auth/me`
- `/socket.io` Vercel rewrite
- Local dev always uses Vite proxy
