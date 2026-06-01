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
  <img src="https://img.shields.io/badge/version-1.7.37-126d5e?style=flat-square" alt="Version 1.7.37" />
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

### 📑 OCR Document Parsing & Finance Ops

* **Ingestion Pipelines:** Multi-file asynchronous drag-and-drop file uploaders featuring deep retries, intelligent chunk batching, and partial-success state tracking.
* **Extraction Processing:** Leverages specialized pipelines using `pdf-parse` and `tesseract.js` engines to programmatically turn physical balance sheets or receipts into relational ledger payloads.

### 🐛 Platform Bug Reporting

* **Floating Report Widget:** Persistent bug-report FAB on all authenticated routes (`HelpBugButton.jsx`).
* **Auto-Routing:** `POST /api/tasks/bug` creates tasks under **Tech Stack & Maintenance**, assigns to the platform owner, and syncs all users into the project with assign-capable roles.
* **UX:** Title required, description optional; Enter submits from title field, Ctrl+Enter from description.

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
│   ├── routes/                 # Explicitly mapped REST routing topologies
│   ├── controllers/            # Pure business logic controllers
│   ├── models/                 # Mongoose schema primitives and indexes
│   ├── services/               # Third-party adapters (Notification, Mail, AWS SES)
│   ├── middleware/             # Authorization, Rate Limiting, and Health Guards
│   ├── scripts/                # Database seed engines, backup suites, and migrations
│   └── templates/              # Transactional MJML/HTML email layouts
├── shared/                     # Multi-runtime definitions (Logger schemas, types)
├── docs/                       # Architectural specs and runtime manuals
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
```

Open your newly created `.env` file and define your structural configurations. To spin up local hardware push alerts, generate unique cryptographic VAPID signatures:

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
| `DEBUG_BYPASS` | Development Only | Enables a stateless internal bypass mechanism (`Authorization: Bearer bypass_token`). |

---

## 📡 API Architecture & Routing

All application endpoints are structured beneath an explicit global `/api` gateway context pattern.

```
/api
├── /auth         → User onboarding, token provisioning, and federated Google sign-in
├── /tasks        → Standard task mutations, dynamic tracking states, and role assignments
├── /projects     → Structural workspace definitions, access states, and board layouts
├── /crm          → Third-party contact capture engines and pipeline automations
├── /notifications→ Push delivery registries, system status counts, and message updates
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

## 🚀 Production Migration Sequence

When deploying release targets `v1.7.37` or above, perform these structural database updates down against live system targets:

```bash
# 1. Execute a non-destructive simulation to verify existing dataset structures
node scripts/migrateReviewWorkflow.js --dry-run --prod

# 2. Execute the migration against your live database collections
node scripts/migrateReviewWorkflow.js --execute --prod

# 3. Clean up non-conforming test entries or legacy structural artifacts
node scripts/cleanupTestTasks.js --prod
```

For comprehensive deep-dives into platform dependencies, automated testing strategies, or data extraction workflows, review our architectural documentation housed directly within the `/docs` directory.

---

*Distributed Private Enterprise Systems — Copyright © 2026 CoreKnot. All Rights Reserved.*
