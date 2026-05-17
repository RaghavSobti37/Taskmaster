# ⚡ Taskmaster v1.2.1

[![React](https://img.shields.io/badge/Frontend-React%2018-blue?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Build-Vite-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

**Taskmaster** is a premium, high-density work management and CRM platform built for high-performance teams. It combines project management, real-time communication, and advanced CRM capabilities into a single, optimized workspace.

---

## 🌟 Key Features

| Feature | Capabilities |
| :--- | :--- |
| **🚀 Dashboard** | Real-time task tracking, productivity metrics, and one-click completion with 10s undo. |
| **📁 Projects** | Multi-view management (List, Kanban, Gantt) with automated progress rollups and phases. |
| **🧠 Workflow Canvas** | Node-based visual process architecting tool for mapping complex logic via drag-and-drop. |
| **📅 Smart Calendar** | Persistent MongoDB-backed calendar with Public/Private visibility, past date entry prevention, and project integration. |
| **📈 Advanced CRM** | Lead tracking (New/Hot/Warm), CSV imports with deduplication, and automated follow-ups. |
| **📧 Admin Mailer** | Complete broadcast campaign management with Resend Webhooks (Svix-verified) for native analytics sync (Opens, Clicks, Bounces, Delivery) and robust queue recovery mechanisms. |
| **📝 Daily Logs** | Precision work logging with project tagging and automated performance reporting. |
| **💬 Team Chat** | Real-time messaging with channel-based organization and task referencing. |
| **🛠️ Admin Panel** | Root-level system oversight, user role management (Admin/User), and deep activity audits. |
| **📎 Assets** | Project-scoped resource management supporting multiple external links per entry and direct file storage (via UploadThing). |
| **🎵 Artists Hub** | Multi-platform analytics (Spotify, YouTube, Meta) featuring dedicated dynamic sub-pages (`HarshadGolesarPage`, `YugmPage`, `MohitShankarPage`) with zero hardcoded metrics, real retention rates, live API sync, and step-by-step ID retrieval tooltips. |

---

## ⚡ Performance Optimization Layer

Taskmaster is engineered for speed and efficiency using a multi-layer optimization framework:

### 1. Smart Data Caching (React Query & Supabase)
- **Zero-Flicker Navigation**: Server state is cached globally using `@tanstack/react-query`.
- **Real-Time Edge**: Supabase pipelines ensure real-time push events and high-performance edge sync.
- **Optimistic UI**: Mutations (like adding logs or completing tasks) update the UI **instantly** before the server responds.
- **Background Sync**: Automatic background refetching ensures data remains current without manual refreshes.

### 2. Backend Efficiency
- **Trigger.dev Automation**: Durable background job execution (mailing, rollups) runs reliably outside the main Express loop.
- **Lean Queries**: All read-only API endpoints utilize Mongoose `.lean()` to bypass hydration, resulting in ~3-5x faster response times.
- **Indexed Lookups**: Strategic indexing on `userId`, `projectId`, and `createdAt` ensures O(1) retrieval for core operations.
- **Response Compression**: Gzip/Brotli compression applied to all JSON payloads to minimize latency.

---

## 🏗️ System Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend (React/Vite)"]
        UI[UI Components] --> RQ["React Query (Cache Layer)"]
        UI --> SB["Supabase (Edge Auth/Sync)"]
        UI --> UT["UploadThing (File Uploads)"]
    end

    subgraph API ["Backend API (Node/Express)"]
        RQ --> A_API["/api/auth"]
        RQ --> T_API["/api/tasks"]
        RQ --> P_API["/api/projects"]
        RQ --> C_API["/api/crm"]
        RQ --> L_API["/api/logs"]
        RQ --> ART_API["/api/artists"]
        TRG["Trigger.dev (Background Jobs)"] -.-> API
    end

    subgraph Storage ["Database (MongoDB)"]
        A_API & T_API & P_API & C_API & L_API & ART_API --> DB[(MongoDB)]
    end
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** v18+
- **MongoDB** (Local or Atlas)
- **Google OAuth Credentials** (Optional, for calendar sync)
- **Resend API Key** (Optional, for mail campaigns)
- **Supabase / UploadThing / Trigger.dev** keys (for full feature parity)

### Installation

1. **Clone & Setup Server**
   ```bash
   cd server
   npm install
   cp .env.example .env # Configure your MONGO_URI, JWT_SECRET, RESEND, etc.
   npm run dev
   ```

2. **Setup Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

3. **Initialize Database (Optional)**
   ```bash
   cd server
   node seeder.js
   ```

---

## 📂 Project Structure

```text
├── client/
│   ├── src/
│   │   ├── hooks/          # Centralized React Query hooks & logic
│   │   ├── contexts/       # Auth, Theme, and Sidebar state
│   │   ├── pages/          # 15+ high-density functional pages (incl. WorkflowCanvas)
│   │   └── components/     # Atomic UI primitives & complex modals (incl. VisualExplainerModal)
├── server/
│   ├── config/         # Supabase & UploadThing configurations
│   ├── controllers/    # Optimized .lean() business logic
│   ├── models/         # Mongoose schemas with strategic indexing
│   ├── routes/         # Express API routing with JWT protection
│   └── services/       # Trigger.dev jobs, mail drivers, and notifications
└── agentic_memory/     # Comprehensive project architecture docs
```

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS v4, Framer Motion, Lucide Icons, React Query, React Flow.
- **Infrastructure**: Supabase (Realtime/Edge), UploadThing (Asset Storage).
- **Backend**: Node.js, Express, Trigger.dev (Background Jobs), JWT, Compression, Rate-Limiting.
- **Database**: MongoDB, Mongoose ODM.
- **Tooling**: ESLint, PostCSS, Axios.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built for excellence by CoreKnot.*
