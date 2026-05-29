<p align="center">
  <img src="client/public/favicon.svg" alt="CoreKnot" width="72" height="72" />
</p>

<h1 align="center">Taskmaster</h1>

<p align="center">
  <strong>Enterprise CRM & Operations Hub</strong><br/>
  Unified project management, sales pipeline, finance ops, and team productivity — built for high-density agency workflows.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#environment-variables">Environment</a> ·
  <a href="#changelog">Changelog</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.7.31-126d5e?style=flat-square" alt="Version 1.7.31" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/mongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/PWA-enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## Overview

Taskmaster (branded **CoreKnot** in the PWA shell) is a full-stack operational platform that combines CRM, project delivery, finance document management, gamification, and internal communications in a single workspace. The codebase follows a decoupled **React + Vite** frontend and **Express + MongoDB** backend, with a secure proxy layer for third-party integrations.

| Layer | Stack |
|-------|-------|
| Frontend | React 18, Vite 5, Tailwind CSS v4, TanStack Query, Framer Motion |
| Backend | Node.js, Express, Mongoose, BullMQ, Trigger.dev |
| Data | MongoDB Atlas, Redis (queues/cache), Socket.IO realtime |
| Auth | JWT + Google OAuth, role-based route guards |
| Deploy | Render (web service + static CDN), tsccoreknot.com |

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Backend Proxy](#backend-proxy)
- [Notifications & PWA](#notifications--pwa)
- [API Surface](#api-surface)
- [Scripts & Tooling](#scripts--tooling)
- [Diagnostic Protocol](#diagnostic-protocol)
- [Changelog](#changelog)

---

## Features

### Dashboard & Productivity
- **Three-column dashboard** — Leaderboard podium, announcements, pin board, schedule, todos today, projects today, and private notes in a single view.
- **Pin board** — Team-wide shared notes with composer; persisted via `/api/pinboard`.
- **Private notes** — Per-user sticky notes with project linking via `/api/notes`.
- **Todo page** (`/todo`) — Full task list with search, status/priority/category/project filters, workspace color accents, and flash-highlight deep links.
- **Schedule grid** (`/schedule`) — Department-aware workload view with AM/PM/FULL slot assignment.
- **Command palette** — Global keyboard-driven navigation and quick actions.
- **Quick-add menu** — Floating FAB for fast task/project creation.

### Notifications & Inbox
- **Inbox page** (`/inbox`) — Category-filtered notification feed (task, CRM, attendance, announcement, department, system).
- **Web Push (PWA)** — VAPID-based desktop push via service worker; subscribe/unsubscribe endpoints.
- **Email dispatch** — Branded HTML notification template with CTA deep links.
- **Status counts** — Sidebar badges for overdue/today tasks, follow-ups, calendar events, and unread notifications.
- **Flash highlight** — Navigate from notification → target row with animated highlight.

### Departments & Task Types
- **Department model** — Signup-time department selection, color/slug/sort order, admin seeding.
- **Task types** — Department- and project-role-scoped task categories.
- **Change requests** — Users can request department transfers; admins approve/reject.

### CRM & Sales
- Lead management with CSV import, HolySheet sync, and Exly webhook ingest.
- Follow-up scheduling with Today / Overdue / Upcoming tabs.
- Least-loaded sales rep auto-assignment on booked calls.
- AiSensy WhatsApp dual integration (customer + rep alerts).
- Exly analytics with paid/free booking breakdown and revenue engine.

### Projects & Workspaces
- Kanban, list, team, and Gantt views per project.
- Workspace drag-and-drop reordering (admin).
- Task assignment via `TaskAssignment` join model with virtual `assignees`.
- Schedule slots (`AM`, `PM`, `FULL`) and `scheduleDate` on tasks.

### Finance & Operations
- Multi-file drag-and-drop upload with batching, retries, and partial-success handling.
- OCR/OMR document parsing (`pdf-parse`, `tesseract.js`).
- Admin Script Runner at `/admin/scripts` for one-click server script execution.

### Admin & Integrations
- User/team/CRM/mail/gamification admin panels.
- Announcement dispatch with recipient-level email tracking and open pixel.
- Artists Hub with Spotify, YouTube, Meta live analytics.
- Backend proxy for YouTube, OpenAI, Exly, HolySheet (auth-protected).
- Resend/SES mail campaigns with Svix webhook verification.

### PWA
- Installable progressive web app with `manifest.json`, 192/512 icons, and injectManifest service worker.
- App shortcuts to Inbox and Todo.
- Install banner with deferred prompt handling.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React SPA (Vite + PWA)                      │
│  Dashboard │ Projects │ CRM │ Finance │ Inbox │ Schedule │ Admin│
│              TanStack Query  │  Service Worker (sw.js)          │
└────────────────────────────┬────────────────────────────────────┘
                             │  /api/*
┌────────────────────────────▼────────────────────────────────────┐
│                    Express API (server.js)                      │
│  Auth │ Tasks │ Projects │ CRM │ Notifications │ Departments   │
│  PinBoard │ Notes │ Schedule │ Finance │ Gamification │ Mail   │
│  SystemHealthService │ Rate Limiting │ Gzip │ Helmet            │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
   MongoDB         Redis/BullMQ   Socket.IO     External APIs
   (Mongoose)     (queues)       (realtime)    (Exly, Resend, Google…)
```

### Design System
- **Pro-Max UI** — Semantic CSS tokens, zero-flash theme engine, Framer Motion micro-animations.
- **Shared form components** — `MemberSelect`, `PrioritySelect`, `StatusSelect`, `ProjectSelect`, `WorkspaceSelect`, `TaskCategorySelect`.
- **UI primitives** — `EmptyState`, `DataLoading`, `Spinner`, `SectionCard`, `SearchInput`, `IconButton`, `PageLoadGuard`, `FlashHighlight`.

---

## Project Structure

```
Taskmaster/
├── client/                    # React frontend (Vite)
│   ├── public/
│   │   ├── manifest.json      # PWA manifest
│   │   └── icons/             # 192px & 512px app icons
│   ├── scripts/
│   │   └── generate-pwa-icons.mjs
│   └── src/
│       ├── components/        # UI, dashboard, forms, schedule
│       ├── pages/             # Route pages (dashboard, inbox, todo, schedule…)
│       ├── hooks/             # React Query hooks, PWA install
│       ├── contexts/          # Auth, theme, sidebar, toast, confirm
│       ├── lib/               # Socket.IO client (realtime.js)
│       ├── constants/         # Task options, categories
│       ├── utils/             # Notifications, workspace colors, formatting
│       └── sw.js              # Service worker (injectManifest)
├── server/                    # Express backend
│   ├── routes/                # REST API routers
│   ├── controllers/           # Business logic
│   ├── models/                # Mongoose schemas
│   ├── services/              # Notifications, push, departments, mail
│   ├── middleware/            # Auth, error handling, health checks
│   ├── scripts/               # Migrations, seeds, QA, finance sync
│   ├── templates/             # HTML email templates
│   └── .env.example           # Environment template
├── docs/                      # Project documentation
├── .specify/memory/           # Architecture & agent memory
└── GLOBAL_RULES.md            # Coding philosophy & config rules
```

---

## Quick Start

### Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js 18+ | LTS recommended |
| MongoDB | Local instance or Atlas cluster |
| Redis | Optional — required for BullMQ queues and cache |
| API keys | See [Environment Variables](#environment-variables) |

### 1. Clone & install

```bash
git clone https://github.com/RaghavSobti37/Taskmaster.git
cd Taskmaster

# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and service keys
```

Optional — Web Push (desktop notifications):

```bash
npx web-push generate-vapid-keys
```

Add to `server/.env`:
```env
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:your@email.com
```

Frontend API URL (optional in `client/.env`):
```env
VITE_API_URL=http://localhost:5000
```

When `VITE_API_URL` is blank, the frontend uses relative `/api` paths.

### 3. Seed departments (first run)

```bash
cd server
node scripts/seedDepartmentsAndTaskTypes.js
```

### 4. Run locally

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:5173** — API proxied to **http://localhost:5000**.

### 5. Generate PWA icons (optional)

```bash
cd client
npm run generate-icons
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Token signing secret |
| `FRONTEND_URL` | Prod | Public app URL for email CTAs |
| `VAPID_PUBLIC_KEY` | Push | Web Push public key |
| `VAPID_PRIVATE_KEY` | Push | Web Push private key |
| `VAPID_SUBJECT` | Push | `mailto:` contact for push |
| `EMAIL_ADDRESS` | Mail | SMTP sender address |
| `EMAIL_PASSWORD` | Mail | SMTP password |
| `RESEND_API_KEY` | Mail | Resend API key |
| `REDIS_URL` | Queues | Redis for BullMQ |
| `GOOGLE_CLIENT_ID` | OAuth | Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | OAuth | Google OAuth secret |
| `DEBUG_BYPASS` | Dev | Enable local auth bypass |
| `CORS_ALLOWED_ORIGINS` | Prod | Comma-separated extra origins |

Full template: `server/.env.example`

---

## Backend Proxy

Mounted at `/api/proxy`. Protected by auth middleware.

| Service | Path prefix |
|---------|-------------|
| YouTube | `/api/proxy/youtube` |
| OpenAI | `/api/proxy/openai` |
| Exly | `/api/proxy/exly` |
| HolySheet | `/api/proxy/holysheet` |

**Local dev bypass:**
```env
DEBUG_BYPASS=true
```
```bash
curl -H "Authorization: Bearer bypass_token" "http://localhost:5000/api/proxy/youtube/search?part=snippet&q=taskmaster&maxResults=1"
```

---

## Notifications & PWA

### Notification categories
| Category | Triggers |
|----------|----------|
| `task` | Assignment, due date, completion |
| `crm` | Lead assignment, follow-up reminders |
| `attendance` | Check-in/out events |
| `announcement` | Manager broadcasts |
| `department` | Change request status |
| `review` | Task review requests |
| `system` | Admin alerts |

### Key endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications` | List notifications (category-filtered) |
| GET | `/api/notifications/status-counts` | Sidebar badge counts |
| POST | `/api/notifications/push/subscribe` | Register push subscription |
| GET | `/api/notifications/push/vapid-key` | Public VAPID key |
| PATCH | `/api/notifications/:id/read` | Mark single read |
| POST | `/api/notifications/read-all` | Mark all read |

### PWA install
The app registers a service worker via `vite-plugin-pwa` (injectManifest strategy). Users see an install banner on supported browsers. Shortcuts in `manifest.json` link directly to `/inbox` and `/todo`.

---

## API Surface

| Prefix | Module |
|--------|--------|
| `/api/auth` | Login, register, OAuth |
| `/api/tasks` | Task CRUD, assignments |
| `/api/projects` | Projects, workspaces, phases |
| `/api/users` | Profiles, avatars |
| `/api/crm` | Leads, follow-ups, imports |
| `/api/notifications` | Inbox, push, status counts |
| `/api/departments` | Departments, task types, change requests |
| `/api/schedule` | Workload grid |
| `/api/pinboard` | Team pin board |
| `/api/notes` | Private user notes |
| `/api/attendance` | Attendance tracking |
| `/api/announcements` | Manager announcements + email dispatch |
| `/api/finance` | Documents, folders, OCR upload |
| `/api/gamification` | XP, leaderboard, streaks |
| `/api/exly` | Exly campaigns & analytics |
| `/api/mail` | Email campaigns |
| `/api/admin/scripts` | Script runner (admin) |
| `/api/proxy` | Third-party API proxy |

---

## Scripts & Tooling

| Command | Location | Purpose |
|---------|----------|---------|
| `npm run dev` | server / client | Development servers |
| `npm run build` | client | Production frontend build |
| `npm run generate-icons` | client | Regenerate PWA icons |
| `npm run sync-finance-to-prod` | server | Mirror finance docs to prod |
| `node scripts/seedDepartmentsAndTaskTypes.js` | server | Seed departments & task types |
| `node scripts/runQATests.js` | server | Automated QA suite |
| `node scripts/verify_infrastructure.js` | server | DB & env health check |

---

## Diagnostic Protocol

- **SystemHealthService** — Blocks business logic when DB/Redis is offline; returns 503 Maintenance Mode.
- **Centralized error propagation** — Structured logging with operational vs programmer error routing.
- **Performance logging** — Request timing written to `server/performance.log`.
- **Graceful shutdown** — SIGTERM/SIGINT handlers reduce port conflicts on nodemon restart.

---

## Changelog

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

#### New Utilities & Scripts
```text
client/src/contexts/ConfirmContext.jsx
client/src/lib/realtime.js
client/src/utils/departmentPermissions.js
client/src/utils/dashboardTasks.js
client/src/utils/taskCompletion.js
server/config/realtime.js
server/utils/departmentPermissions.js
server/scripts/migrateRoleToDepartment.js
server/scripts/testRealtime.js
```

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

#### UI Component Library
- Form selects: `MemberSelect`, `PrioritySelect`, `StatusSelect`, `ProjectSelect`, `WorkspaceSelect`, `TaskCategorySelect`, `TaskFormFields`.
- Primitives: `EmptyState`, `DataLoading`, `Spinner`, `SectionCard`, `SearchInput`, `IconButton`, `PageLoadGuard`, `FlashHighlight`, `AddMembers`, `RoleOptionBoxes`.
- `/todo` page with full filter suite; `/components` dev showcase page.
- `QuickAddMenu` floating action button in `MainLayout`.

#### New Files
```text
client/src/pages/inbox/InboxPage.jsx
client/src/pages/todo/TodoPage.jsx
client/src/pages/schedule/SchedulePage.jsx
client/src/components/NotificationBridge.jsx
client/src/components/PwaInstallBanner.jsx
client/src/components/QuickAddMenu.jsx
client/src/hooks/usePwaInstall.js
client/src/sw.js
client/public/manifest.json
server/controllers/noteController.js
server/controllers/pinBoardController.js
server/routes/noteRoutes.js
server/routes/pinBoardRoutes.js
server/routes/departmentRoutes.js
server/routes/scheduleRoutes.js
server/services/notificationDispatcher.js
server/services/pushNotificationService.js
server/services/departmentService.js
server/models/Department.js
server/models/TaskType.js
server/models/PinBoardNote.js
server/models/UserNote.js
server/scripts/seedDepartmentsAndTaskTypes.js
```

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

---

## License

Private — All rights reserved.
