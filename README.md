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
  <img src="https://img.shields.io/badge/version-1.7.43-126d5e?style=flat-square" alt="Version 1.7.43" />
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
│  Dashboard │ Projects │ CRM │ Finance │ Inbox │ Schedule │ Admin│
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
| **Security** | Authentication | Stateless JWT, Google OAuth 2.0 Passport flow, Role-Based Access Control (RBAC) |
| **Deployment** | CI/CD Infrastructure | Render (Web Services + Managed Static CDN handles asset distribution) |

---

## 🚀 Key Features

### 📊 Ultra-Density Productivity Engine

* **Headerless Three-Column View:** Combines live leaderboard podiums, team announcements, a global pinboard, private sticky notes, and active schedules inside a zero-latency single screen.
* **Dynamic Gamification:** Tracks user activity and awards Experience Points (XP) from structural configurations. Resets top-performers weekly on Monday 00:00 IST via native aggregation on `XPAuditLog` while preserving lifetime levels.
* **Global Navigation:** Keyboard-driven command palettes (`Cmd/Ctrl + K`) and persistent floating Fast Action Buttons (FAB) for instantaneous record generation.

### 💼 Automated Sales & CRM Pipelines

* **Ingestion Vectors:** Multi-channel lead ingestion via structured CSV uploads, real-time Google Sheets integrations, and Exly webhook endpoints.
* **Auto-Routing Allocations:** Automatically assigns incoming customer opportunities to the least-loaded sales representative currently online.
* **Transactional Communication:** Dual-route AiSensy WhatsApp setups simultaneously issue real-time tracking confirmations to clients and internal alert indicators to the assigned sales team.

### 🛡️ Institutional Task Review Workflow

* **Governance Matrix:** Enforces strict code/task ownership logic (`shared/taskReviewRules.js`). Tasks explicitly delegated to peers are frozen upon completion and routed directly into an immutable `in-review` state queue. Self-assigned entries bypass validation rules entirely.
* **Role Enforcement:** Restricts execution bounds; only the explicit task creator retains roll-back, state manipulation, or permanent completion override permissions.
* **Project moves:** Any project member (or creator, assignee, admin) may move a task to another project they can access via the Edit Task modal. Server validates source/target membership, syncs workspace, updates project task counts, and refreshes TanStack Query caches without a full page reload.
* **In-review edits:** Save remains available on `in-review` tasks so fields like project, title, and description can be updated; Approve/Rollback actions stay separate for reviewers.

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
│       ├── components/         # Atomic UI controls, design primitives, and form modules
│       ├── pages/              # Routed view targets (Dashboard, Inbox, Todo, CRM)
│       ├── hooks/              # Isolated React Query abstractions & hardware listeners
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
├── shared/                     # Multi-runtime definitions (Logger schemas, types, projectRoles)
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
```

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
├── /crm          → Third-party contact capture engines and pipeline automations
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

CoreKnot features a project-wide autonomous auditing infrastructure powered by React Doctor and Omni-Security verification models:
* **AST & Static Analysis:** Checks all routed page files (`client/src/pages`) for unsafe property chains (`row.property` access missing optional chaining) and unmemoized event handler declarations (`const handleSomething = ...` missing `useCallback`).
* **Swarm Probing:** Automatically identifies target endpoints inside component files and executes unauthenticated API probes to detect privilege escalation vectors.
* **CLI Testing Harness:** Integrated test scripts (`server/scripts/runQAScan.js`) compile AST patterns and run automated sweeps to ensure clean, 100% bug-free reports before production deployment.

---

---

## 📚 Documentation Index

| Document | Purpose |
| --- | --- |
| [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) | Step-by-step local environment bootstrap |
| [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md) | Local vs production MongoDB isolation |
| [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md) | Complete AI agent reference (routes, models, rules) |
| [`docs/EMAIL_ENGINE_LOCKED.md`](docs/EMAIL_ENGINE_LOCKED.md) | Locked email tracking spec — do not modify without unlock |
| [`docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](docs/ARTIST_ENQUIRY_WEBSITE_FORWARD.md) | Wire `/query` form on theshakticollective.in to Taskmaster |

---

## 🚀 Production Migration Sequence


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
