<p align="center">
  <img src="client/public/favicon.svg" alt="CoreKnot Logo" width="80" height="80" />
</p>

<h1 align="center">CoreKnot</h1>

<p align="center">
  <strong>Enterprise CRM & Operations Hub</strong><br/>
  An ultra-high-density operational platform integrating project execution, automated sales pipelines, robust finance operations, and real-time team gamification—explicitly engineered for agency workflows.
</p>

<p align="center">
  <a href="#-key-features">Features</a> ·
  <a href="#%EF%B8%8F-architecture--tech-stack">Architecture</a> ·
  <a href="#%EF%B8%8F-directory-structure">Directory Structure</a> ·
  <a href="#%EF%B8%8F-quick-start-guide">Quick Start</a> ·
  <a href="#-environment-configuration">Configuration</a> ·
  <a href="#-api-architecture--routing">API Surface</a> ·
  <a href="#-diagnostic--observability-protocol">Diagnostics</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.57-126d5e?style=flat-square" alt="Version 1.7.57" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/mongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/PWA-enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## 📖 Executive Summary

CoreKnot (branded natively as **CoreKnot** within its Progressive Web App shell) is a decoupled, multi-tenant operational workspace designed to strip out project management overhead. It streamlines complex business lines—such as financial document optical character recognition (OCR), multi-channel customer relationship management (CRM) ingestion, and department-aware workforce scheduling—into a unified, high-density dashboard.

### Core Ecosystem Primitives

* **Decoupled Architecture:** Vite-optimized React Single Page Application (SPA) paired with a high-performance Express REST API layer.
* **Resilient Infrastructure:** Integrated Redis task queues (`BullMQ`), state-driven orchestration (`Trigger.dev`), real-time bidirectional state syncing (`Socket.IO`), and an autonomous system-health blocking middleware.
* **Strict Review Pipelines:** Institutional task governance rules separating individual contributions from multi-tiered peer review workflows.

---

## 🛠️ Architecture & Tech Stack

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
| **Security** | Authentication | HttpOnly JWT cookie (`coreknot_token`), Google OAuth 2.0, RBAC, webhook HMAC, registration lockdown |
| **Deployment** | CI/CD Infrastructure | Render (Web Services + Managed Static CDN handles asset distribution) |

---

## 🚀 Key Features

### 📊 Ultra-Density Productivity Engine

* **Headerless Three-Column View:** Combines live leaderboard podiums, team announcements, a global pinboard, private sticky notes, and active schedules inside a zero-latency single screen.
* **Dynamic Gamification:** Tracks user activity and awards Experience Points (XP) from structural configurations. Resets top-performers weekly on Monday 00:00 IST via native aggregation on `XPAuditLog` while preserving lifetime levels.
* **Global Navigation:** Keyboard-driven command palettes (`Cmd/Ctrl + K`) and persistent floating Fast Action Buttons (FAB) for instantaneous record generation.

### 💼 Automated Sales & CRM Pipelines

* **Booked calls (CRM direct):** [theshakticollective.in/book-a-call](https://theshakticollective.in/book-a-call) → TSC Website `POST /api/book-call` → Taskmaster `POST /api/webhooks/book-call` → MongoDB lead (no HolySheet, no Google Sheets append). Rep split **2:1:1** (Satyam / Aryaman / Akash). See [`docs/BOOKED_CALLS_CRM_DIRECT.md`](docs/BOOKED_CALLS_CRM_DIRECT.md).
* **Ingestion Vectors:** CSV uploads, Exly webhooks, and legacy Data Hub inlets; sheet import for booked calls removed in v1.7.57.
* **Follow-up reminders:** Taskmaster `notificationService` fires in-app reminders from CRM `nextFollowupDate` / `nextFollowupTime` (IST, `dd-MM-yyyy`).
* **Transactional Communication:** AiSensy WhatsApp confirmations to the booker and assigned rep on each website booking.

### 🛡️ Institutional Task Review Workflow

* **Governance Matrix:** Enforces strict code/task ownership logic (`shared/taskReviewRules.js`). Tasks explicitly delegated to peers are frozen upon completion and routed directly into an immutable `in-review` state queue. Self-assigned entries bypass validation rules entirely.
* **Role Enforcement:** Restricts execution bounds; only the explicit task creator retains roll-back, state manipulation, or permanent completion override permissions.
* **Project moves:** Any project member (or creator, assignee, admin) may move a task to another project they can access via the Edit Task modal. Server validates source/target membership, syncs workspace, updates project task counts, and refreshes TanStack Query caches without a full page reload.
* **In-review edits:** Save remains available on `in-review` tasks so fields like project, title, and description can be updated; Approve/Rollback actions stay separate for reviewers.
* **Daily log split on submit:** When a delegatee submits for review, the server writes two automatic daily logs — assignee `TASK_COMPLETION` (hours from the completion modal) and assigner `TASK_REVIEW` (default **15 minutes**, `REVIEW_DEFAULT_HOURS` in `shared/taskReviewRules.js`). Approving does not add a full-task completion log for the reviewer; rolling back removes both logs. Review entries show a **Review** badge on Daily Logs and are excluded from manual-log XP like task completions.

### 🎭 Artist Enquiry Webhook

* **Ingress:** `POST /api/webhooks/artist-enquiry` — receives `/query` form payloads from the marketing site (after Sheets + email succeed).
* **Routing:** Resolves artist name → TSC ARTISTS project (e.g. YUGM → **YUGM** project); falls back to first matching project when needed.
* **Task creation:** High-priority `enquiry` task assigned to `artist_management` on the resolved project.
* **Queue:** BullMQ job `artist-enquiry` with synchronous fallback when Redis is unavailable.
* **Website wiring:** See [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md).

### 📑 OCR Document Parsing & Finance Ops

* **Ingestion Pipelines:** Multi-file asynchronous drag-and-drop file uploaders featuring deep retries, intelligent chunk batching, and partial-success state tracking.
* **Extraction Processing:** Leverages specialized pipelines using `pdf-parse` and `tesseract.js` engines to programmatically turn physical balance sheets or receipts into relational ledger payloads.

### 🐛 Platform Bug Reporting

* **Floating Report Widget:** Persistent bug-report FAB on all authenticated routes (`HelpBugButton.jsx`).
* **Auto-Routing:** `POST /api/tasks/bug` creates tasks under **Tech Stack & Maintenance**, assigns to the platform owner, and syncs all users into the project with assign-capable roles.
* **UX:** Title required, description optional; Enter submits from title field, Ctrl+Enter from description.

### 👥 Project Team Roles

* **Canonical Roles:** `admin`, `manager`, and `member` (legacy `owner` values normalize to `admin`).
* **Inline Role Editing:** Project owners and admins can change member roles directly from the Team tab via `NexusDropdown`.
* **API:** `PATCH /api/projects/:id/members/:userId/role` — restricted to project admin/manager or platform admin.
* **Shared Logic:** Role rank and assignment permissions live in `shared/projectRoles.js` (consumed by both client and server).

### 🏢 Workspace Settings

* **Dedicated Route:** `/projects/workspaces/:name/settings` — manage workspace members, linked projects, and metadata from a single settings page.
* **API:** `GET/PATCH /api/projects/workspaces/:name` with member add/remove and role assignment.
* **UI:** `WorkspaceSettings.jsx` with department-aware role suggestions, member management for workspace creators and admins, and workspace accent colors.
* **Admin workspace colors:** Platform admins can set workspace accent color on Workspace Settings via `WorkspaceColorPicker` (preset swatches plus `#RRGGBB` / `#RGB` hex input). Colors normalize client-side in `workspaceColors.js` and server-side in `projectController.js`; non-admins cannot PATCH `color`.
* **Create workspace:** New workspace modal on Projects uses the same picker and shared `PRESET_WORKSPACE_COLORS`.

### 💳 Office Subscriptions

* **Tracking:** SaaS, hosting, domain, and recurring vendor subscriptions with INR amounts, due dates, periodicity, and payment mode.
* **Page:** `/office/subscriptions` — CRUD table with search, modal forms, and assignee linking.
* **API:** `/api/subscriptions` — list, create, update; delete restricted to ops/admin.
* **Reminders:** Render cron (`CoreKnot-subscription-reminders`) runs daily via `runSubscriptionReminders.js` to notify assignees before due dates.

### 🔔 Inbox & Web Push Notifications

* **Tri-channel delivery:** In-app inbox, optional email, and Web Push (VAPID) via the service worker (`sw.js`).
* **Single OS toast per event:** Push subscription pruning (`server/utils/pushSubscriptions.js`), send-time dedupe, service-worker tag guards, and client-side `localStorage` + `BroadcastChannel` dedupe prevent duplicate system notifications on phone and laptop.
* **Polling fallback:** When push is unavailable, `NotificationBridge` shows OS toasts only after push init completes — never alongside an active push subscription.

### 📊 Department Stats (Admin Dashboard)

* **Timeframe-aware:** `1d` / `7d` / `30d` filters call `GET /api/dashboard/dept-stats?timeframe=` — org-wide metrics for the selected window.
* **Metrics:** Task completion rate (%), converted lead count (people converted in period), total focus hours from daily logs.
* **Widget:** `dept-stats` card in `GenericDashboardCard.jsx`; admin-only via `dashboardComponents.js`.


### Booked Calls, Chat & Unsaved Changes (v1.7.57)

* **CRM-only bookings:** Removed `bookedCallsSyncService`, HolySheet/Sheet sync API (`/api/crm/sync-bookings`), Data Hub sheet import, and Google Sheets append on the book-call webhook. Website webhook is the single source of truth.
* **Webhook auth:** `BOOK_CALL_WEBHOOK_SECRET` via `X-Webhook-Secret` (same pattern as artist enquiry); `rejectUnlessBookCallAuthorized` in `webhookAuth.js`.
* **Rep assignment:** `bookedCallRepAssignment.js` — weighted 2:1:1 across Satyam (`sr06`), Aryaman (`sr09`), and Akash.
* **Team chat:** Linked channels, DMs, file uploads (`chatRoutes.js`, `ChatChannel` / `ChatMessage` models, `client/src/pages/chat/`).
* **Unsaved changes:** Global `UnsavedChangesProvider` + bottom bar on settings, CRM workspaces, admin panels, and `FullScreenWorkspace` flows (`useUnsavedChanges.js`).

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
### 📅 Calendar & Music Content

* **Past-date guard:** Tasks (`scheduleDate`, `dueDate`) and calendar events cannot be created or moved to the past — enforced in UI (`client/src/utils/dateValidation.js`) and API (`shared/dateValidation.js`, `TaskService`, `calendarRoutes`).
* **Music Content Calendar:** 35 public `musical_day` events (birthdays, observances, memorials) from `Music_Content_Calendar.pdf`. Seed via admin **Birthdays** button on Calendar, `POST /api/calendar/seed-music-content`, or `npm run seed:music-calendar:prod`.
* **Cross-tenant public events:** Calendar API uses `bypassTenant` so org-wide public birthdays are visible to all users.
* **Event types:** `meeting`, `instagram_post`, `youtube_post`, `shoot_day`, `event`, `musical_day` — musical days display as **Musical Day** in the calendar UI.

### 🗄️ Data Hub (Unified CRM)

* **Admin surface:** Admin Panel → **CRM** tab (`DataHubPage.jsx`) — folder sidebar, people table, person detail drawer, analytics panel, TSC HolySheet import.
* **Inlets:** Exly, Leads, TSC/HolySheet, Booked Calls, Enquiries, Mail Engagement, Community, Active Users, Unsubscribed — configured in `shared/dataInlets.js`.
* **API:** `/api/data-hub` — folders, people search/pagination, analytics, sync status, reconcile trigger.
* **Sync:** `DataHubService.syncAllInlets()` merges contacts from leads, Exly, TSC, booked-call webhooks, mail events, and enquiries into the unified `Contact` hub with inlet flags.
* **Scripts:** `node server/scripts/reconcileDataHub.js [--full] [--prod]` for backfill; **Full Sync** button in UI for full re-merge; **Sync New** for incremental updates.
* **Production DB backup:** **DB Backup** on Data Hub toolbar — `POST /api/data-hub/backup` (admin). Streams prod MongoDB → Atlas GridFS `taskmaster_backups` (7-day retention). Also: `npm run backup:daily` or GitHub Actions (free cron alternative to paid Render cron). See [`docs/DATA_BACKUP.md`](docs/DATA_BACKUP.md).

### ✍️ Task Mentions & Assets

* **@mentions:** `MentionInput` / `MentionTextarea` in task create/edit — notifies mentioned users who are not already assignees (`server/utils/mentionNotifications.js`, `shared/mentionTokens.js`).
* **#assets:** Hash tokens link to asset URLs in task title/description.

### 🔔 Notification Policy

* **Overdue alerts removed:** The `checkOverdue` cron (task + follow-up overdue push/in-app alerts) was removed from `notificationService.js`. Upcoming call reminders (~30 min before follow-ups) remain.
* **Dashboard overdue cards:** UI badges/lists for overdue tasks remain visual-only — no automated notifications.

### 📅 Attendance & Time Tracking

* **Independent mark-in / mark-out:** Self-service and admin flows treat check-in and check-out as separate inputs; server no longer blocks checkout without check-in.
* **Split admin modals:** Team matrix opens dedicated Morning Check-In and Evening Check-Out modals (not one combined panel).
* **Visual states:** Approved (locked) cells use blue tint; pending present cells stay emerald.
* **Office auto-detect (waterfall):** Check-in defaults to WFH until proven otherwise — **Tier 1** GPS within **1 km** of Nashik office (`19.9975, 73.7898`); **Tier 2** client IP matches `OFFICE_PUBLIC_IP` and/or `OFFICE_IP_WHITELIST` (comma-separated IPv4/IPv6 + localhost for dev). Render must list current office egress IPs (e.g. `49.36.41.118`).
* **Diagnostics:** `POST /api/attendance/check` logs `[ATTENDANCE DIAGNOSTIC]` tiers and returns `_attendanceDiagnostic` in the JSON response. Ops audit: `node server/scripts/auditAttendanceProd.js`.
* **Default work mode:** Admin Mode Override dropdown defaults to **Office** (self check-in still auto-detects via GPS/IP).

### 🔐 Admin Access Hardening

* **Department-based admin:** `isAdminUser()` checks department slug/preset `admin` — not legacy `user.role`.
* **UI leaks fixed:** Dashboard widgets, sidebar customization, daily logs `?user=`, `/components`, and `/attendance/all` are hidden or redirected for non-admin/ops users.
* **API guards:** QA routes, HolySheet bulk fetch, log cross-user reads, and attendance reset require admin; dashboard/nav customization filters admin-only entries on save.

### 🛡️ Security Hardening (v1.7.47)

* **Auth cookies:** JWT stored in HttpOnly `coreknot_token` cookie — not `localStorage`. `POST /api/auth/logout` clears session. Client uses `axios.defaults.withCredentials = true`.
* **Cross-device login (v1.7.51):** Fixed Safari/iPhone login loop — session is set from login response without an immediate `/me` wipe on cookie timing races. Production cookies use `SameSite=None; Secure; Partitioned` for Vercel frontend + Render API. Post-login session sync retries in the background. OAuth redirects use `apiPath()` so Google sign-in hits the API origin when `VITE_API_URL` is set. Login UI uses `100dvh`, safe-area padding, 16px inputs (no iOS zoom), and 48px touch targets.
* **Logout (v1.7.52):** Logout bumps an auth epoch so in-flight `/me` retries from post-login sync cannot re-set the user after sign-out. Client clears user state before the logout API call completes.
* **CRM lead updates (v1.7.55):** Lead modal uses country-code + national-number fields with strict per-country digit rules (no silent truncation). Invalid phones block save with clear errors; server validates via `phoneCountryValidation.js`. Lead table refreshes after save (`useUpdateLead` cache fix). Legacy overlong/concatenated phones repaired via `leadPhoneRepair.js` and QA audit/cleanup CLI scripts.
* **CRM lead updates (v1.7.54):** Legacy `-DUP-{id}` / `EMPTY-{id}` corrupt phones (from old `dbPush.js` duplicate resolution) are auto-repaired on save, bulk-repairable via `npm run repair:lead-phones`, and cleaned during QA purge. Saving leads with unchanged corrupt phones no longer fails validation.
* **CRM lead updates (v1.7.53):** Saving a lead no longer fails when phone/email normalize to the same value (e.g. `9876543210` → `+919876543210`). Duplicate phone/email returns **409** with a clear message instead of generic **400 Failed to update lead**.
* **Webhook signatures:** HMAC-SHA256 via `X-Webhook-Signature: sha256=…` for book-call, Exly, and artist-enquiry ingress (`server/utils/webhookAuth.js`). Set `BOOK_CALL_WEBHOOK_SECRET`, `EXLY_WEBHOOK_SECRET`, `ARTIST_ENQUIRY_WEBHOOK_SECRET` on Render.
* **Registration lockdown:** Production signup restricted to `ALLOWED_DOMAIN` and departments with `signupAllowed`. Password strength enforced server-side.
* **Route guards:** Artist analytics, subscriptions CRUD, API proxy, and Meta webhooks require auth or valid signatures.
* **CORS:** `*.vercel.app` blocked in production unless `CORS_ALLOW_VERCEL_PREVIEWS=true`.
* **Default passwords:** Org seed password `1Million#` via `DEFAULT_SEED_PASSWORD` / `shared/defaultPassword.js`. Weak-password reset script sets `mustChangePassword: true`.
* **Profile completion alerts:** Amber banners in `MainLayout` for missing phone, DOB, or unchanged default password — links to Settings → Profile.
* **Login notice:** Amber banner on login page when default passwords were rotated org-wide.
* **QA security category:** Pre-deployment checklist includes static + live HTTP security probes (`security-hardening`).
* **Full spec:** [`docs/SECURITY.md`](docs/SECURITY.md)

### 💱 USD ↔ INR Conversion

* **Live rate:** `GET /api/finance/usd-inr-rate` — cached FX rate for finance, subscriptions, and project finance forms.
* **Shared fields:** `UsdInrAmountFields.jsx` + `useUsdInrRate.js` sync USD/INR amounts across Finance, Subscriptions, Invoice settings, and Project Finance.

### 🛡️ Local Development Safeguards

* **Env Templates:** `server/.env.example` and `client/.env.example` document required variables without secrets.
* **Dev Guard:** `client/src/utils/devEnvGuard.js` warns in the browser console when `VITE_API_URL` points at a production host.
* **Prod Sync Script:** `node server/scripts/syncProdToLocal.js --yes` copies production MongoDB → local (read-only on prod); see [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md).

---

## 🗂️ Directory Structure

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

## ⚙️ Quick Start Guide

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

Production one-shot (requires `MONGODB_URI_PROD` in `server/.env`):

```bash
node scripts/seedMusicContentCalendar.js --year=2026 --prod
node scripts/reconcileDataHub.js --prod --full
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

---

## 🔒 Environment Configuration

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

## 📡 API Architecture & Routing

All application endpoints are structured beneath an explicit global `/api` gateway context pattern.

```
/api
├── /auth         → User onboarding, token provisioning, and federated Google sign-in
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

## 🔍 Diagnostic & Observability Protocol

CoreKnot is engineered to survive production strain with a rigorous multi-tiered observability layout:

* **Autonomous Killswitch Protection (`SystemHealthService`):** A middle-tier system layer that constantly probes connection paths to MongoDB and Redis. If database or caching links go offline, it immediately intercepts incoming traffic with an explicit `HTTP 503 Maintenance Mode` error response to protect database integrity.
* **Trace Propagation & Context Isolation:** Injectable correlation IDs follow requests through the execution stack. If an unhandled application error happens, the engine wraps structural metadata parameters directly into the server logs and error bodies.
* **Telemetry Diagnostics Dashboard:** Found natively under `/management/ops-logs`. It provides live telemetry charting, page analytics tracking, structural message trace indicators, and real-time error logs sorted by severity level.

---

## 🧪 Global Autonomous QA System & Auditing

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

## 📚 Documentation Index

| Document | Purpose |
| --- | --- |
| [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) | Step-by-step local environment bootstrap |
| [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md) | Local vs production MongoDB isolation |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth cookies, webhooks, CORS, password policy, QA security checks |
| [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md) | Complete AI agent reference (routes, models, rules) |
| [`docs/EMAIL_ENGINE_LOCKED.md`](docs/EMAIL_ENGINE_LOCKED.md) | Locked email tracking spec — do not modify without unlock |
| [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md) | Wire `/query` form on theshakticollective.in to Taskmaster |

---

## 🚀 Production Migration Sequence

### v1.7.55 — CRM Phone Validation, Lead Save Fix & QA Cleanup CLI

- **Lead modal UX:** `PhoneNumberFields.jsx` splits country code and national number; `leadPhoneCountries.js` enforces digit counts per region (+91=10, +971=9, +60=9, +65=8, +61=9, +44=10, +1=10); inline errors replace silent “Will save as…” hints.
- **Save reliability:** `useUpdateLead` updates paginated `['leads', params]` cache and invalidates stats; `FullScreenWorkspace` shows saving state; required-field validation blocks unsanitized saves.
- **Server validation:** `phoneCountryValidation.js` strict E.164 on create/update; `crmController.js` merges/clears corrupt duplicate leads on update.
- **Phone repair:** `sanitizer.js` + `leadPhoneRepair.js` handle overlong concatenated numbers (not just `-DUP-` suffixes); `repair:phones*` npm scripts for local/prod.
- **QA cleanup CLI:** `qa:audit`, `qa:cleanup` scripts for read-only audit and targeted purge without touching real contacts.

No DB migration. Redeploy API + static client.

### v1.7.50 — UX Clarity Remediation & QA Purge Extension

- **Shared labels:** `client/src/utils/displayLabels.js` — humanized task status/priority, inbox categories, timeframe labels, timestamps with timezone.
- **Dashboard & campaigns:** Fixed `totalOpened` metric; removed misleading empty chart; honest activity-stream copy; engagement rate rename; toast-based confirmations (no blocking alerts) in campaign and admin mail surfaces.
- **CRM / Data Hub / Inbox / Todo:** Column and filter labels clarified; sync error handling; human status text; DataTable empty-state props; Review Queue “Assigned by” copy.
- **Attendance / schedule / projects:** Geo toasts, team matrix legend, reset confirm, schedule PageHeader, progress tooltips.
- **Settings / finance / admin:** Labeled date filters, delete confirms with filenames, inline validation, settings deep-link tabs, mobile-visible actions.
- **QA purge:** `purgeQaUsers()` + `purgeQaTasks()` in `qaTestData.js` — deletes probe users, XSS/QA probe tasks, assignments, related logs, and adjusts project task counts; UI invalidates tasks/projects/user caches after purge.

No DB migration. Redeploy API + static client.

### v1.7.49 — Attendance Office Detection Fix

- **Geofence:** Office GPS radius increased from 150 m to **1000 m** (`OFFICE_RADIUS_METERS` in `attendanceRoutes.js`).
- **IP whitelist:** Tier 2 now merges **`OFFICE_PUBLIC_IP`** and **`OFFICE_IP_WHITELIST`** (fixes production WFH when only the legacy var was set).
- **Env:** On Render, set both vars with current office egress IPv4/IPv6 (comma-separated, spaces trimmed). Example: `49.36.41.166,49.36.41.118` plus office IPv6 if used.
- **Script:** `server/scripts/auditAttendanceProd.js` — read-only prod/local audit of today’s `workMode`, `verificationMethod`, and `checkInIp`.

No DB migration. Redeploy API, then undo/re check-in to refresh today’s mode if needed.

### v1.7.48 — QA v2 Engine, Security Hardening & Gamification Test Sync

- **QA backend v2:** Suites 3–8 — `qaSuite3Static.js`, `qaExtendedProbes.js`, `qaIntegrationRunners.js` (~45 integration cases), `qaActivity.js` live logging; `triggerQaHttp.js` for CI/local HTTP runs.
- **QA UI:** `QATestingPage.jsx` live probe panel, copy-failures actions, activity log on `QATestRun`.
- **Security fixes:** Webhook HMAC rejects missing signatures; CRM duplicate leads return **409**; task/announcement sanitization; unsubscribe dual-writes `Contact`; finance tenant spoof probes; login rate limit keyed per **email** (not shared IP).
- **Gamification QA:** `QA_SYNC_GAMIFICATION` waits on BullMQ during scans; `hasAwardForEntity` matches string/ObjectId entity ids.
- **Auth:** Per-email `express-rate-limit` on `/api/auth/login`; security probes skip on transient 429.

No mandatory production migration scripts for this release.

### v1.7.46 — Department Stats, Music Calendar Seed & Data Hub Full Sync

- **Department Stats:** New `/api/dashboard/dept-stats` with `1d`/`7d`/`30d` org-wide aggregations; widget shows completion %, converted count, and focus hours (`dashboardController.js`, `GenericDashboardCard.jsx`).
- **Music Content Calendar:** `musicCalendarSeedService.js`; admin **Birthdays** button on Calendar; `POST /api/calendar/seed-music-content`; `npm run seed:prod-content` bundles calendar + Data Hub full reconcile.
- **Calendar visibility:** Public events fetched with `bypassTenant` so seeded birthdays appear for all tenants.
- **Data Hub:** **Full Sync** button triggers `POST /api/data-hub/reconcile?full=true` for complete inlet re-merge.

Post-deploy production data (UI or CLI):

```bash
# Option A — in app (admin): Calendar → Birthdays; Data Hub → Full Sync

# Option B — CLI against MONGODB_URI_PROD
cd server
npm run seed:prod-content
```

### v1.7.45 — Data Hub, Calendar Guards & Music Content Calendar

- **Data Hub:** Unified CRM at Admin → CRM (`DataHubPage`, `DataHubService`, `/api/data-hub`, `shared/dataInlets.js`). Folder inlets: Exly, Leads, TSC, Booked Calls, Enquiries, Mail, Community, Active, Unsubscribed. Reconcile via UI or `reconcileDataHub.js`.
- **Past-date validation:** Tasks and calendar events blocked in past (IST) — `shared/dateValidation.js`, `TaskService`, `calendarRoutes`, client `dateValidation.js`.
- **Music Content Calendar:** 35 public `musical_day` events from `Music_Content_Calendar.pdf` — `seedMusicContentCalendar.js --year=2026 [--prod]`.
- **Task mentions:** `@user` / `#asset` tokens in task title/description with notification dispatch (`mentionNotifications.js`, `mentions/` components).
- **Overdue notifications removed:** `checkOverdue` cron deleted from `notificationService.js` (no overdue task/follow-up alerts).
- **Gamification:** Shared rules in `shared/gamificationRules.js`. Booked-call contacts merge via `LeadService` on webhook (v1.7.57+); legacy `bookedCallsSyncService.js` removed.

Post-deploy production data (legacy one-liners; prefer `npm run seed:prod-content` in v1.7.46+):

```bash
cd server
node scripts/seedMusicContentCalendar.js --year=2026 --prod
node scripts/reconcileDataHub.js --prod --full
```

### v1.7.44 - Notifications, Attendance UX & Admin Access

- **Double OS notifications:** Prune push subscriptions on subscribe; dedupe send targets by OS+browser bucket; SW `getNotifications` guard; `NotificationBridge` awaits push init; cross-tab dedupe via `localStorage` + `BroadcastChannel` (`pushSubscriptions.js`, `notifications.js`, `sw.js`).
- **Attendance:** Independent mark-in/out (UI + server); split admin check-in/check-out modals; blue locked cells; Office default in admin Mode Override dropdown.
- **Admin hardening:** Filter dashboard widgets and sidebar prefs; scope daily logs; protect QA/HolySheet/logs/attendance-reset APIs; redirect non-ops from `/attendance/all` (`navPageAccess.js`, `dashboardComponents.js`).

### v1.7.43 - Admin Workspace Colors & Hex Picker

- **WorkspaceColorPicker:** Reusable preset swatches and validated hex input (`client/src/components/ui/WorkspaceColorPicker.jsx`).
- **workspaceColors.js:** Shared `PRESET_WORKSPACE_COLORS`, `normalizeHexColor`, and `isValidHexColor`.
- **Workspace Settings:** Admins edit workspace color; creators/admins manage members (`WorkspaceSettings.jsx`).
- **API:** Workspace create/update validates hex; only admins may change color on PATCH (`projectController.js`).
- **Projects view:** Create-workspace flow uses shared picker and presets (`ProjectsView.jsx`).
### v1.7.42 - Daily Logs, Projects UX and Per-User Workspaces

- **Daily logs:** Daily log list includes `TASK_COMPLETION` activity entries for the selected day (`DailyLogPage.jsx` filter fix).
- **Navigation:** Removed duplicate **Emails** sidebar entry when customization already exposes mail routes (`OutletSidebar.jsx`, `customizationController.js`).
- **Workspace order:** Per-user workspace column order in `WorkspacePreference`; workspaces API returns order for the signed-in user (`projectController.js`, `WorkspacePreference.js`).
- **Projects view:** All projects show in each workspace card (removed six-project cap); workspace grip reorder with optimistic cache updates (`ProjectsView.jsx`).
### v1.7.40 — Subscriptions, Workspace Settings & Dev Safeguards

- Office **Subscriptions** module: model, CRUD API, `/office/subscriptions` page, and daily Render cron for due-date reminders.
- **Workspace Settings** page and workspace member/project management API.
- **Local dev safeguards:** `client/.env.example`, `server/.env.example`, `devEnvGuard.js` console warning for prod API URLs, `syncProdToLocal.js` one-shot prod→local DB copy.
- Calendar event time handling, project list/create UX, equipment registry, and dashboard card refinements.

### v1.7.39 — Project Roles & Local DB Isolation

- Canonical project roles: `admin` / `manager` / `member` with legacy `owner` → `admin` normalization in `shared/projectRoles.js`.
- `PATCH /api/projects/:id/members/:userId/role` for inline team role updates; UI in `ProjectTeam.jsx`.
- `server/config/database.js` centralizes MongoDB URI resolution with production-like DB name guards for local dev.
- Sync scripts default to `taskmaster_local` / `taskmaster_production` database names.
- New docs: `LOCAL_DEV_DATABASE.md`, `AI_AGENT_PROJECT_CONTEXT.md`.

### v1.7.38 — Website Book-a-Call Webhook

- `POST /api/webhooks/book-call` accepts public bookings from [theshakticollective.in/book-a-call](https://theshakticollective.in/book-a-call).
- BullMQ queue `WebhookQueue` processes IST conversion, rep assignment, AiSensy, and Google Sheets (`BookedCalls`) asynchronously; Redis-down paths fall back to synchronous processing.
- Google service account resolution no longer depends on a developer-local file path.

When deploying release targets `v1.7.37` or above, perform these structural database updates down against live system targets:

```bash
# 1. Execute a non-destructive simulation to verify existing dataset structures
node scripts/migrateReviewWorkflow.js --dry-run --prod

# 2. Execute the migration against your live database collections
node scripts/migrateReviewWorkflow.js --execute --prod

# 3. Clean up non-conforming test entries or legacy structural artifacts
node scripts/cleanupTestTasks.js --prod
```

---

*Distributed Private Enterprise Systems — Copyright © 2026 CoreKnot. All Rights Reserved.*
