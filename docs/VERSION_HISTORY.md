# Version History

Release notes for Taskmaster (CoreKnot). For setup and architecture, see [README.md](../README.md).

---

### [2026-05-30] v1.7.37 — Review Workflow, Calendar, Attendance & Gamification

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

### [2026-05-30] v1.7.36 — System Logs, Page Permissions, Backup & Artists Refactor

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

### [2026-05-30] v1.7.35 — Attendance Overhaul, Leaderboard Week & CRM Layout

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

### [2026-05-30] v1.7.34 — Campaign Metrics, Activity Stream & SMTP Resilience

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

### [2026-05-30] v1.7.33 — Filtered Campaign Resend & Tracking URL Fix

#### Filtered Resend (Campaign Details)
- **Resend [Filter]** button in Target Recipient Delivery Log — resend only to recipients matching the active status filter.
- Preview modal shows email HTML, new campaign title `{original} [{Filter}]`, sender selection, then creates a fresh campaign and queues jobs.
- New endpoint: `POST /api/campaigns/:id/resend-filtered`.

#### Open / Click / Unsubscribe Tracking
- Removed hardcoded fallback to suspended `taskmaster-api.onrender.com`; use `TRACKING_BASE_URL` or `APP_BASE_URL` via `server/utils/trackingUrls.js`.
- Unsubscribe links point to `FRONTEND_URL/unsubscribe` (not API); excluded from click-tracker wrapping.
- Unsubscribe token included in email URLs; legacy API `GET /unsubscribe` redirects to frontend.
- Vercel proxy updated to live API `taskmaster-jfw0.onrender.com`.

#### SMTP & Profiles (v1.7.32 carry-over)
- Multi-provider SMTP rotation with env credential precedence (Gmail, Brevo, SendGrid, Mailjet).
- Merge tags (`{{firstname}}`), variable fallbacks, raw HTML unsubscribe blocks.

---

### [2026-05-30] v1.7.32 — Mail Engine Production Fixes

#### Campaign Create (PayloadTooLargeError)
- Production clients should set `VITE_API_URL=https://taskmaster-api.onrender.com` to bypass Vercel's ~4.5MB proxy limit.
- Attachments upload separately via `POST /api/campaigns/upload-attachment` (multipart); create payload stores metadata only.
- Client-side ~3MB safe payload guard; template auto-save is non-blocking.
- Express returns **413** for oversized bodies instead of opaque 500.

#### Open / Click Tracking
- Fixed `ReferenceError: ip is not defined` in `track.js` (metrics now persist).
- Fixed duplicate `$inc` keys on MailCampaign open/click updates.
- Tracking base URL defaults to `https://taskmaster-api.onrender.com`; opt-in local via `TRACKING_USE_LOCAL=true`.
- Resend sends include `campaign_id` and `recipient_email` tags for webhook correlation.

#### SMTP & Signatures
- **Sender modes:** single profile, rotate pool, system Resend, system env SMTP.
- Provider presets (Gmail, Outlook, Yahoo, Zoho, Brevo, SendGrid, Custom) with daily limit defaults.
- Per-profile send usage meters on email page and profiles tab.
- Signature toggle, raw HTML textarea editor, server-side signature append fallback.

---

### [2026-05-29] v1.7.31 — Socket.IO Realtime, Department Permissions & UI Consolidation

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

### [2026-05-29] v1.7.30 — Dashboard Redesign, Notifications, PWA & Departments

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

### [2026-05-29] v1.7.29 — Announcement Dispatch Visibility + Professional Email Template
- Live email dispatch tracking on announcement cards (`queued`, `sending`, `completed`, `failed`).
- Manager-side delete via `DELETE /api/announcements/:id`.
- Branded announcement HTML template; queued background send with per-recipient tracking.
- Public open-tracking pixel endpoint.

### [2026-05-29] v1.7.28 — Exly Analytics, Gamification & Dev Stability
- Accurate paid vs free booking breakdown; shared revenue engine.
- Weekly XP breakdown endpoint; dashboard leaderboard drill-down.
- Graceful shutdown handlers; `juice` for HTML email inlining.

### [2026-05-28] v1.7.27 — Production Stability + Data Sync
- Fixed sidebar crash (missing `Terminal` icon import).
- Finance multi-upload batch strategy with retries.
- Production migration and finance sync scripts.

### [2026-05-28] v1.7.26 — Finance Ops + Admin Script Runner
- Admin Script Runner at `/admin/scripts`.
- Robust multi-file finance upload pipeline.
- Uppercase project name enforcement globally.

<details>
<summary>Earlier versions (1.7.25 and below)</summary>

See git history for full changelog through v1.7.21.

</details>
