<p align="center">
  <img src="client/public/brand-mark.svg" alt="CoreKnot Logo" width="80" height="80" />
</p>

<h1 align="center">CoreKnot</h1>

<p align="center">
  <strong>Enterprise CRM & Operations Hub</strong><br/>
  An ultra-high-density operational platform integrating project execution, automated sales pipelines, robust finance operations, and real-time team gamification—explicitly engineered for agency workflows.
</p>

<p align="center">
  <a href="#logo-philosophy--the-harmonic-frequency">Logo</a> ·
  <a href="#key-features">Features</a> ·
  <a href="#architecture--tech-stack">Architecture</a> ·
  <a href="#directory-structure">Directory Structure</a> ·
  <a href="#quick-start-guide">Quick Start</a> ·
  <a href="#environment-configuration">Configuration</a> ·
  <a href="#api-architecture--routing">API Surface</a> ·
  <a href="#diagnostic--observability-protocol">Diagnostics</a> ·
  <a href="docs/VERSION_HISTORY.md">Release Notes</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-126d5e?style=flat-square" alt="Version 1.0.0" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/mongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/PWA-enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## Executive Summary

CoreKnot (branded natively as **CoreKnot** within its Progressive Web App shell) is a decoupled, multi-tenant operational workspace designed to strip out project management overhead. It streamlines complex business lines—such as financial document optical character recognition (OCR), multi-channel customer relationship management (CRM) ingestion, and department-aware workforce scheduling—into a unified, high-density dashboard.

### Core Ecosystem Primitives

* **Decoupled Architecture:** Vite-optimized React Single Page Application (SPA) paired with a high-performance Express REST API layer.
* **Resilient Infrastructure:** Integrated Redis task queues (`BullMQ`), state-driven orchestration (`Trigger.dev`), real-time bidirectional state syncing (`Socket.IO`), and an autonomous system-health blocking middleware.
* **Strict Review Pipelines:** Institutional task governance rules separating individual contributions from multi-tiered peer review workflows.

---

## ◎ Logo philosophy — The Harmonic Frequency

The CoreKnot mark — **The Harmonic Frequency** — is the visual spine of the product. It is not decorative typography; it is a diagram of how **The Stage Company (TSC)** operates as one organism made of six distinct lines of business.

### Six spokes, six segments

The logo is built from a **central hub** and **six hand-drawn spokes** radiating outward. Each spoke stands for one TSC segment that CoreKnot unifies in a single workspace:

| Spoke | TSC segment | Role in the ecosystem |
|:---|:---|:---|
| 1 | **TSC Films** | Long-form and campaign film production, delivery, and client pipelines |
| 2 | **TSC Artists** | Talent, creators, and representation tied to projects and bookings |
| 3 | **TSC Academy** | Training, cohorts, and learner journeys (offerings, attendance, progress) |
| 4 | **TSC Collabs** | Brand partnerships, co-productions, and cross-team initiatives |
| 5 | **TSC Studios** | Studio operations, assets, subscriptions, and production infrastructure |
| 6 | **TSC Corporate** | Finance, HR, legal, admin, and group-wide governance |

Nothing in the mark is arbitrary: the **hub** is the shared operational truth (tasks, CRM, finance, schedule, inbox) that every segment plugs into. The **spokes** are the six ways TSC touches the world; CoreKnot’s job is to keep them **aligned**, not siloed.

### Bringing together, not blending away

The philosophy is **convergence without erasure**:

- Each segment keeps its identity (Films ≠ Academy ≠ Corporate).
- The platform is the **frequency** that lets them move in phase — shared data, shared people, shared deadlines — without forcing one department’s workflow onto another.
- The six-fold symmetry signals **equal weight**: no spoke is “the main business”; Corporate is as present as Films when you stand at the center.

That is why the loader ripples **outward from the hub**: work originates at the center (the dot) and propagates through the rings as activity crosses segments — inner waves first, then the next layer, in steady cadence.

### Brand presentation (locked)

- **Mark:** white Harmonic Frequency on **brand green** (`#126d5e`) shell in the app; geometry and proportions are locked (see `docs/LOGO_LOCKED.md`).
- **Motion:** default loading indicator is the **Uniform Calm** fluid-ribbon cascade (`frl-v-02`), echoing the same hub-born ripple idea.
- **Voice:** loading states use rotating human phrases (never generic “Loading…”) — the product should feel alive, not like enterprise shelfware.

> *If you change the logo or loader behavior, treat it as a brand decision, not a casual UI tweak.*

---

## Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                     React SPA (Vite + PWA)                      │
│  Dashboard │ Projects │ CRM │ Finance │ Inbox │ Schedule │ Admin│ Data Hub │
│            TanStack Query  │  Service Worker (sw.js)            │
└────────────────────────────┬────────────────────────────────────┘
                             │  Secure HTTP / WSS (/api/*)
┌────────────────────────────▼────────────────────────────────────┐
│                    Express API (server.js)                      │
│  Auth │ Tasks │ Projects │ CRM │ Notifications │ Departments   │
│  PinBoard │ Notes │ Schedule │ Finance │ Gamification │ Mail    │
│  SystemHealthService │ Rate Limiting │ Gzip │ Helmet            │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
   MongoDB        Redis/BullMQ   Socket.IO     External APIs
   (Mongoose)     (queues)       (realtime)    (Exly, Resend, Google…)
```

### Infrastructure Layer Spec

| Layer | Component | Implementation |
|:---|:---|:---|
| **Frontend** | UI Shell & State | React 18, Vite 5, Tailwind CSS v4, TanStack Query, Framer Motion |
| **Backend** | API Engine | Node.js, Express, Mongoose ODM, BullMQ, Trigger.dev |
| **Data & Cache** | Storage Engine | MongoDB Atlas, Redis (asynchronous queues & cache clusters) |
| **Realtime** | Transport Layer | Socket.IO WebSockets with automatic fallback protocols |
| **Security** | Authentication | HttpOnly JWT cookie (`coreknot_token_v2`), Google OAuth 2.0, RBAC, webhook HMAC, registration lockdown |
| **Deployment** | CI/CD Infrastructure | Render (Web Services + Managed Static CDN handles asset distribution) |

---

## Key Features

### v1.0.0 stable polish

* **Finance overview:** Stat cards for documents, files, invoices, and pending reimbursements; overview charts removed for a cleaner documents hub.
* **Subscriptions:** Separate monthly and yearly spend totals from recurring periodicity (one-time excluded).
* **Leads:** Default table page size 5; full-width filter toolbar on list pages.
* **Exly list price:** Paid-booking mode backfills offering `price` when the API returns zero.
* **Attendance hours vs logs:** Time card shows **Worked** (check-in → check-out) and **Not logged** when `(worked − 1h lunch) − daily logs` is ≥ 30 minutes. All `DAILY_LOG` types count (manual, task completion, review). Metrics refresh on fetch, log CRUD, and task completion — shared formula in `shared/attendanceMetrics.js`; `server/utils/refreshAttendanceMetrics.js`.

### Mail Template Studio & Outbound HTML Pipeline

* **Template studio:** Admin mail surfaces embed `MailTemplateStudio.jsx` — visual or raw HTML editor, indexed merge tokens (`{{1}}`, `{{2}}`), server-side preview, draft → submit → admin approve/reject workflow.
* **Indexed variables:** `indexedTemplateVariables.js` (client + server) maps HolySheet columns to numbered tokens with dummy preview values for QA and design review.
* **Unified send path:** `buildFinalEmailHtml.js` + `normalizeOutboundEmailHtml.js` normalize Quill/raw HTML, inline CSS when needed, append signature/footer, then hand off to the locked tracking layer — preview and live send share one pipeline.
* **Template API:** Extended `/api/mail/templates` routes for CRUD, pending queue, preview, and approval actions (`mailTemplateHelpers.js`).

### Task Creator vs Assignee Split

* **Data model:** Task creator lives on `task.createdBy` only — never duplicated in `TaskAssignment`; assignee chips and review rules use assignees exclusively.
* **Mention access:** `mentionAccessIds` on tasks plus `taskAccess.js` keeps @mentioned users in scope without treating the creator as an assignee.
* **Migration:** One-time `node server/scripts/migrateCreatorAssigneeSplit.js` removes legacy creator rows from assignments and backfills mention access.

### Task Activity Timeline & Mentions

* **Per-task conversation:** `TaskDetailModal` splits into header, compose, history, and activity timeline — `@mentions` in messages with unread badges (`TaskMentionBadge.jsx`) and server-side receipt tracking (`TaskMentionReceipt.js`).
* **Activity API:** `GET/POST /api/tasks/:id/activity` records `created`, `assignment`, `message`, `status_change`, and `field_change` events (`TaskActivity` model, `TaskActivityService.js`); list returns **newest first**; background purge worker trims old rows.
* **History UI filter:** `taskActivityDisplay.js` shows only `created`, `assignment`, and `message` in timeline panels — hides status/field edits and self-assignments so the feed reads like a conversation.
* **Modal stability:** `buildTaskAssigneeRows` guards null tasks; header uses `displayTask ?? task` so reopening a task after a cold mount no longer crashes on `assignments`.
* **Team row:** Creator appears as a locked **Creator** chip (distinct from assignees); assignees show **Assigned by** only when multiple people assigned the task; creator is never duplicated as an assignee chip.

### Attendance Prompt UX (v1.9.11)

* **Full-width time card:** Single-panel `UnifiedTimeCard` no longer uses `max-w-md` — Time In/Out aligns with the Office/WFH toggle width in the morning prompt modal.
* **Time input fix:** `SelfMarkTimeControl` moved to module scope so typing multi-digit minutes in Chrome/Edge no longer remounts the native `type="time"` field each keystroke.
* **Dismiss control:** “Remind me later” is a full-width secondary button instead of ghost text.

### Leaderboard Recalc UI (v1.9.11)

* **React keys:** Recalc change lists in `LeaderboardRecalcHint` and `LeaderboardBreakdownModal` include index + delta so duplicate XP rows (e.g. multiple `COMPLETE_TASK` adjustments) no longer warn in the console.

### Frontend Performance & Lighthouse Auditing (v1.9.10)

* **Route-level Lighthouse runner:** `client/scripts/lighthouse-audit.mjs` audits 45 app routes (public + authenticated), writes HTML/JSON reports to `client/lighthouse-reports/` (gitignored). Scripts: `npm run lighthouse`, `lighthouse:public`, `lighthouse:prod`.
* **Prod benchmark workflow:** `npm run build && npm run preview` then `LH_BASE_URL=http://localhost:4173 npm run lighthouse -- --prod` — dev `:5173` scores are not representative (unminified ESM, HMR).
* **Auth for protected routes:** set `LH_EMAIL` / `LH_PASSWORD` (or `LH_COOKIE`); QA Lighthouse runner falls back to admin JWT cookie when env login fails. Login rate limit: **10 attempts / 15 min** (all environments).
* **Boot path:** Removed global auth skeleton gate in `App.jsx`; `AppBootFallback` + lazy `MainLayout`; deferred PWA service worker registration and gamification socket via `requestIdleCallback`.
* **UI barrel split:** Heavy chart/modal exports moved to `components/ui/charts.jsx` and `modals.jsx`; list pages use direct imports to avoid pulling Recharts on every route.
* **Dashboard:** Per-widget code splitting (`dashboardWidgetLoaders.js`), two-phase widget mount (priority → idle secondary → analytics/recharts), no preset skeleton block, stable widget min-heights for CLS, deferred `AttendancePromptModal` and `TaskCompletionModal`.
* **Shell:** `OutletSidebar` uses CSS transitions instead of Framer Motion; sidebar status queries deferred on idle; extracted `useStatusCounts` / `useNavbarPreferences`.
* **Data overview charts:** `DataOverviewSection` renders stats first; charts load after `IntersectionObserver` + idle callback.
* **Vite:** Manual chunks for `framer-motion`, `socket.io`, `@xyflow/react`, `mermaid`; Geist variable font via `@fontsource-variable/geist`.

### Google OAuth & Meta App Verification (v1.9.9)

* **Cross-origin Google login fix:** OAuth callback issues a short-lived ticket; `GoogleSuccessPage` calls `POST /api/auth/oauth-establish` so the session cookie is set in the browser’s frontend context (fixes 401 loops after Google sign-in on Vercel + Render).
* **Redirect URI resolution:** `server/utils/oauthEnv.js` derives callback URLs from request host / `APP_BASE_URL` — register `http://localhost:5000/api/auth/google/callback` and your Render API host in Google Cloud Console.
* **Diagnostics:** `GET /api/auth/google/redirect-uri` returns the exact redirect URI the server will send to Google.
* **Meta compliance:** `POST /api/webhooks/meta-data-deletion` (signed_request), `MetaDeletionRequest` model, status lookup on `/userdata?code=…`; admin readiness probe `GET /api/integrations/oauth-readiness`.
* **Docs:** [`docs/GOOGLE_META_APP_VERIFICATION.md`](docs/GOOGLE_META_APP_VERIFICATION.md) — env audit, console URLs, manual test matrix before App Review.
* **Templates:** `server/.env.production.example` — production OAuth/integration env checklist (no secrets).

### Self-Service Password Reset (v1.9.8)

* **Login entry point:** “Forgot password?” on `/login` opens `/forgot-password` — same CoreKnot marketing shell as sign-in.
* **Email flow:** User submits account email; if it exists, the API sends a 1-hour reset link via **Gmail SMTP** (`EMAIL_ADDRESS` / `EMAIL_PASSWORD` / `EMAIL_SERVICE`) and CCs `ADMIN_EMAIL` for audit visibility.
* **Reset page:** `/reset-password?token=…` — new password + confirm, live strength checklist, then redirect to login.
* **API:** `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` — hashed reset tokens on `User`, rate-limited (5/hour per email), generic responses to avoid email enumeration.
* **Utility:** `server/utils/sendSystemEmail.js` — transactional system mail separate from campaign Resend pipeline (avoids unverified `SYSTEM_VERIFIED_FROM_EMAIL` domain failures in dev).

### Manual Office / WFH Attendance (v1.9.7)

* **User-controlled work mode:** Self check-in/out uses a single **Office ↔ WFH** toggle (`WorkModeToggle.jsx`) above Time In/Out — default **Office**, tap to swap; no GPS on mark.
* **IP hint only:** `GET /api/attendance/work-mode-hint` suggests the initial toggle from office egress IP (`OFFICE_PUBLIC_IP` / `OFFICE_IP_WHITELIST`); user choice is always sent on save.
* **Server:** `POST /api/attendance/check` accepts `workMode` (`office` | `wfh`), stores `verificationMethod: MANUAL`; removed GPS/IP auto-assignment waterfall and `_attendanceDiagnostic`.
* **Surfaces:** Dashboard `MarkAttendanceCard`, `/attendance`, and morning attendance prompt modal — all pass `workMode` without geolocation.
* **Ops modals:** System Logged shows time only; work mode uses the same toggle; tighter modal body spacing (`bodyClassName` on `NexusModal`).

### Subtractive Slate UI (v1.9.1)

* **Design language:** Flat slate surfaces (`#0f172a` shell, `#1e293b` cards), minimal borders, no heavy shadows on static surfaces, emerald/teal accents (`#126d5e`, `#2dd4bf`), Geist/system sans typography.
* **Dashboard widgets:** Shared `DashboardWidgetShell`, `ChartSurface`, `DeltaBadge`, and `DataListRow` primitives; leaderboard podium/card refresh; new `MarkAttendanceCard`.
* **Todo cards:** Subtle priority gradients on today/overdue widgets; rule-divider layout replaces drop shadows per `index.css` shadow policy.
* **Profile settings:** Fixed profile tab save/display regressions; consistent form field styling with the subtractive shell.
* **Email templates:** Marketing, newsletter, session-reminder, notification, announcement, CRM, calendar, subscription, and backup emails aligned to the same slate tokens (styling only — tracking/geo/HolySheet logic unchanged).

### Dashboard Widgets & Layout Library (v1.9.5)

* **Attendance Overview card:** Multi-series line chart (marked, present, half day, leave) with 7d / 30d / 90d timeframe; `GET /api/dashboard/attendance-overview` aggregates unique people per IST day (ops/admin).
* **Task Activity chart:** Renamed from “Team Activity”; chronological area chart with correct day ordering and “Tasks” series labels.
* **Last Backup card (admin):** Highlights latest snapshot plus a **Recent snapshots (last 2)** list; aligns with count-based retention below.
* **Backup retention:** `BACKUP_RETENTION_COUNT` (default `2`) replaces day-based pruning; `render.yaml` cron sets `BACKUP_RETENTION_COUNT=2`.

### Dashboard Widgets & Layout Library (v1.9.4)

* **Leave Requests card:** Ops sees pending leave awaiting approval; everyone else sees their own submissions — links to Attendance or Settings → Leave.
* **Reimbursements card:** Personal reimbursement claims from Settings → Reimbursement with status, amount, and project; shared `useMyReimbursements` hook powers dashboard + Invoice tab.
* **Last Backup card (admin):** Latest successful production snapshot with **Run** trigger and live progress bar via `GET /api/data-hub/backup/progress`.
* **Async backup API:** `POST /api/data-hub/backup` returns **202** immediately; client polls progress until complete (fixes Render timeout on long dumps).
* **Named layouts:** Settings → Dashboard customization saves named layouts into a personal library (`DashboardPreset.presets[]`); **My layouts** dropdown reloads saved grids; drag-and-drop swaps widgets instead of auto-repacking neighbors.
* **Component registry:** `last-backup` admin widget; centralized `VALID_DASHBOARD_COMPONENT_IDS` in `dashboardComponents.js`.
* **Render cron:** Daily backup job documents required env vars (`MONGODB_URI_PROD`, `RESEND_API_KEY`, `ADMIN_EMAIL`, `BACKUP_FROM_EMAIL`).

### ⏳ Async Loading UX (v1.9.3)

* **`DataTable` loading rows:** Passing `isLoading` now renders a centered spinner (desktop table + mobile card stack) instead of a blank body.
* **Page coverage:** Calendar grid overlay, Emails overview placeholders, Announcements feed/targets, Daily Log list, QA Testing bootstrap, Data Hub people table, Lead Audits, Invoice reimbursements, Settings (attendance, dashboard preset, profile department), Register/Workspace member pickers, Admin Scripts refresh state.
* **Task modals:** `TaskDetailModal` keeps the modal open until save/delete mutations finish; buttons show pending labels and disable double-submit.
* **Shared primitives:** Reuse `DataLoading`, `LoadingState`, and `Spinner` from `client/src/components/ui/` for consistent empty vs loading vs ready states.

### Responsive Shell & Attention Signals (v1.9.2)

* **Nav badges:** Shared `CountBadge` pill with rose/amber/teal variants; `navStatusCounts.js` maps sidebar paths to overdue, today, in-review, and unread counts from the status-counts API. Bottom nav and `OutletSidebar` show attention totals per route.
* **PWA desktop mode:** `displayMode.js` detects installed desktop PWAs (`html[data-pwa-desktop]`) so layout hooks (`useBreakpoint`, safe-area CSS) treat shortcut-window installs like desktop, not phone.
* **Schedule horizon:** `ScheduleDayViewControl` — slider + day checkpoints for 1–5 day views; `scheduleLayout.js` refactored for multi-day member grids and pill placement.
* **Attendance mobile:** `UnifiedTimeCard` overhaul with team roster context; `TeamAttendanceMobileList` for ops mobile grid; expanded `attendanceUtils.js` helpers.
* **Leaderboard density:** Extracted `LeaderboardRow` + `LeaderboardRankBadge` for podium/list reuse and recalc delta hints.
* **Inbox filters:** Category chips with per-category unread `CountBadge`; overview header uses `DataOverviewSection` pattern.
* **Inbox actions:** **Mark all read** and **Clear all** (with confirm) — `DELETE /api/notifications` removes your notification history; badges refresh via `status-counts`.
* **Todo table:** Desktop `/todo` grid supports sort on every column (Task, Type, Assigned by, Status, Priority, Due); toolbar search aligns with labeled filter dropdowns.
* **Attendance roster:** `shared/attendanceExcludedUsers.js` — ops department, named staff emails, and legacy test accounts excluded from ops matrix and morning check-in prompt (work emails stay on roster when not listed).
* **Task list hygiene:** Server `taskListFilter.js` hides completed tasks older than 2 days (`COMPLETED_VISIBLE_DAYS`); client `taskIndicators.js` drives Todo overview KPIs; `taskListFilter.test.js` covers cutoff logic.
* **Calendar polish:** `CalendarView` layout refresh; `calendarEventTime.js` helpers; notification routes expose richer status-count payloads for nav badges.

### Ultra-Density Productivity Engine

* **Headerless Three-Column View:** Combines live leaderboard podiums, team announcements, a global pinboard, private sticky notes, and active schedules inside a zero-latency single screen.
* **Dynamic Gamification:** Tracks user activity and awards Experience Points (XP) from structural configurations. Time-based actions cap at 12 h per event; daily logs use 8 h base + 1.5× overtime. Attendance XP grants only after ops locks both check-in and check-out (`attendanceXp.js`). Leaderboard tap opens per-user XP breakdown. Weekly reset Monday 00:00 IST on `XPAuditLog`; recalc repairs invalid review-approval XP (`reviewExploitRepairService.js`).
* **Global Navigation:** Keyboard-driven command palettes (`Cmd/Ctrl + K`) and persistent floating Fast Action Buttons (FAB) for instantaneous record generation.

### Automated Sales & CRM Pipelines

* **Booked calls (CRM direct):** [theshakticollective.in/book-a-call](https://theshakticollective.in/book-a-call) → TSC Website `POST /api/book-call` → Taskmaster `POST /api/webhooks/book-call` → MongoDB lead (no HolySheet, no Google Sheets append). Rep split **2:1:1** (Satyam / Aryaman / Akash). See [`docs/BOOKED_CALLS_CRM_DIRECT.md`](docs/BOOKED_CALLS_CRM_DIRECT.md).
* **Ingestion Vectors:** CSV uploads, Exly webhooks, and legacy Data Hub inlets; sheet import for booked calls removed in v1.7.57.
* **Follow-up reminders:** Taskmaster `notificationService` fires in-app reminders from CRM `nextFollowupDate` / `nextFollowupTime` (IST, `dd-MM-yyyy`).
* **Transactional Communication:** AiSensy WhatsApp confirmations to the booker and assigned rep on each website booking.

### Institutional Task Review Workflow

* **Governance Matrix:** Enforces strict code/task ownership logic (`shared/taskReviewRules.js`). Tasks explicitly delegated to peers are frozen upon completion and routed directly into an immutable `in-review` state queue. Self-assigned entries bypass validation rules entirely.
* **Role Enforcement:** Restricts execution bounds; only the explicit task creator retains roll-back, state manipulation, or permanent completion override permissions.
* **Project moves:** Any project member (or creator, assignee, admin) may move a task to another project they can access via the Edit Task modal. Server validates source/target membership, syncs workspace, updates project task counts, and refreshes TanStack Query caches without a full page reload.
* **In-review edits:** Save remains available on `in-review` tasks so fields like project, title, and description can be updated; Approve/Rollback actions stay separate for reviewers.
* **Daily log split on submit:** When a delegatee submits for review, the server writes two automatic daily logs — assignee `TASK_COMPLETION` (hours from the completion modal) and assigner `TASK_REVIEW` (default **15 minutes**, `REVIEW_DEFAULT_HOURS` in `shared/taskReviewRules.js`). Approving does not add a full-task completion log for the reviewer; rolling back removes both logs. Review entries show a **Review** badge on Daily Logs and are excluded from manual-log XP like task completions.

### Artist Enquiry Webhook

* **Ingress:** `POST /api/webhooks/artist-enquiry` — receives `/query` form payloads from the marketing site (after Sheets + email succeed).
* **Routing:** Resolves artist name → TSC ARTISTS project (e.g. YUGM → **YUGM** project); falls back to first matching project when needed.
* **Task creation:** High-priority `enquiry` task assigned to `artist_management` on the resolved project.
* **Queue:** BullMQ job `artist-enquiry` with synchronous fallback when Redis is unavailable.
* **Website wiring:** See [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md).

### OCR Document Parsing & Finance Ops

* **Ingestion Pipelines:** Multi-file asynchronous drag-and-drop file uploaders featuring deep retries, intelligent chunk batching, and partial-success state tracking.
* **Extraction Processing:** Leverages specialized pipelines using `pdf-parse` and `tesseract.js` engines to programmatically turn physical balance sheets or receipts into relational ledger payloads.

### Platform Bug Reporting

* **Floating Report Widget:** Persistent bug-report FAB on all authenticated routes (`HelpBugButton.jsx`).
* **Auto-Routing:** `POST /api/tasks/bug` creates tasks under **Tech Stack & Maintenance**, assigns to the platform owner, and syncs all users into the project with assign-capable roles.
* **UX:** Title required, description optional; Enter submits from title field, Ctrl+Enter from description.

### Project Team Roles

* **Canonical Roles:** `admin`, `manager`, and `member` (legacy `owner` values normalize to `admin`).
* **Inline Role Editing:** Project owners and admins can change member roles directly from the Team tab via `NexusDropdown`.
* **API:** `PATCH /api/projects/:id/members/:userId/role` — restricted to project admin/manager or platform admin.
* **Shared Logic:** Role rank and assignment permissions live in `shared/projectRoles.js` (consumed by both client and server).

### Workspace Settings

* **Dedicated Route:** `/projects/workspaces/:name/settings` — manage workspace members, linked projects, and metadata from a single settings page.
* **API:** `GET/PATCH /api/projects/workspaces/:name` with member add/remove and role assignment.
* **UI:** `WorkspaceSettings.jsx` with department-aware role suggestions, member management for workspace creators and admins, and workspace accent colors.
* **Admin workspace colors:** Platform admins can set workspace accent color on Workspace Settings via `WorkspaceColorPicker` (preset swatches plus `#RRGGBB` / `#RGB` hex input). Colors normalize client-side in `workspaceColors.js` and server-side in `projectController.js`; non-admins cannot PATCH `color`.
* **Create workspace:** New workspace modal on Projects uses the same picker and shared `PRESET_WORKSPACE_COLORS`.
* **Workspace access control (v1.9.6):** Users only see workspaces they can access—platform admin, workspace creator, default member, or member/owner of at least one project in that workspace. `GET /api/projects/workspaces` and workspace detail return 403 when unauthorized.
* **Workspace member roster (v1.9.6):** Workspace Settings shows a read-only **Workspace Members** list aggregated from all projects the signed-in user can access in that workspace (owners, teammates, roles per project), plus default-only members tagged **Default**. Logic lives in `server/utils/projectAccess.js` and `buildAllMembersFromProjects` in `projectController.js`.

### Office Subscriptions

* **Tracking:** SaaS, hosting, domain, and recurring vendor subscriptions with INR amounts, due dates, periodicity, and payment mode.
* **Page:** `/office/subscriptions` — CRUD table with search, modal forms, and assignee linking.
* **API:** `/api/subscriptions` — list, create, update; delete restricted to ops/admin.
* **Reminders:** Render cron (`CoreKnot-subscription-reminders`) runs daily via `runSubscriptionReminders.js` to email **all** linked assignees (`usedBy` supports multiple users) before due dates.
* **Multi-assignee:** Subscription `usedBy` is an array; reminder service resolves every populated user email with deduplication.

### Inbox & Web Push Notifications

* **Tri-channel delivery:** In-app inbox, optional email, and Web Push (VAPID) via the service worker (`sw.js`).
* **Single OS toast per event:** Push subscription pruning (`server/utils/pushSubscriptions.js`), send-time dedupe, service-worker tag guards, and client-side `localStorage` + `BroadcastChannel` dedupe prevent duplicate system notifications on phone and laptop.
* **Polling fallback:** When push is unavailable, `NotificationBridge` shows OS toasts only after push init completes — never alongside an active push subscription.

### Department Stats (Admin Dashboard)

* **Timeframe-aware:** `1d` / `7d` / `30d` filters call `GET /api/dashboard/dept-stats?timeframe=` — org-wide metrics for the selected window.
* **Metrics:** Task completion rate (%), converted lead count (people converted in period), total focus hours from daily logs.
* **Widget:** `dept-stats` card in `GenericDashboardCard.jsx`; admin-only via `dashboardComponents.js`.


### Booked Calls & Unsaved Changes (v1.7.57+)

* **CRM-only bookings:** Removed `bookedCallsSyncService`, HolySheet/Sheet sync API (`/api/crm/sync-bookings`), Data Hub sheet import, and Google Sheets append on the book-call webhook. Website webhook is the single source of truth.
* **Webhook auth:** `BOOK_CALL_WEBHOOK_SECRET` via `X-Webhook-Secret` (same pattern as artist enquiry); `rejectUnlessBookCallAuthorized` in `webhookAuth.js`.
* **Rep assignment:** `bookedCallRepAssignment.js` — weighted 2:1:1 across Satyam (`sr06`), Aryaman (`sr09`), and Akash.
* **Unsaved changes:** Global `UnsavedChangesProvider` + bottom bar on settings, CRM workspaces, admin panels, and `FullScreenWorkspace` flows (`useUnsavedChanges.js`). v1.8.0 adds field-level diff preview in the bar and inline Discard/Save in modals that opt out of the global bar.
* **Chat removed (v1.9.0):** Team chat (channels, DMs, realtime) was removed from client and server to reduce surface area; mentions in tasks remain.

**Deploy env (Taskmaster + TSC Website):**

```env
BOOK_CALL_WEBHOOK_SECRET=<shared-secret>
TASKMASTER_WEBHOOK_URL=https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/book-call
```

### Team Schedule & Todo (v1.7.56)

* **Schedule page:** Denser week grid, skeleton loading, and navigation on /schedule (SchedulePage.jsx, ScheduleGrid.jsx, scheduleRoutes.js).
* **Todo list:** Sort rules in TodoPage.jsx and dashboardTasks.js surface review work, due dates, and priority predictably.
* **Sales tasks:** **Sales** category in 	askOptions.js for pipeline work.
* **Mentions:** Rich-text mention chips in MentionRichText.jsx match dashboard token styling.
* **Local dev:** 
odemon.json plus server.js listen/port fixes reduce port conflicts during hot reload.

### Person Data Normalization (v1.7.56)

* **Spec:** [docs/DATA_SANITATION_SPEC.md](docs/DATA_SANITATION_SPEC.md) — normalization rules for names, emails, and phones across CRM inlets.
* **Code:** server/utils/personNormalization.js used by CRM controllers, models, webhooks, and import workers.
* **CLI:** 
ode server/scripts/normalizePersonData.js (reports under server/reports/, gitignored).
* **QA:** Purge/verify/subset scripts and personNormalization.test.js guard integration tests.
### Calendar & Music Content

* **Past-date guard:** Tasks (`scheduleDate`, `dueDate`) and calendar events cannot be created or moved to the past — enforced in UI (`client/src/utils/dateValidation.js`) and API (`shared/dateValidation.js`, `TaskService`, `calendarRoutes`).
* **Music Content Calendar:** 35 public `musical_day` events (birthdays, observances, memorials) from `Music_Content_Calendar.pdf`. Seed via admin **Birthdays** button on Calendar, `POST /api/calendar/seed-music-content`, or `npm run seed:music-calendar:prod`.
* **Cross-tenant public events:** Calendar API uses `bypassTenant` so org-wide public birthdays are visible to all users.
* **Event types:** `meeting`, `instagram_post`, `youtube_post`, `shoot_day`, `event`, `musical_day` — musical days display as **Musical Day** in the calendar UI.

### Mobile-First List UI (v1.9.0)

* **Layout kit:** `ListPageLayout`, `PageToolbar`, `DataOverviewSection`, `DataMiniChart`, `MobileFilterSheet`, `MobilePageHeader`, `ListCard`, `FilterChips`, `DesktopRecommendedBanner`.
* **Hooks:** `useBreakpoint`, `useColumnSort`, shared report range state for monthly and project analytics.
* **Standards:** [`docs/COMPONENT_STANDARDS.md`](docs/COMPONENT_STANDARDS.md) — modal tree, `DataTable` sort, `UserAvatar`, confirms via `confirmContext` (no `window.alert`).
* **Migrated pages:** Assets, Finance, CRM (Leads/Followups), Equipment, Contacts, Office assets, Artists, Admin users, Todo, Projects, Inbox, and more use the shared list pattern.

### Project Analytics (v1.9.0)

* **Per-project:** `/projects/:id/analytics` — task throughput, priority mix, focus hours, assignee breakdown for a rolling date range (`ProjectAnalyticsPage.jsx`, `projectAnalyticsService.js`).
* **Admin rollup:** `/admin/project-analytics` — cross-project comparison for admins (`AdminProjectAnalyticsPage.jsx`).
* **API:** `GET /api/projects/:id/analytics` and admin aggregate routes on `projectRoutes.js`.
* **Shared range logic:** `shared/reportRange.js`, `client/src/utils/projectReportRange.js`.

### Data Hub (Unified CRM)

* **Admin surface:** Admin Panel → **CRM** tab (`DataHubPage.jsx`) — folder sidebar, people table, person detail drawer, analytics panel, TSC HolySheet import.
* **Inlets:** Exly, Leads, TSC/HolySheet, Booked Calls, Enquiries, Mail Engagement, Community, Active Users, Unsubscribed — configured in `shared/dataInlets.js`.
* **API:** `/api/data-hub` — folders, people search/pagination, analytics, sync status, reconcile trigger.
* **Sync:** `DataHubService.syncAllInlets()` merges contacts from leads, Exly, TSC, booked-call webhooks, mail events, and enquiries into the unified `Contact` hub with inlet flags.
* **Scripts:** `node server/scripts/reconcileDataHub.js [--full] [--prod]` for backfill; **Full Sync** button in UI for full re-merge; **Sync New** for incremental updates.
* **Production DB backup:** **DB Backup** on Data Hub toolbar — `POST /api/data-hub/backup` (admin). Streams prod MongoDB → Atlas GridFS `taskmaster_backups` (7-day retention). Also: `npm run backup:daily` or GitHub Actions (free cron alternative to paid Render cron). See [`docs/DATA_BACKUP.md`](docs/DATA_BACKUP.md).

### Task Mentions & Assets

* **@mentions:** `MentionInput` / `MentionTextarea` in task create/edit — notifies mentioned users who are not already assignees (`server/utils/mentionNotifications.js`, `shared/mentionTokens.js`).
* **#assets:** Hash tokens link to asset URLs in task title/description.

### Notification Policy

* **Overdue alerts removed:** The `checkOverdue` cron (task + follow-up overdue push/in-app alerts) was removed from `notificationService.js`. Upcoming call reminders (~30 min before follow-ups) remain.
* **Dashboard overdue cards:** UI badges/lists for overdue tasks remain visual-only — no automated notifications.

### Attendance & Time Tracking

* **Independent mark-in / mark-out:** Self-service and admin flows treat check-in and check-out as separate inputs; server no longer blocks checkout without check-in.
* **Split admin modals:** Team matrix opens dedicated Morning Check-In and Evening Check-Out modals (not one combined panel).
* **Visual states:** Approved (locked) cells use blue tint; pending present cells stay emerald.
* **Work mode (v1.9.7):** Employees pick **Office** or **WFH** via a shared toggle before marking; server persists `workMode` with `verificationMethod: MANUAL`. Optional IP hint (`GET /api/attendance/work-mode-hint`) pre-selects the toggle from `OFFICE_PUBLIC_IP` / `OFFICE_IP_WHITELIST` — no GPS on save.
* **Legacy audit:** Historical rows may still show `GPS` / `NETWORK`; `node server/scripts/auditAttendanceProd.js` remains for prod read-only audits.

### Admin Access Hardening

* **Department-based admin:** `isAdminUser()` checks department slug/preset `admin` — not legacy `user.role`.
* **UI leaks fixed:** Dashboard widgets, sidebar customization, daily logs `?user=`, `/components`, and `/attendance/all` are hidden or redirected for non-admin/ops users.
* **API guards:** QA routes, HolySheet bulk fetch, log cross-user reads, and attendance reset require admin; dashboard/nav customization filters admin-only entries on save.

### Security Hardening (v1.7.47)

* **Auth cookies:** JWT stored in HttpOnly `coreknot_token_v2` cookie — not `localStorage`. Legacy `coreknot_token` is purged on every response after deploy. `POST /api/auth/logout` clears all cookie variants. Client uses `axios.defaults.withCredentials = true`.
* **Cross-device login (v1.7.51):** Fixed Safari/iPhone login loop — session is set from login response without an immediate `/me` wipe on cookie timing races. Production cookies use `SameSite=None; Secure; Partitioned` for Vercel frontend + Render API. Post-login session sync retries in the background. OAuth redirects use `apiPath()` so Google sign-in hits the API origin when `VITE_API_URL` is set. Login UI uses `100dvh`, safe-area padding, 16px inputs (no iOS zoom), and 48px touch targets.
* **Logout (v1.7.52 / v1.8.0):** Logout bumps an auth epoch so in-flight `/me` retries cannot re-set the user after sign-out. v1.8.0 adds `authSession.js` force-logout flag across redirect and treats 403 like 401 on session fetch.
* **CRM lead updates (v1.7.55):** Lead modal uses country-code + national-number fields with strict per-country digit rules (no silent truncation). Invalid phones block save with clear errors; server validates via `phoneCountryValidation.js`. Lead table refreshes after save (`useUpdateLead` cache fix). Legacy overlong/concatenated phones repaired via `leadPhoneRepair.js` and QA audit/cleanup CLI scripts.
* **CRM lead updates (v1.7.54):** Legacy `-DUP-{id}` / `EMPTY-{id}` corrupt phones (from old `dbPush.js` duplicate resolution) are auto-repaired on save, bulk-repairable via `npm run repair:lead-phones`, and cleaned during QA purge. Saving leads with unchanged corrupt phones no longer fails validation.
* **CRM lead updates (v1.7.53):** Saving a lead no longer fails when phone/email normalize to the same value (e.g. `9876543210` → `+919876543210`). Duplicate phone/email returns **409** with a clear message instead of generic **400 Failed to update lead**.
* **Webhook signatures:** HMAC-SHA256 via `X-Webhook-Signature: sha256=…` for book-call, Exly, and artist-enquiry ingress (`server/utils/webhookAuth.js`). Set `BOOK_CALL_WEBHOOK_SECRET`, `EXLY_WEBHOOK_SECRET`, `ARTIST_ENQUIRY_WEBHOOK_SECRET` on Render.
* **Registration lockdown:** Production signup restricted to `ALLOWED_DOMAIN` and departments with `signupAllowed`. Password strength enforced server-side.
* **Password reset (v1.9.8):** Forgot-password and token-based reset endpoints; reset emails via Gmail (`sendSystemEmail.js`), not the campaign Resend sender; tokens stored hashed with 1-hour expiry.
* **Route guards:** Artist analytics, subscriptions CRUD, API proxy, and Meta webhooks require auth or valid signatures.
* **CORS:** `*.vercel.app` blocked in production unless `CORS_ALLOW_VERCEL_PREVIEWS=true`.
* **Default passwords:** Org seed password `1Million#` via `DEFAULT_SEED_PASSWORD` / `shared/defaultPassword.js`. Weak-password reset script sets `mustChangePassword: true`.
* **Profile completion alerts:** Amber banners in `MainLayout` for missing phone, DOB, or unchanged default password — links to Settings → Profile.
* **Login notice:** Amber banner on login page when default passwords were rotated org-wide.
* **QA security category:** Pre-deployment checklist includes static + live HTTP security probes (`security-hardening`).
* **Full spec:** [`docs/SECURITY.md`](docs/SECURITY.md)

### USD ↔ INR Conversion

* **Live rate:** `GET /api/finance/usd-inr-rate` — cached FX rate for finance, subscriptions, and project finance forms.
* **Shared fields:** `UsdInrAmountFields.jsx` + `useUsdInrRate.js` sync USD/INR amounts across Finance, Subscriptions, and Project Finance.
* **Invoice & reimbursement submissions (v1.8.0):** Settings → Invoice tab — workspace/project picker, multi-file receipts, invoice vs reimbursement type, submission history with status badges. Ops/admin approve or reject via Finance page pending queue (`GET /api/finance/pending`, `PATCH /api/finance/:id/approve|reject`). User history: `GET /api/finance/my-invoices`.

### Local Development Safeguards

* **Env Templates:** `server/.env.example` and `client/.env.example` document required variables without secrets.
* **Dev Guard:** `client/src/utils/devEnvGuard.js` warns in the browser console when `VITE_API_URL` points at a production host.
* **Prod Sync Script:** `node server/scripts/syncProdToLocal.js --yes` copies production MongoDB → local (read-only on prod); see [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md).

---

## Directory Structure

```
CoreKnot/
├── client/                     # Frontend Application Root
│   ├── public/                 # Static Assets & PWA manifests
│   │   ├── manifest.json       # PWA configurations & deep link schemes
│   │   └── icons/              # Responsive multi-device application icons
│   ├── scripts/                # Frontend automation utilities
│   └── src/
│       ├── components/
│       │   ├── dataHub/        # Data Hub folder sidebar, stats, person detail, analytics, TSC import
│       │   ├── mentions/       # MentionInput, MentionTextarea autocomplete
│       │   └── forms/          # TaskFormFields, WorkspaceSelect, etc.
│       ├── pages/              # Routed view targets (Dashboard, Inbox, Todo, CRM)
│       ├── hooks/              # Isolated React Query abstractions & hardware listeners
│       ├── utils/              # displayLabels, dateValidation, devEnvGuard, mail helpers
│       ├── contexts/           # Global State Hubs (Auth, Theme, Socket, Toasts)
│       └── sw.js               # Service Worker utilizing injectManifest compilation
├── server/                     # Backend API Application Root
│   ├── config/                 # Database URI resolution & dev/prod safety guards
│   ├── routes/                 # Explicitly mapped REST routing topologies
│   ├── controllers/            # Pure business logic controllers
│   ├── models/                 # Mongoose schema primitives and indexes
│   ├── services/               # Third-party adapters (Notification, Mail, AWS SES)
│   ├── middleware/             # Authorization, Rate Limiting, and Health Guards
│   ├── scripts/                # Database seed engines, backup suites, and migrations
│   └── templates/              # Transactional MJML/HTML email layouts
├── shared/                     # Multi-runtime definitions (logger, roles, validation, data inlets)
│   ├── dateValidation.js       # IST date-key + calendar datetime guards (CJS; client mirrors in src/utils)
│   ├── dataInlets.js           # Data Hub folder taxonomy
│   ├── gamificationRules.js    # Shared XP/action rules
│   ├── mentionTokens.js        # @user / #asset token parsing
│   └── taskPriorityDates.js    # Priority → due-date span logic
├── docs/                       # Architectural specs, startup guides, and AI agent context
└── render.yaml                 # Infrastructure Blueprint configurations
```

---

## Quick Start Guide

### System Prerequisites

* **Node.js:** Runtime engine environment `v18.0.0` or higher.
* **MongoDB:** Active localized instance or an accessible remote Atlas connection.
* **Redis:** Standard cluster endpoint (highly recommended for processing async event queues).

### Step-by-Step Environment Bootstrapping

#### 1. Clone Ecosystem and Local Dependencies

```bash
git clone https://github.com/YOUR_ORG/CoreKnot.git
cd CoreKnot

# Install localized dependencies inside the Backend Layer
cd server && npm install

# Install localized dependencies inside the Frontend Layer
cd ../client && npm install
```

#### 2. Configure Local Environment State

```bash
cd ../server
cp .env.example .env

cd ../client
cp .env.example .env
```

Open your newly created `.env` files and define your structural configurations. The client **must** use `VITE_API_URL=http://localhost:5000` so local UI writes to your local database, not production.

To spin up local hardware push alerts, generate unique cryptographic VAPID signatures:

```bash
npx web-push generate-vapid-keys
```

#### 3. Initialize Database Seed Schemes

Populate fundamental organizational architectures, department entities, permission flags, and default system classifications into your local collection instances:

```bash
node scripts/seedDepartmentsAndTaskTypes.js
node scripts/seedMusicContentCalendar.js --year=2026        # local calendar events
node scripts/reconcileDataHub.js --full                     # backfill Data Hub contacts
```


**Password reset (weak → org default `1Million#`):**

```bash
cd server
npm run reset-weak-passwords              # dry-run local
npm run reset-weak-passwords:local:apply  # apply local
npm run reset-weak-passwords:prod         # dry-run production
$env:RESET_WEAK_PASSWORDS_CONFIRM=1; npm run reset-weak-passwords:prod:apply
```

Force specific accounts: `--accounts=email1@x.com,email2@y.com --apply`

#### 4. Run the Local Development Environment

Execute both runtime nodes concurrently in isolated terminal shells:

**Terminal 1: Node API Engine Server**

```bash
cd server
npm run dev
```

**Terminal 2: Vite Compiling Frontend**

```bash
cd client
npm run dev
```

* Your local frontend workspace compiles dynamically at `http://localhost:5173`.
* Internal network communication maps directly through an automated Vite proxy straight down into the api layer listening at `http://localhost:5000`.

#### 5. Optional — Lighthouse performance audit (client)

Audit all routes against the running dev stack (requires API + credentials for protected pages):

```bash
cd client
$env:LH_BASE_URL="http://localhost:5173"
$env:LH_API_URL="http://localhost:5000"
$env:LH_EMAIL="your@email"
$env:LH_PASSWORD="your-password"
npm run lighthouse
```

For production-like scores:

```bash
npm run build && npm run preview
$env:LH_BASE_URL="http://localhost:4173"
npm run lighthouse -- --prod
```

Reports: `client/lighthouse-reports/index.html` (local only, gitignored).

---

## Environment Configuration

The server relies heavily on strict system environment mappings to guarantee secure operation across multi-stage runtime environments.

| Environment Variable Key | Requirements | Contextual Description |
| --- | --- | --- |
| `MONGODB_URI` | **Required** | Unified database connection string specifying target authorization endpoints. |
| `JWT_SECRET` | **Required** | Cryptographic key utilized to sign statelessly managed web token tokens. |
| `FRONTEND_URL` | Production Only | The public consumer web location utilized to build structural email CTA references. |
| `VITE_API_URL` | Highly Recommended | Direct endpoint address pointing to the static web API host, intentionally skipping standard middle-tier routing paths during massive data payload uploads. |
| `REDIS_URL` | Optional | Direct connection reference used to drive active state machine queues (`BullMQ`). |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Webhook Integrations | Google Sheets append credentials for public booking webhooks (`BookedCalls` tab). |
| `GOOGLE_PRIVATE_KEY` | Webhook Integrations | PEM private key paired with the service account email (newline-escaped). |
| `AISENSY_API_KEY` | Webhook Integrations | WhatsApp campaign dispatch for booked-call confirmations and rep alerts. |
| `CORS_ALLOWED_ORIGINS` | Optional | Comma-separated extra browser origins; `theshakticollective.in` is allowlisted by default. |
| `DEBUG_BYPASS` | Development Only | Enables a stateless internal bypass mechanism (`Authorization: Bearer bypass_token`). |
| `MONGODB_DB_LOCAL` | Optional | Database name override for sync scripts (default: `taskmaster_local`). |
| `MONGODB_DB_PROD` | Optional | Production database name override for sync scripts (default: `taskmaster_production`). |
| `ALLOW_PROD_DB_IN_DEV` | Development Only | Permits connecting to a production-like database name from local dev (default: blocked). |
| `DEFAULT_SEED_PASSWORD` | Recommended | Org default seed password for Clerk auto-create and weak-password reset (default: `1Million#`). |
| `EMAIL_ADDRESS` | Password reset | Gmail (or SMTP service) sender for system transactional mail — forgot-password links. |
| `EMAIL_PASSWORD` | Password reset | App password or SMTP credential paired with `EMAIL_ADDRESS`. |
| `EMAIL_SERVICE` | Optional | Nodemailer service name (default: `gmail`). |
| `GOOGLE_CLIENT_ID` | Google OAuth | Staff Google Sign-In client ID (also `VITE_GOOGLE_CLIENT_ID` on client). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | OAuth client secret — must match Google Cloud Console (not a placeholder). |
| `GOOGLE_REDIRECT_URI` | Google OAuth | Callback URL; dev: `http://localhost:5000/api/auth/google/callback`. |
| `APP_BASE_URL` / `SERVER_URL` | Production | Canonical public API origin for OAuth redirect resolution. |
| `META_APP_ID` / `META_APP_SECRET` | Meta integrations | Artist Instagram connect + webhook signature verification. |
| `BOOK_CALL_WEBHOOK_SECRET` | Production | HMAC secret for book-call webhook signature verification. |
| `EXLY_WEBHOOK_SECRET` | Production | HMAC secret for Exly webhook signature verification. |
| `ARTIST_ENQUIRY_WEBHOOK_SECRET` | Production | Required in production for artist-enquiry webhook. |
| `CORS_ALLOW_VERCEL_PREVIEWS` | Optional | Set `true` to allow `*.vercel.app` origins in production CORS. |
| `RESET_WEAK_PASSWORDS_CONFIRM` | Script Only | Must be `1` when running production weak-password reset with `--apply`. |

### Local vs Production Database Isolation

Local development should use **`taskmaster_local`**; production uses **`taskmaster_production`**. The server resolves the correct URI via `server/config/database.js` and throws on startup if a dev runtime targets a production-like database name unless explicitly allowed.

See [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md) for the full isolation checklist.

### Production API Host

| Service | URL |
| --- | --- |
| **Render API** | `https://YOUR-RENDER-SERVICE.onrender.com` |
| **Book-a-Call Webhook** | `POST https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/book-call` |
| **Artist Enquiry Webhook** | `POST https://YOUR-RENDER-SERVICE.onrender.com/api/webhooks/artist-enquiry` |

The public marketing site (`theshakticollective.in`) proxies bookings through its Next.js route `POST /api/book-call`, which forwards payloads to the book-call webhook above. Set `TASKMASTER_WEBHOOK_URL` on the website host to override the default.

Artist enquiries from `/query` should forward to the artist-enquiry webhook after Sheets/email succeed. See [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md).

---

## API Architecture & Routing

All application endpoints are structured beneath an explicit global `/api` gateway context pattern.

```
/api
├── /auth         → User onboarding, login/logout, forgot/reset password, federated Google sign-in
├── /tasks        → Standard task mutations, dynamic tracking states, and role assignments
├── /projects     → Structural workspace definitions, access states, and board layouts
├── /crm          → Legacy contacts + Admin Data Hub UI entry
├── /data-hub     → Unified contact hub: folders, people, analytics, reconcile
├── /webhooks     → Public ingress (book-call, artist-enquiry, Exly, Meta, Resend) with queue-backed processing
├── /notifications→ Push delivery registries, system status counts, and message updates
├── /subscriptions→ Office subscription CRUD and due-date reminder pipeline
├── /finance      → Multi-file processing, metadata index arrays, and document extractions
└── /proxy        → Monitored proxy routing to YouTube, OpenAI, and HolySheet targets
```

---

## Diagnostic & Observability Protocol

CoreKnot is engineered to survive production strain with a rigorous multi-tiered observability layout:

* **Autonomous Killswitch Protection (`SystemHealthService`):** A middle-tier system layer that constantly probes connection paths to MongoDB and Redis. If database or caching links go offline, it immediately intercepts incoming traffic with an explicit `HTTP 503 Maintenance Mode` error response to protect database integrity.
* **Trace Propagation & Context Isolation:** Injectable correlation IDs follow requests through the execution stack. If an unhandled application error happens, the engine wraps structural metadata parameters directly into the server logs and error bodies.
* **Telemetry Diagnostics Dashboard:** Found natively under `/management/ops-logs`. It provides live telemetry charting, page analytics tracking, structural message trace indicators, and real-time error logs sorted by severity level.

---

## Global Autonomous QA System & Auditing

CoreKnot ships a **209-case** pre-deployment QA engine (Admin → QA Testing) that runs static checks, live HTTP security probes, integration workflows, and per-page AST scans before release.

| Suite | Scope | Examples |
| --- | --- | --- |
| **Pre-deploy checklist** | Static file/code audits | Auth cookies, tenant plugins, webhook HMAC, CORS, indexes |
| **Security live probes** | Real HTTP against local API | Login omits JWT body, unsigned webhooks rejected, finance tenant spoof blocked |
| **Sanitization & edge** | Input validation | XSS in task titles, NoSQL login operators, 413 oversized bodies, per-email login rate limits |
| **Integration (45)** | End-to-end business logic | Task review → XP, lead lock 423, Data Hub reconcile, unsubscribe dual-write |
| **Page scans** | Every `client/src/pages` route | Optional chaining, `useCallback` heuristics, endpoint exposure |

**Operator UX (`QATestingPage.jsx`):** Live probe panel (method, URL, payload), grouped failure copy, checklist progress, realtime Socket.IO updates, and **Purge QA Test Data** with confirm dialog.

**Purge QA Test Data:** Admin → QA Testing removes probe CRM rows (`qa-*@example.com`, names starting with `QA `), probe user accounts (e.g. QA Login Probe), probe tasks (QA Proto, XSS titles, `[QA BUG]`, Backdated QA), related task assignments/logs, and QA audit logs — without touching production data outside those patterns (`server/services/qa/qaTestData.js`). QA runs also **always purge in a `finally` block** (success or failure), repair corrupt `-DUP-` phones, and integration lock/audit tests use disposable QA-tagged leads instead of mutating real CRM rows.

**Repair corrupt lead phones:** `cd server && npm run repair:lead-phones` — strips legacy `-DUP-{objectId}` / `EMPTY-{objectId}` suffixes, merges redundant duplicates, safe to run against production (`server/scripts/repairCorruptPhones.js`, `server/services/leadPhoneRepair.js`).

**QA data audit & cleanup (CLI):**

```bash
cd server
npm run qa:audit          # read-only report (local MONGODB_URI)
npm run qa:audit:prod     # read-only report (MONGODB_URI_PROD)
npm run qa:cleanup        # purge QA patterns + repair corrupt phones (local)
npm run qa:cleanup:prod   # same against production
npm run repair:phones     # repair overlong E.164 phones (local)
npm run repair:phones:prod
npm run repair:phones:all # local then prod
```

Scripts: `qaAuditReport.js`, `qaFullCleanup.js`, `scanCorruptPhones.js`, `auditLeadPhones.js`.

**CLI runners:**

```bash
cd server
# Full scan via running API (set QA_ADMIN_USER_ID or use login)
node scripts/triggerQaHttp.js

# Direct DB scan (uses QA_SCAN_MONGODB_URI or MONGODB_URI)
node scripts/runQAScan.js
```

During QA runs, gamification jobs use `QA_SYNC_GAMIFICATION` so BullMQ awards complete before integration assertions (production traffic unchanged).

---

---

## Documentation Index

| Document | Purpose |
| --- | --- |
| [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) | Step-by-step local environment bootstrap |
| [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md) | Local vs production MongoDB isolation |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth cookies, webhooks, CORS, password policy, QA security checks |
| [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md) | Complete AI agent reference (routes, models, rules) |
| [`docs/EMAIL_ENGINE_LOCKED.md`](docs/EMAIL_ENGINE_LOCKED.md) | Locked email tracking spec — do not modify without unlock |
| [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md) | Wire `/query` form on theshakticollective.in to Taskmaster |
| [`docs/COMPONENT_STANDARDS.md`](docs/COMPONENT_STANDARDS.md) | Client UI conventions — lists, modals, tables, avatars |
| [`docs/GOOGLE_META_APP_VERIFICATION.md`](docs/GOOGLE_META_APP_VERIFICATION.md) | Google OAuth + Meta App Review — env vars, redirect URIs, test matrix |
| [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md) | Release notes (beta builds pre-1.0.0) |

---

*Distributed Private Enterprise Systems — Copyright © 2026 CoreKnot. All Rights Reserved.*
