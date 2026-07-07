# Version History

Release notes for CoreKnot (CoreKnot). For setup and architecture, see [README.md](../README.md).

## Versioning

**v1.0.7** is the current stable release (unified login). Tags **v1.0.5** and **v1.0.6** were retired — superseded by v1.0.7. All prior **v1.7.x–v1.9.x** entries were **beta** builds during private deployment.

---

### [2026-07-07] v1.0.7 patch — Tenant-safe gamification + platform admin recovery + legacy task route redirects

#### Routing & navigation
- **Legacy task-create redirects:** `/tasks/create` and `/tasks/:scope/create` now resolve to org-scoped todo (`/:orgSlug/todo`) with compatibility redirects in both flat and org-slug route trees.
- **Legacy tasks path redirect:** `/tasks/*` now passes through `LegacyOrgPathRedirect` for org-slug migration safety.

#### Gamification
- **Monthly snapshot model:** added `MonthlyLeaderboardSnapshot` (tenant-scoped) for persisted monthly leaderboard reads and month history.
- **Leaderboard endpoints:** `/api/gamification/leaderboard` now serves ranked snapshot entries; new `/api/gamification/leaderboard/history`; breakdown supports `monthStartKey`.
- **Progress payload cleanup:** removed level/step-XP fields from `/api/gamification/progress`; returns normalized XP + recalc metadata.
- **Admin recalculation payload/messages:** now XP-focused (no level-step wording), with cleaner config output.

#### Tenant isolation & auth resilience
- **Auth self-heal:** `authMiddleware` now calls `reconcilePlatformUserDepartment` to auto-fix missing admin department assignment for platform admins.
- **Membership utility:** `ensureMembershipForTenant(userId, tenantId)` exported for idempotent tenant membership guarantees.
- **Clerk org sync fallback:** if Clerk org slugs are disabled, tenant sync retries org creation without slug instead of failing tenant bootstrap.
- **Organization access resolution:** token org id now preferred over request body / pinned fallback.

#### Tenant bootstrap + legacy index compatibility
- **Bootstrap hardening:** tenant bootstrap now auto-recovers from stale global unique indexes (`workspaces.name_1`, `crmconfigs.configKey_1`) before retrying tenant-scoped upserts.

#### Operations scripts
- Added platform recovery/audit scripts:
  - `server/scripts/restorePlatformUserRoles.js`
  - `server/scripts/auditUserDepartments.js`
  - `server/scripts/auditTaskAssignmentsHealth.js`
  - `server/scripts/auditUserTaskScope.js`
  - `server/scripts/repairRaghavTaskAssignments.js`

---

### [2026-07-07] v1.0.7 patch — Org slug routes, TSC tenant sync, Clerk auth fixes

#### Multi-org & routing
- **Org slug URLs:** `/:orgSlug/*` workspace routes (`OrgSlugLayout`, `orgPaths.js`); bootstrap `GET /api/orgs/:slug/context`.
- **Feature unlocks:** `shared/orgFeatures.cjs`; create-org wizard + `PATCH /api/tenants/:id/features`.
- **Platform tenant:** Shakti Collective `slug: tsc`; `PLATFORM_TENANT_SLUG=tsc` on server/Render.

#### Local data
- **`npm run sync:prod-tenant-tsc`:** Prod → local for TSC only; skips Data Hub/Exly heavy data; finance folders + metadata (no file/OCR payloads).

#### Authentication
- **Clerk 401 loop:** No `setActive` on auth subdomain; establish tolerates client org-pin failure.
- **Clear cookies:** Always in auth legal footer row.
- **Dashboard:** Single onboarding checklist (`OrgOnboardingChecklist`); Clerk users skip forced password change modal.

**Ops:** Restart local API after tenant sync. See [`LOCAL_DEV_DATABASE.md`](operations/LOCAL_DEV_DATABASE.md).

---

### [2026-06-06] v1.0.7 — Unified device-agnostic login (current)

#### Authentication
- **Single API path:** Desktop and mobile both use same-origin `/api` in production (`apiBase.js`); removed device-based routing via `shouldUseSameOriginApi()` and deleted `apiProxyHealth.js` direct-API fallback.
- **Login gate:** `AuthContext.login()` requires successful `GET /api/auth/me` before `sessionReady`; fixes “logged in but no data” when cookie landed on wrong origin.
- **Simpler server session:** Removed sliding JWT refresh, token rotation, and Clerk dual-auth from `protect`; removed global legacy cookie purge middleware.
- **Realtime proxy:** Vercel rewrite for `/socket.io/*` so Socket.IO shares the frontend-domain session cookie.
- **Dev routing:** `npm run dev` always uses relative `/api` via Vite proxy (ignores production `VITE_API_URL` in `client/.env` for axios); fixes localhost login 401 when `.env` pointed at Render.

**Deploy:** Redeploy Vercel (frontend) and Render (API) together. Users on older login builds: tap **Clear session cookies** on `/login` once.

---

### [2026-06-06] v1.0.4 — Git history redaction complete & production hosts locked

#### Security & compliance
- **History rewrite:** `main` and `testing` force-pushed after `git filter-repo` blob redaction, mailmap, and commit-message callbacks. `npm run audit:history` passes — no original PII needles outside tooling paths.
- **Audit tooling:** `scripts/auditGitHistoryExposure.js` and `scripts/restoreAuditNeedles.js` hardened post-rewrite; mailmap flow documented in [`GIT_HISTORY_REDACTION.md`](GIT_HISTORY_REDACTION.md).
- **Exposure gate:** `npm run audit:exposure` remains required before every commit.

#### Production hosts
- **Local truth file:** `.cursor/production-hosts.local.json` (gitignored) — canonical Render API, Vercel frontend, OAuth redirects, webhooks, and derived env var names.
- **Committed template:** `.cursor/production-hosts.local.example.json` with `YOUR-*` placeholders only.
- **Cursor rule:** `.cursor/rules/production-hosts-locked.mdc` — agents must read local JSON; never guess or reuse legacy `CoreKnot-jfw0` hosts from old docs.

**Collaborators:** Re-clone or `git fetch && git reset --hard origin/main` after the rewrite. Rotate any credentials that ever appeared in old history.

---

### [2026-06-06] v1.0.3 — Data Master identity spine & Artist Path admin

#### Data Master
- **Person golden record:** `Person`, `PersonIdentifier`, `PersonCommunicationProfile`, `PersonSourceLink`, materialized `PersonHubView` for Data Hub list/counts.
- **Source facts:** Domain collections (`Lead`, `ArtistPathResponse`, `ExlyBooking`, `OutsourcedRecord`, `BookedCall`, `NewsletterSubscriber`) hold business data; identity fields deduped via `PersonIdentityService`.
- **Bootstrap:** `server/scripts/backfillPersonIds.js` on empty Person collection; optional `dedupePersonIdentities.js`.
- **Docs:** [`docs/DATA_MASTER_ARCHITECTURE.md`](DATA_MASTER_ARCHITECTURE.md), [`docs/INTEGRATION_DATA_CATALOG.md`](INTEGRATION_DATA_CATALOG.md).

#### Artist Path
- **Admin UI:** `/admin/artist-path` — card grid, HolySheet sync (`POST /api/artist-path/sync`), CSV import, profile slider with lazy Q&A.
- **Shared schema:** `shared/artistPathSchema.cjs` (Node) + `shared/artistPathSchema.js` ESM facade (Vite client).

#### Codebase hygiene
- Removed unused platform-settings routes, legacy OAuth controllers, dead dashboard widgets, duplicate utils, and orphaned models.
- `FullScreenWorkspace` component for immersive admin sliders.

#### Deploy
- **MCP:** `.cursor/mcp.json` — Render (`RENDER_API_KEY`) + Vercel OAuth via Cursor Settings.
- **CI:** `npm run ci` passes (199 server + 18 client tests, production build).

---

### [2026-06-06] v1.0.2 — Mobile login proxy fix & public-page theming

#### Authentication
- **Vercel API proxy:** `vercel.json` and `client/vercel.json` rewrite `/api/*` to live Render API via `RENDER_API_PROXY_URL` / `scripts/generateVercelConfig.js` (replaces stale proxy target). Mobile browsers route auth through same-origin `/api`; broken proxy caused login failures on phone/tablet while desktop direct API still worked.
- **render.yaml:** Keep-warm cron uses `YOUR-RENDER-SERVICE.onrender.com` placeholder — set real health URL in Render Dashboard.

#### Public marketing pages
- **MarketingThemeToggle:** Shared light/dark control on home (`LandingPage`), Privacy Policy, and User Data Deletion pages.
- **Privacy Policy v2.2 / Data Deletion v1.1:** Migrated from hardcoded dark palette to semantic theme tokens (`bg-background`, `bg-card`, `border-border`); `MarketingPageBackground` on legal pages.

**Deploy:** Set `RENDER_API_PROXY_URL` on Vercel, run `node scripts/generateVercelConfig.js`, redeploy frontend so `/api` rewrites hit the live API host.

---

### [2026-06-05] v1.0.1 — Sliding sessions & global cookie reset

#### Authentication
- **Sliding inactivity:** Sessions expire after **7 days without activity** (`JWT_EXPIRES_IN=7d`). Active users stay signed in — cookie re-issued on API traffic (throttled to once per hour via `JWT_REFRESH_MINUTES`).
- **Absolute cap:** Re-login required after **30 days** from first login in a session chain (`JWT_ABSOLUTE_MAX_DAYS=30`).
- **Cookie `coreknot_token_v3`:** Deploy bumps session cookie name — **one-time re-login on all devices**; legacy `coreknot_token_v2` / `coreknot_token` purged on every API response.
- **Server:** `server/utils/authSession.js` — `establishSession`, `refreshSessionIfDue`, `loginAt` preserved across slides.
- **Client:** `AuthContext` retries `/api/auth/me` before logout (Safari/iOS), 5-minute heartbeat, tab-visibility refresh.

**Deploy:** Redeploy API + client together. Set on Render: `JWT_EXPIRES_IN=7d`, `JWT_ABSOLUTE_MAX_DAYS=30`, `JWT_REFRESH_MINUTES=60`. All users must sign in once after deploy.

#### Post-v1.0.1 — Attendance reminder & login cookie refresh
- **6:30 PM IST check-out reminder:** `sendAttendanceCheckoutReminders` in `notificationService.js` — in-app + push to users without check-out; `actionUrl: /attendance`; weekends skipped; Redis lock per IST date.
- **Login one-time cookie clear:** `LoginPage.jsx` + `loginCookieRefresh.js` — single-use **Clear session cookies** button; `POST /api/auth/logout` + reload.

---

### [2026-06-04] v1.0.0 — First stable release

#### Finance (Documents)
- **Overview:** Four stat cards (Documents, Files, Invoices, Pending or Reimbursements); grey chart row removed from overview.
- **Layout:** `ListPageLayout` `toolbarFill` + `overviewSectionClassName` for aligned toolbar and overview spacing.

#### Office subscriptions
- **Spend cards:** Separate **Monthly Spend** and **Yearly Spend** (normalized periodicity); one-time charges excluded from recurring totals.

#### CRM leads
- **Pagination:** Default page size **5**.
- **Toolbar:** `toolbarFill` on list layout so filters span the row.

#### Exly offerings
- **List price:** `inferListPriceFromBookings` backfills `price` from paid booking mode when API returns 0 (e.g. heART of Music Composition → ₹4999).
- **Utils:** `parseExlyMoney`, `resolveOfferingPriceFromApi` in `exlyUtils.js`; sync no longer zeroes price from empty API fields.

Redeploy API + client together. No migration.

---

### [2026-06-04] v1.9.15 (beta) — Inbox clear, Todo sorting, attendance roster

#### Inbox
- **Clear all:** `DELETE /api/notifications` + **Clear all** button on `/inbox` (confirm dialog); **Mark all read** unchanged.

#### Todo & toolbar
- **Column sort:** All desktop table headers on `/todo` toggle asc → desc → off (Due defaults asc).
- **Toolbar alignment:** `SearchInput` toolbar label; `NexusDropdown` shows filter labels in toolbar row; controls bottom-aligned.

#### Attendance
- **`shared/attendanceExcludedUsers.js`:** Excludes Operations department, `redacted@example.com`, `redacted-staff@example.com`, and legacy test/demo names from ops attendance grid and check-in prompt. Work email `REDACTED_ADMIN@example.com` remains eligible unless explicitly listed.

Redeploy API + client together. No migration.

---

### [2026-06-04] v1.9.14 (beta) — Task Activity & Team Row UX

#### Task history
- **API:** `TaskActivityService.listActivity` sorts `createdAt` descending (newest first).
- **Client:** `taskActivityDisplay.js` — timeline panels filter to `created`, `assignment`, `message`; omit self-assignments and status/field-change noise.

#### Task detail header
- **Creator chip:** `taskAssigneeRows.js` prepends creator from `createdBy` with role `creator`; header locks removal and uses primary action color badge.
- **Assigner attribution:** “Assigned by” shown only when more than one distinct assigner exists on the task.

Redeploy API + client together. No migration.

---

### [2026-06-04] v1.9.13 (beta) — Mail Template Studio, Creator/Assignee Split & Email Pipeline

#### Mail Template Studio
- **Client:** `MailTemplateStudio.jsx` — Quill or raw HTML editor, indexed variables, server preview, draft → submit → admin approve/reject; embedded in refactored `AdminMailContent.jsx`.
- **API:** Extended `mailRoutes.js` — template CRUD, pending queue, submit/approve/reject, preview; `mailTemplateHelpers.js` migration + edit guards.
- **Indexed variables:** `indexedTemplateVariables.js` (client + server) — `{{1}}`, `{{2}}` tokens with HolySheet row mapping and dummy preview values.
- **Email pipeline:** `buildFinalEmailHtml.js` + `normalizeOutboundEmailHtml.js` — normalize → optional juice (raw HTML) → signature → footer → tracking; preview and live send share one path (tracking/geo logic unchanged per `EMAIL_ENGINE_LOCKED.md`).
- **Tests:** `server/tests/emailFlow.integration.test.js`; dev scripts `smokeEmailFlowLive.js`, `debugIndentHtml.js`.

#### Task creator vs assignee
- Creator on `task.createdBy` only — removed from `TaskAssignment` rows.
- `taskAccess.js` — `normalizeAssigneeIds`, `syncMentionAccessIds`, project scope checks; `mentionAccessIds` on `Task` model.
- `shared/taskReviewRules.js` + client mirror updated; `TaskService.js` / `taskController.js` use shared access helpers.
- **Migration:** `node server/scripts/migrateCreatorAssigneeSplit.js` (once per environment upgrading from pre-v1.9.13).

#### Auth & boot
- `setupAxiosInterceptors.js` — deferred global axios interceptors from `App.jsx`.
- `useAuthenticatedRealtime.jsx` — socket lifecycle extracted from `AuthContext.jsx`.

#### QA
- **Suite 5:** `qaSuite5Features.js` static checks for activity routes, mail HTML pipeline, creator/assignee split.
- **Excluded users:** `shared/qaExcludedUsers.js` — staff emails excluded from QA notification/email side effects.

Deploy API + client together. Run creator/assignee migration once on production if upgrading.

---

### [2026-06-04] v1.9.12 (beta) — QA Checklist Fixes

- **Login rate limit:** `authRoutes.js` `authLoginLimiter` `max: 10` everywhere (pre-deploy checklist + 11th-attempt 429 edge probe).
- **Project updates:** `updateProject` uses optimistic locking on `__v` — concurrent PUTs return **409** instead of silent double-apply.
- **QA probes:** `skipAuth` for unauthenticated oauth-readiness and login rate-limit tests; forgot-password pre-deploy check uses `pages/auth/*` paths; Lighthouse QA falls back to admin session cookie when `LH_*` login fails.

Redeploy API for rate limit + project PUT behavior. No DB migration.

---

### [2026-06-04] v1.9.11 (beta) — Task Activity, Attendance Prompt & Modal Fixes

- **Task activity:** `TaskActivity.js`, `TaskMentionReceipt.js`, `TaskActivityService.js`, `taskActivityPurgeWorker.js`; routes `GET/POST /api/tasks/:id/activity`; client timeline, compose, mention badges.
- **Task modal:** `TaskDetailModalHeader.jsx` + `taskAssigneeRows.js`; `resolvedTask = displayTask ?? task` prevents null `assignments` crash on reopen.
- **Attendance:** `UnifiedTimeCard` full-width single panel; `SelfMarkTimeControl` module-level; `AttendancePromptModal` secondary dismiss button.
- **Leaderboard:** unique React keys in recalc hover/breakdown lists.
- **QA/Lighthouse:** extended probes, `qaLighthouseRunner.js`, suite v19 hooks in pre-deploy checklist.

Deploy API + client together. MongoDB creates `taskactivities` / `taskmentionreceipts` on first write.

---

### [2026-06-03] v1.9.10 (beta) — Frontend Performance & Lighthouse Tooling

- **Audit scripts:** `client/scripts/lighthouse-audit.mjs`, `lighthouse-routes.mjs`; npm `lighthouse`, `lighthouse:public`, `lighthouse:prod`; reports gitignored under `client/lighthouse-reports/`.
- **Boot/shell:** `AppBootFallback.jsx`, lazy `MainLayout`, deferred SW + gamification socket; CSS sidebar (no Framer Motion in `OutletSidebar.jsx`).
- **Barrel split:** `charts.jsx`, `modals.jsx`; direct imports on heavy list pages.
- **Dashboard:** per-widget code splitting, phased mount, CLS-stable widgets, deferred attendance prompt modal.
- **Auth:** login limiter `max: 10` (all environments as of v1.9.12).

No server migration required. Redeploy client static host after merge.

---

### [2026-06-03] v1.9.9 (beta) — Google OAuth Session Fix & Meta Verification

- **OAuth ticket exchange:** `googleAuthCallback` redirects with `?ticket=`; `POST /api/auth/oauth-establish` sets session cookie via credentialed XHR.
- **Redirect URI:** `oauthEnv.js` + `GET /api/auth/google/redirect-uri` for console registration.
- **Meta data deletion:** webhook route + `MetaDeletionRequest` model; `GET /api/integrations/oauth-readiness`.
- **Docs:** `docs/GOOGLE_META_APP_VERIFICATION.md`, `server/.env.production.example`.

---

### [2026-06-03] v1.9.8 (beta) — Self-Service Password Reset

- **Client:** `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`; routes `/forgot-password`, `/reset-password`.
- **API:** `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (rate limit 5/hour per email).
- **Email:** `sendSystemEmail.js` via Gmail SMTP (`EMAIL_ADDRESS` / `EMAIL_PASSWORD`); CC `ADMIN_EMAIL`.

---

### [2026-06-03] v1.9.7 (beta) — Manual Office / WFH Attendance

- **WorkModeToggle.jsx:** user picks Office or WFH before mark-in/out; optional IP hint only.
- **API:** `GET /api/attendance/work-mode-hint`; `POST /api/attendance/check` accepts `workMode`; removed GPS waterfall.

---

### [2026-06-03] v1.9.6 (beta) — Workspace Member Roster & Access Filtering

- **projectAccess.js:** workspace/project access single source; filtered workspace list; 403 on unauthorized detail.
- **Roster:** `allMembers` on workspace GET — deduplicated users with per-project roles.

---

### [2026-06-03] v1.9.5 (beta) — Attendance Overview & Count-Based Backup Retention

- **Attendance Overview widget:** `GET /api/dashboard/attendance-overview?timeframe=7d|30d|90d`.
- **Backup retention:** `BACKUP_RETENTION_COUNT` (default `2`) replaces day-based pruning.

---

### [2026-06-03] v1.9.4 (beta) — Dashboard Widgets, Named Layouts & Backup Progress

- **Cards:** Leave Requests, Reimbursements, Last Backup widgets.
- **Layout library:** named dashboard presets with swap-on-drag.
- **Backup:** 202 + poll progress via `GET /api/data-hub/backup/progress`.

---

### [2026-06-03] v1.9.3 (beta) — Loading States, Mentions & Subscription Reminders

- **DataTable** spinner when `isLoading`; task modal pending states; multi-assignee subscription reminders.

---

### [2026-06-03] v1.9.2 (beta) — Nav Badges, PWA Desktop, Schedule Horizon & Task Filter

- **CountBadge** attention signals on sidebar/bottom nav; PWA desktop mode; 1–5 day schedule horizon; completed tasks visible 2 days only.

---

### [2026-06-03] v1.9.1 (beta) — Subtractive Slate UI & Email Design Alignment

- Flat slate shell, rule dividers, emerald/teal accents; email template styling aligned (tracking unchanged).

---

### [2026-06-02] v1.9.0 (beta) — Mobile UI, Project Analytics, Gamification & Chat Removal

- Mobile list kit rolled across CRUD pages; project analytics pages; chat module removed; gamification XP caps and attendance rules.

---

### [2026-06-02] v1.8.0 (beta) — Invoice Approval, Auth Cookie v2 & Unsaved-Changes UX

- Invoice/reimbursement submission + ops approval queue; `coreknot_token_v2` cookie; enhanced unsaved-changes bar with field diffs.

---

### [2026-06-02] v1.7.55 (beta) — CRM Phone Validation & QA Cleanup CLI

- Strict per-country phone validation; lead save cache fix; `qa:audit` / `qa:cleanup` CLI scripts.

---

### [2026-06-01] v1.7.50 (beta) — UX Clarity & QA Purge Extension

- Humanized labels across dashboard/CRM/inbox; extended QA purge for probe users and tasks.

---

### [2026-06-01] v1.7.49 (beta) — Attendance Office Detection Fix

- Office GPS radius 1000 m; merged `OFFICE_PUBLIC_IP` + `OFFICE_IP_WHITELIST`.

---

### [2026-06-01] v1.7.48 (beta) — QA v2 Engine & Security Hardening

- Extended QA suites, live HTTP probes, webhook HMAC enforcement, per-email login rate limits.

---

### [2026-05-31] v1.7.46 (beta) — Department Stats, Music Calendar & Data Hub Full Sync

- Dept stats widget; music calendar seed; Data Hub full reconcile button.

---

### [2026-05-31] v1.7.45 (beta) — Data Hub, Calendar Guards & Music Content Calendar

- Unified Data Hub CRM; past-date validation; musical_day calendar events; overdue notification cron removed.

---

### [2026-05-31] v1.7.44 (beta) — Notifications, Attendance UX & Admin Access

- Push dedupe; independent mark-in/out; admin route hardening.

---

### [2026-05-31] v1.7.43 (beta) — Admin Workspace Colors

- `WorkspaceColorPicker`; hex validation on workspace PATCH (admin-only color edits).

---

### [2026-05-31] v1.7.42 (beta) — Daily Logs, Projects UX & Per-User Workspaces

- Daily log task-completion entries; per-user workspace column order; removed six-project cap.

---

### [2026-05-31] v1.7.40 (beta) — Subscriptions, Workspace Settings & Dev Safeguards

- Office subscriptions module; workspace settings page; `.env.example` + `devEnvGuard.js`.

---

### [2026-05-31] v1.7.39 (beta) — Project Roles & Local DB Isolation

- Canonical admin/manager/member roles; `database.js` prod-like name guards.

---

### [2026-05-31] v1.7.38 (beta) — Website Book-a-Call Webhook

- Public book-call webhook with BullMQ queue and async rep assignment.

---

### [2026-05-30] v1.7.37 (beta) — Review Workflow, Calendar, Attendance & Gamification

#### Task Review Workflow (strict assigner-only)
- Shared rules: `shared/taskReviewRules.js` + client mirror — delegated assignments only enter review.
- Self-assigned tasks go straight to **done**; review queue excludes `userId === assignedBy`.
- Creator always persisted as assignee on task create; assigner-only approve/rollback.
- Migration: `server/scripts/migrateReviewWorkflow.js` (self-review cleanup + creator assignment backfill).
- Diagnostics: `listReviewTasks.js`, `cleanupReviewerTasks.js`, `cleanupTestTasks.js` (NEXUS/QUANTUM/VOID patterns).

#### Gamification
- Daily log XP (+20 configurable); task-completion XP removed from auto logs.
- Admin Gamification: Save button, layout fix, recalculate-from-config.
- `diagnoseGamification.js` script.

#### Calendar
- Event time picker; compact left-panel day list (title + time + type).
- Calendar events no longer invalidate task queries on save.
- `calendarEventTime.js` utilities.

#### Attendance
- Weekends + 2026 office holidays → **Holiday** (purple); manual leave → **Leave** (muted rose).
- Monthly grid uses pastel colors (no bright red-500).
- Edit modal closes automatically on Save.
- `officeHolidays.js` — 14 TSC office holidays for 2026.

#### New / key files
```text
shared/taskReviewRules.js
client/src/utils/taskReviewRules.js
client/src/utils/officeHolidays.js
client/src/utils/calendarEventTime.js
server/scripts/migrateReviewWorkflow.js
```

---

### [2026-05-30] v1.7.36 (beta) — System Logs, Page Permissions, Backup & Artists Refactor

#### System Logs & Observability
- Unified **SystemLog** model with severity (`INFO`/`SUCCESS`/`WARN`/`ERROR`) and module scoping (CRM, PROJECTS, EMAIL, BACKUP, etc.).
- Shared contract at `shared/systemLogContract.js`; client bridge in `systemLogBridge.js` + axios interceptors in `App.jsx`.
- Ops Logs page at `/management/ops-logs` with filters, trace drill-down, top-pages analytics, and admin sandbox.
- Trace middleware assigns request-scoped IDs; errors and API toasts emit structured log entries.

#### Department Page Permissions
- Departments store `pagePermissions` array and `permissionPreset` (admin, operations, sales, artist-management, standard).
- `PageRoute` component guards routes; `pagePermissions.js` on client and server.
- Migration script: `migrateDepartmentPagePermissions.js`.

#### Database Backup
- `databaseBackupService.js` streams prod collections to GridFS in `taskmaster_backups` (gzip NDJSON, 7-day retention).
- Render cron in `render.yaml` runs `runDailyBackup.js` at 12:01 AM IST; email notification on success/failure.
- Docs: `docs/DATA_BACKUP.md`; restore via `restoreBackupCollection.js`.

#### Artists Hub Refactor
- New `ArtistConnection` model replaces per-platform token sprawl; unified OAuth via `connectionService.js`.
- Extracted components: `AccountSwitcher`, `MetricChart`, `PlatformSummaryCards`, `UnifiedReachCard`, `AssetTable`.
- Meta Graph API service; artist enrichment pipeline.

#### Admin & Reports
- `DepartmentsPanel`, `MonthlyReportPanel`, `AggregatedMonthlyReportPanel`, `DailyLogsTable`.
- Removed legacy `AdminAudits.jsx` and `AdminLogsPage.jsx` in favor of System Logs.

#### Task & UX Improvements
- Task priority date helpers, pending-task skeleton, task cache utilities, `ProjectMultiSelect`.
- Page analytics tracker; calendar options constants; email validation utils.

---

### [2026-05-30] v1.7.35 (beta) — Attendance Overhaul, Leaderboard Week & CRM Layout

#### Attendance & Leaderboard
- Weekly leaderboard resets **Monday 00:00 IST** (Mon–Sun window via `getCurrentWeekRange()` in `server/utils/attendanceDate.js`); lifetime `User.exp` / level unchanged.
- Weekend Sat/Sun default **Leave** in ops grid (virtual, no DB row); users can check in to override; ops approve & lock.
- Removed **All Present** batch action; excluded test/Sandesh/Test Admin/QA Autonomous Engineer from attendance roster.
- Future date/time validation on check-in and ops upsert; check-out requires prior check-in.
- Ops grid: merged **Leave** / **Mark Present** / **Half Day** cells (single row); split to Time In/Out once times exist.
- **3-Day** vs **Full Week** view toggle in attendance header; admin **Reset All Attendance** button (`DELETE /api/attendance/reset`).
- New utils: `server/utils/attendanceUsers.js`, `client/src/utils/attendanceUsers.js`, IST helpers in `client/src/utils/attendanceUtils.js`.

#### UI Polish
- Dashboard: removed redundant page header for denser three-column layout.
- CRM Leads: search/filter bar left-aligned with stat cards.

#### Cleanup
- Removed unused `debugCampaignGeo.js` script; minor track/email processor tidy.

---

### [2026-05-30] v1.7.34 (beta) — Campaign Metrics, Activity Stream & SMTP Resilience

#### Accurate Campaign Stats
- Stat cards now derive from recipient status counts — **Unsubscribed no longer counted as Sent**.
- Added **Failed / Bounced** stat card; open/click rates computed from actual delivery states.
- Shared `server/utils/campaignStats.js` used by list and detail endpoints.

#### Live Activity Stream
- Failed sends and skipped (unsubscribed/bounced) recipients now log `Failed` / `Skipped` `MailEvent` rows.
- Activity stream displays error messages from `metadata.error` / `metadata.reason`.

#### SMTP Connection Timeout Fix
- Retry next rotation provider on connection timeout, not just auth errors.
- Automatic **Resend API fallback** when all SMTP providers fail and `RESEND_API_KEY` is set.
- Tuned nodemailer timeouts (`connectionTimeout`, `greetingTimeout`, `socketTimeout`).

---

### [2026-05-30] v1.7.33 (beta) — Filtered Campaign Resend & Tracking URL Fix

#### Filtered Resend (Campaign Details)
- **Resend [Filter]** button in Target Recipient Delivery Log — resend only to recipients matching the active status filter.
- Preview modal shows email HTML, new campaign title `{original} [{Filter}]`, sender selection, then creates a fresh campaign and queues jobs.
- New endpoint: `POST /api/campaigns/:id/resend-filtered`.

#### Open / Click / Unsubscribe Tracking
- Removed hardcoded fallback to suspended `CoreKnot-api.onrender.com`; use `TRACKING_BASE_URL` or `APP_BASE_URL` via `server/utils/trackingUrls.js`.
- Unsubscribe links point to `FRONTEND_URL/unsubscribe` (not API); excluded from click-tracker wrapping.
- Unsubscribe token included in email URLs; legacy API `GET /unsubscribe` redirects to frontend.
- Vercel proxy updated to live API `CoreKnot-jfw0.onrender.com`.

#### SMTP & Profiles (v1.7.32 carry-over)
- Multi-provider SMTP rotation with env credential precedence (Gmail, Brevo, SendGrid, Mailjet).
- Merge tags (`{{firstname}}`), variable fallbacks, raw HTML unsubscribe blocks.

---

### [2026-05-30] v1.7.32 (beta) — Mail Engine Production Fixes

#### Campaign Create (PayloadTooLargeError)
- Production clients should set `VITE_API_URL=https://CoreKnot-api.onrender.com` to bypass Vercel's ~4.5MB proxy limit.
- Attachments upload separately via `POST /api/campaigns/upload-attachment` (multipart); create payload stores metadata only.
- Client-side ~3MB safe payload guard; template auto-save is non-blocking.
- Express returns **413** for oversized bodies instead of opaque 500.

#### Open / Click Tracking
- Fixed `ReferenceError: ip is not defined` in `track.js` (metrics now persist).
- Fixed duplicate `$inc` keys on MailCampaign open/click updates.
- Tracking base URL defaults to `https://CoreKnot-api.onrender.com`; opt-in local via `TRACKING_USE_LOCAL=true`.
- Resend sends include `campaign_id` and `recipient_email` tags for webhook correlation.

#### SMTP & Signatures
- **Sender modes:** single profile, rotate pool, system Resend, system env SMTP.
- Provider presets (Gmail, Outlook, Yahoo, Zoho, Brevo, SendGrid, Custom) with daily limit defaults.
- Per-profile send usage meters on email page and profiles tab.
- Signature toggle, raw HTML textarea editor, server-side signature append fallback.

---

### [2026-05-29] v1.7.31 (beta) — Socket.IO Realtime, Department Permissions & UI Consolidation

#### Realtime
- Replaced Supabase Realtime with **Socket.IO** (`server/config/realtime.js`, `client/src/lib/realtime.js`).
- JWT-authenticated socket handshake; channel join with department/admin scope.
- Removed `@supabase/supabase-js` and legacy `supabase.js` config on client and server.

#### Access Control
- **Department-based permissions** via `departmentPermissions.js` (admin, sales, operations, artist-management slugs).
- Route guards (`AdminRoute`, `OpsRoute`, `ArtistRoute`) and `authMiddleware` use department slugs instead of legacy `role` strings.
- Migration script: `server/scripts/migrateRoleToDepartment.js`.

#### UI & UX
- Removed `CKDropdown`; consolidated on enhanced **NexusDropdown**.
- **ConfirmContext** + `globalConfirm` for imperative confirmation dialogs.
- Streamlined **ToastContext**; settings page layout refresh.
- Task modals/forms: improved `TaskFormFields`, create/detail flows, schedule skeleton loading.
- Project views: Kanban, list, detail, and `ProjectsView` polish; workspace color utilities expanded.

---

### [2026-05-29] v1.7.30 (beta) — Dashboard Redesign, Notifications, PWA & Departments

#### Dashboard
- Rebuilt dashboard as three-column layout: leaderboard + announcements + pin board + schedule (left), todos + projects today (center), private notes + pin composer (right).
- Added `LeaderboardPodium`, `TodosTodayCard`, `ProjectsTodayCard`, `NotesPanel`, `PinBoardMessages`, `PinBoardComposer`.
- Pin board CRUD via `/api/pinboard`; private notes via `/api/notes`.

#### Notifications & Inbox
- New `/inbox` page with category filters, actor avatars, and action URL deep links with flash highlight.
- `NotificationBridge` for push permission + subscription lifecycle.
- `notificationDispatcher` service: in-app + email + web push tri-channel delivery.
- Branded HTML template at `server/templates/notification.html`.
- Sidebar status badges from `/api/notifications/status-counts`.

#### PWA
- `vite-plugin-pwa` with injectManifest service worker (`client/src/sw.js`).
- `manifest.json`, 192/512 icons, install banner, app shortcuts.
- Icon generator script: `npm run generate-icons`.

#### Departments & Scheduling
- `Department`, `TaskType`, `DepartmentChangeRequest` models with seed script.
- Signup department selection; admin approve/reject change requests.
- `/schedule` page with `ScheduleGrid` — department/project workload by date slot.
- Task fields: `scheduleSlot` (AM/PM/FULL), `scheduleDate`, `type`.

---

### [2026-05-29] v1.7.29 (beta) — Announcement Dispatch Visibility + Professional Email Template
- Live email dispatch tracking on announcement cards (`queued`, `sending`, `completed`, `failed`).
- Manager-side delete via `DELETE /api/announcements/:id`.
- Branded announcement HTML template; queued background send with per-recipient tracking.
- Public open-tracking pixel endpoint.

### [2026-05-29] v1.7.28 (beta) — Exly Analytics, Gamification & Dev Stability
- Accurate paid vs free booking breakdown; shared revenue engine.
- Weekly XP breakdown endpoint; dashboard leaderboard drill-down.
- Graceful shutdown handlers; `juice` for HTML email inlining.

### [2026-05-28] v1.7.27 (beta) — Production Stability + Data Sync
- Fixed sidebar crash (missing `Terminal` icon import).
- Finance multi-upload batch strategy with retries.
- Production migration and finance sync scripts.

### [2026-05-28] v1.7.26 (beta) — Finance Ops + Admin Script Runner
- Admin Script Runner at `/admin/scripts`.
- Robust multi-file finance upload pipeline.
- Uppercase project name enforcement globally.

<details>
<summary>Earlier versions (1.7.25 and below)</summary>

See git history for full changelog through v1.7.21.

</details>
