<p align="center">
  <img src="client/public/brand-mark.svg" alt="CoreKnot logo" width="80" height="80" />
</p>

<h1 align="center">CoreKnot</h1>

<p align="center">
  <strong>Enterprise CRM &amp; operations hub</strong><br/>
  Multi-tenant workspace for projects, sales pipelines, finance, email campaigns, attendance, and team gamification — built for agency workflows.
</p>

<p align="center">
  <a href="#about">About</a> ·
  <a href="#features">Features</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#development">Development</a> ·
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.7-126d5e?style=flat-square" alt="Version 1.0.7" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node 18+" />
  <img src="https://img.shields.io/badge/react-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/mongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/PWA-enabled-5A0FC8?style=flat-square&logo=pwa&logoColor=white" alt="PWA" />
</p>

---

## About

CoreKnot is a decoupled, multi-tenant operational platform that unifies day-to-day agency work into one high-density dashboard. It is used internally by **The Shakti Collective (TSC)** to run six business lines — Films, Artists, Academy, Collabs, Studios, and Corporate — from a shared operational hub.

| Layer | Stack |
| --- | --- |
| **Frontend** | React 18, Vite 5, Tailwind CSS v4, TanStack Query, PWA |
| **Backend** | Node.js, Express, Mongoose, BullMQ, Socket.IO |
| **Data** | MongoDB Atlas (primary), Redis (queues), Supabase (backups & secondary store) |
| **Deploy** | Render (API), Vercel (static frontend) |

The monorepo also includes a **NestJS + Prisma** service (`nestjs-server/`) for Postgres-backed migration work, plus shared packages under `packages/`.

---

## Features

### Projects & tasks
- Kanban-style project boards with workspace-level access control
- Institutional task review workflow (creator vs assignee rules, rollback, XP on completion)
- Task activity timeline with `@mentions` and `#asset` links
- Bug reports auto-routed to the platform owner

### CRM & sales
- Lead management with follow-up reminders and lock/audit rules
- Separate **Artist CRM** pipeline (`crmType: artist`) with CSV import and booking enquiries
- Booked-call webhook from [theshakticollective.in](https://theshakticollective.in/book-a-call)
- **Data Hub** — unified person graph across Exly, leads, TSC, mail, and community inlets

### Email & campaigns
- Mail Template Studio (visual + raw HTML) with approval workflow
- Campaign wizard with audience filters (CRM, Data Hub, HolySheet, Exly, engagement history)
- Resend delivery with open/click tracking (locked engine — see [`docs/EMAIL_ENGINE_LOCKED.md`](docs/EMAIL_ENGINE_LOCKED.md))

### Finance & operations
- Document upload with OCR (pdf-parse, tesseract.js)
- Invoice and reimbursement submissions with approval queue
- Office subscriptions with due-date reminders
- USD/INR conversion on finance forms

### HR & attendance
- Manual Office / WFH check-in with optional IP hint
- Worked hours vs daily-log reconciliation
- Leave requests and team attendance roster

### Platform
- Role-based page access by department
- Gamification (XP, weekly leaderboard, IST reset)
- Real-time notifications (in-app, email, Web Push)
- Admin script runner, QA testing suite, and system health dashboard
- Keyboard shortcuts and command palette (`Cmd/Ctrl + K`)

> Full release notes: [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              React SPA (Vite + PWA)                         │
│  Dashboard · Projects · CRM · Finance · Inbox · Admin       │
│            TanStack Query  ·  Service Worker                  │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS / WSS  (/api/*)
┌──────────────────────────▼──────────────────────────────────┐
│                 Express API (server/)                         │
│  Auth · Tasks · CRM · Mail · Finance · Gamification · Admin   │
│  Rate limiting · Helmet · System health middleware            │
└──────┬─────────────┬──────────────┬──────────────────────────┘
       │             │              │
   MongoDB       Redis/BullMQ   Socket.IO
  (Mongoose)      (queues)      (realtime)
```

**Production routing:** The browser always calls same-origin `/api` on the frontend domain. Vercel rewrites `/api/*` and `/socket.io/*` to the Render API so HttpOnly session cookies stay first-party on every device.

**Auth:** Sliding JWT in HttpOnly cookie (`coreknot_token_v3`) — 7-day inactivity window, 30-day absolute cap. Google OAuth supported.

---

## Repository structure

```
CoreKnot/
├── client/                 # React SPA (Vite, PWA)
│   ├── src/pages/          # Routed views
│   ├── src/components/     # UI components
│   └── public/             # Static assets, PWA manifest
├── server/                 # Express REST API
│   ├── routes/             # API route modules
│   ├── models/             # Mongoose schemas
│   ├── services/           # Business logic & integrations
│   └── scripts/            # Migrations, seeds, maintenance
├── nestjs-server/          # NestJS + Prisma (Postgres migration path)
├── shared/                 # Cross-runtime contracts (validation, rules, inlets)
├── packages/               # design-tokens, ui-components, sync-client, etc.
├── e2e/                    # Playwright smoke tests
└── docs/                   # Architecture specs and runbooks
```

---

## Quick start

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or Atlas)
- **Redis** (recommended for queues and notification locks)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_ORG/CoreKnot.git
cd CoreKnot
npm run install:all
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Set at minimum in `server/.env`:

- `MONGODB_URI` — local database (e.g. `taskmaster_local`)
- `JWT_SECRET`

Set in `client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

See [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) and [`docs/LOCAL_DEV_DATABASE.md`](docs/LOCAL_DEV_DATABASE.md) for the full checklist.

### 3. Seed local data (optional)

```bash
cd server
node scripts/seedDepartmentsAndTaskTypes.js
node scripts/reconcileDataHub.js --full
```

### 4. Run

```bash
# From repo root — starts API then client
npm run preflight
npm run dev
```

| Service | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 |

Or run each side separately: `npm run dev:server` and `npm run dev:client`.

---

## Development

### Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | API + client concurrently |
| `npm test` | Server Jest suite |
| `npm test --prefix client` | Client Vitest |
| `npm run ci` | Full CI pipeline locally |
| `npm run audit:exposure` | Pre-commit secret scan (required) |
| `npm run audit:deadcode` | Orphan module scan |
| `npm run sync:prod-to-local` | Copy production MongoDB → local |

### Testing

| Command | Scope |
| --- | --- |
| `npm test` | Server unit + integration tests (MongoDB Memory Server) |
| `npm test --prefix client` | Client component and hook tests |
| `npm run test:e2e:public` | Playwright — landing + login (no credentials) |
| `npm run test:e2e:auth` | Playwright auth flows (`E2E_EMAIL` + `E2E_PASSWORD`) |

Integration tests use **MongoDB Memory Server** — no local `mongod` required.

### Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a PR. Requirements:

- `npm run audit:exposure` passes
- Server tests, client lint, client build pass
- No direct pushes to `main`

---

## Security

| Check | Command |
| --- | --- |
| Working-tree exposure | `npm run audit:exposure` |
| Orphan modules | `npm run audit:deadcode` |
| Git history needles | `npm run audit:history` |
| Env preflight | `npm run preflight` |

**Never commit:** API keys, MongoDB URIs, `server/.env.render`, or live `vercel.json` with secrets.

**Production hosts:** Real Render and Vercel URLs live in gitignored `.cursor/production-hosts.local.json`. Copy from [`.cursor/production-hosts.local.example.json`](.cursor/production-hosts.local.example.json). Do not use legacy `CoreKnot-jfw0` hosts from old docs.

**Platform admin:** `ROOT_ADMIN_USER_IDS` / `PLATFORM_OWNER_USER_ID` env vars plus MongoDB `PlatformSettings` — not hardcoded emails.

Full spec: [`docs/SECURITY.md`](docs/SECURITY.md)

---

## Deployment

| Environment | Host |
| --- | --- |
| Frontend | Vercel (Root Directory: `client/`) |
| API | Render web service |
| Database | MongoDB Atlas |
| Queues | Render Key Value (`noeviction` policy required) |

Env checklist: [`docs/DEPLOY_ENV.md`](docs/DEPLOY_ENV.md)  
Environment matrix: [`docs/ENVIRONMENT_MATRIX.md`](docs/ENVIRONMENT_MATRIX.md)

Webhook endpoints (replace with your Render host):

```
POST /api/webhooks/book-call
POST /api/webhooks/artist-enquiry
```

---

## Documentation

| Document | Purpose |
| --- | --- |
| [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md) | **Start here** — master index |
| [`docs/STARTUP_GUIDE.md`](docs/STARTUP_GUIDE.md) | Local install and run |
| [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md) | Complete agent reference |
| [`docs/COMPONENT_STANDARDS.md`](docs/COMPONENT_STANDARDS.md) | UI conventions |
| [`docs/SECURITY.md`](docs/SECURITY.md) | Auth, webhooks, CORS |
| [`docs/SCRIPTS_RUNBOOK.md`](docs/SCRIPTS_RUNBOOK.md) | Maintenance scripts |
| [`docs/VERSION_HISTORY.md`](docs/VERSION_HISTORY.md) | Release notes |
| [`docs/EMAIL_ENGINE_LOCKED.md`](docs/EMAIL_ENGINE_LOCKED.md) | Email tracking (locked) |
| [`docs/LOGO_LOCKED.md`](docs/LOGO_LOCKED.md) | Brand mark and spinner (locked) |

Agent memory hub: [`.specify/memory/INDEX.md`](.specify/memory/INDEX.md)

---

## Brand

The **Harmonic Frequency** mark represents TSC's six business segments converging on a shared operational hub. Logo geometry, colors, and the default loading spinner (`frl-v-02`) are locked — see [`docs/LOGO_LOCKED.md`](docs/LOGO_LOCKED.md) before making brand changes.

---

*Copyright © 2026 CoreKnot. All rights reserved.*
