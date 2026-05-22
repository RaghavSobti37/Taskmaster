# Taskmaster CRM & Operations Hub

Taskmaster is a high-density, mission-critical operational hub and CRM system built with a robust **MERN stack** (MongoDB, Express, React, Node.js). Engineered for maximum efficiency, zero-fluff data architecture, and an "impeccable" UI/UX design (Pro-Max standards), this platform serves as the central nervous system for sales, operations, analytics, and team collaboration.

---

## 🌟 Core Features

- **Unified CRM & Data Hub**: Real-time synchronization with external services (e.g., Exly Webhooks, Resend mailers) utilizing a `ContactService` deduplication layer.
- **Spec-Driven Autonomous QA**: Native background QA monitoring via automated staging environment checks to trace edge-cases and schema violations dynamically.
- **High-Density Pro-Max Design**: Strict 4px modular scale grid, semantic pastel encoding, and absolute zero reliance on placeholder/mock data.
- **Operational Workflows**: Fully featured task management, Kanban boards, Gantt charts, team collaboration chats, and daily productivity logging.
- **Data Completeness**: Comprehensive Mongoose hooks enforce airtight input sanitization, data uniqueness, and cross-reference validation.

---

## 🤖 AI Toolchain & Agentic Memory

This project is actively maintained and built alongside state-of-the-art AI agents. The repository utilizes an **Agentic Memory** architecture to preserve long-term context and architectural rules across sessions.

*   **Specify CLI / Spec-Kit**: Used for spec-driven development (SDD). Preserves AI context inside `.specify/memory/`. Ensures that all new agents inherit the architectural blueprints.
*   **Antigravity (by Google Deepmind)**: Acts as the primary autonomous agent for complex backend refactors, multi-file synchronizations, background worker logic, and E2E automated test fixing.
*   **Claude Code / Copilot**: Local assistants for rapid inline prototyping and code-generation tasks.

*All legacy agent memory files (formerly in `.github/agents` and `agentic_memory`) have been migrated to the unified `.specify/memory/` standard.*

---

## 🏗 System Architecture (MERN)

The application follows a strictly decoupled client-server architecture.

### 1. Frontend Structure (`client/src/`)
Built with **React** and **Vite**, leveraging high-end motion concepts and TanStack Query for optimal client-side caching.

```text
client/src/
├── components/          # Reusable UI elements and modals
│   ├── ui/              # Primitive components (NexusModal, CKDropdown, etc.)
│   ├── dashboard/       # Dashboard widgets (Velocity, Tasks, Schedule)
│   ├── crm/             # Lead management and follow-up tools
│   └── project/         # Kanban, List, and Gantt project views
├── pages/               # Top-level route components mapped to React Router
├── contexts/            # React Context providers (Auth, Theme, Toast)
├── hooks/               # Custom hooks (e.g., useTaskmasterQueries wrapping TanStack)
├── utils/               # Client-side utility functions
└── index.css            # Tailwind v4 configuration and root CSS variables
```

**Frontend Tenets**:
*   **Data Hydration**: Absolute purge of mock states. All data is fetched via `@tanstack/react-query` with optimistic updates.
*   **Design Constraints**: 4px hard grid system. Pastel color-encoding for success/warning/danger semantics. Flawless dark mode depth profiling.

### 2. Backend Structure (`server/`)
Built with **Node.js** and **Express**, utilizing **Mongoose** for schema definitions, strict validation, and relational population.

```text
server/
├── models/              # Mongoose Schemas (Lead, User, Task, Project, ExlyBooking, etc.)
├── controllers/         # Request handling and HTTP response mapping
├── routes/              # Express Router definitions
├── services/            # Deep business logic (ContactService, exlyService, etc.)
├── scripts/             # CLI tasks, Cron jobs, and Autonomous QA checks
├── middleware/          # Security, Auth (JWT), and Error handling
└── utils/               # Shared sanitizers, loggers, and parsers
```

**Backend Tenets**:
*   **Mongoose Hooks**: Strict `pre('save')` hooks ensure zero-fluff text sanitization. Emails are normalized, and phones are standardized to global formats prior to persistence.
*   **Deduplicated Source of Truth**: The `ContactService` handles data aggregation from CRMs and external webhooks into a unified model, preventing duplicate CRM `Lead` creation.
*   **Optimized Queries**: All read-heavy operations use `.lean()` and MongoDB `$facet` or `$group` aggregation pipelines instead of redundant `countDocuments()`.

---

## 🚀 Development Setup & Deployment

The application runs two localized servers concurrently for development.

### Prerequisites
- Node.js (v18+)
- MongoDB (v6+)
- API Keys for Google Auth, UploadThing, Exly, and Resend (set in `.env`).

### Environment Variables
Ensure `.env` files exist in both `client/` and `server/` directories.

**Server (`server/.env`)**:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/taskmaster
JWT_SECRET=your_secure_secret
NODE_ENV=development
```

### Running Locally

To boot the entire application:

1. **Start the Backend**:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   *Runs on `http://localhost:5000` via nodemon.*

2. **Start the Frontend**:
   ```bash
   cd client
   npm install
   npm run dev
   ```
   *Runs on `http://localhost:5173` via Vite.*

### Background Processes & QA Checks
The repository features an autonomous QA runner that executes unit/integration tests against the local staging database.
```bash
node server/scripts/runQATests.js
```
This triggers a headless pipeline to test schema validation, webhook deduplication, and caching strategies without front-end interaction.

---

*This project enforces a zero-tolerance policy against dummy data and fluff. Code meticulously.*
