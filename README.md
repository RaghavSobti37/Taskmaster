# Taskmaster CRM & Operations Hub

Taskmaster is the unified operational hub and CRM system in this repository. It uses a decoupled React frontend and an Express/MongoDB backend, with a secure backend proxy for third-party service integrations.

---

## 🔧 Current Project Structure

- `server/` — Backend API, Express routes, Mongoose models, middleware, auth, proxy controller, gamification engines, Redis queue support.
- `client/` — React application built with Vite, Tailwind, Clerk auth hooks, frontend routing, and gamification UI.
- `docs/PROJECT_MEMORY.md` — Architecture and design memory for the project.
- `GLOBAL_RULES.md` — Master configuration and coding philosophy rules.
- `server/.env.example` — Server environment variable template.

---

## 🚀 Setup (Full Local Project)

### Prerequisites
- Node.js 18+
- MongoDB running locally or accessible remotely
- Redis if you want queue/cache/background worker functionality
- API keys for services used by the backend

### Environment setup

1. Copy the example server environment:
   ```bash
   cd server
   cp .env.example .env
   ```
2. Fill in the required variables in `server/.env`.
3. In `client/`, confirm `client/.env` exists. If you want an explicit backend URL, set:
   ```env
   VITE_API_URL=http://localhost:5000
   ```

If `VITE_API_URL` is blank, the frontend uses relative `/api` paths and relies on the Vite proxy config to forward `/api` calls to `http://localhost:5000`.

### Run the application

Backend:
```bash
cd server
npm install
npm run dev
```

Frontend:
```bash
cd client
npm install
npm run dev
```

The frontend should be available on `http://localhost:5173`, proxied to the backend on `http://localhost:5000`.

---

## 🌐 Backend Proxy Behavior

The backend proxy routes are mounted at `server.js` via `/api/proxy`.

Supported proxy services:
- `youtube`
- `openai`
- `exly`
- `holysheet`

The proxy is protected by the backend auth middleware, so every request must include an `Authorization: Bearer <token>` header.

**Local dev testing shortcut**:
- Set `DEBUG_BYPASS=true` in `server/.env`
- Send `Authorization: Bearer bypass_token` from `localhost`

Example local proxy test:
```bash
curl.exe -i -H "Authorization: Bearer bypass_token" "http://localhost:5000/api/proxy/youtube/search?part=snippet&q=taskmaster&maxResults=1"
```

### Verified result
A local proxy test with `DEBUG_BYPASS=true` and `Authorization: Bearer bypass_token` succeeded and returned a valid YouTube search response.

---

## 🧩 Important Notes

- `client/.env` uses `VITE_API_URL` to configure the frontend base API URL. If empty, relative `/api` paths are forwarded by Vite proxy rules in `client/vite.config.js`.
- If `POST /api/auth/login` fails with malformed JSON in PowerShell, the issue is usually quoting. Use proper JSON escaping or Node fetch instead.
- The server currently uses `server/.env` values like `MONGODB_URI`, `JWT_SECRET`, and third-party service keys.

---

## 📘 Recommended Quick Start

1. Start MongoDB
2. Start Redis (recommended)
3. Start backend `server`
4. Start frontend `client`
5. Open `http://localhost:5173`

If local auth or proxy testing is needed before a normal login token is available, use the debug bypass mode.

## Hardened Diagnostic Protocol
- **SystemHealthService:** Prevents business logic execution if dependencies (DB, Redis) are offline. Auto-transitions to 503 Maintenance Mode.
- **Centralized Error Propagation:** Strict structured logging and error routing (Operational vs Programmer).
- **Diagnostic Scripts:** Use server/scripts/verify_infrastructure.js to test raw database and environment health.
- **QA Automation:** `server/scripts/runQATests.js` includes advanced automated test cases covering gamification queues, webhooks, and Mongoose hooks.

## Version
- Current: **1.7.25**

## [2026-05-28] Version 1.7.25 - Major UI/UX & Admin Updates
### Structure Changes
- **Workspaces:** Added `order` field for drag-and-drop reordering (admin-only)
- **Workspace Reordering:** New `PUT /api/projects/workspaces` endpoint with order persistence
- **Deleted:** SOCIAL MEDIA workspace from defaults (production migration script included)
- **Production Migration:** Automated migration with `server/scripts/migrate-production.js` for database schema updates

### UI/UX Improvements
- **Modal System:** Unified `ModalShell` component with consistent sizing and centering (replaces scattered modal implementations)
- **Admin Workspaces:** Drag project cards between workspaces; drag workspace headers to reorder
- **Leads Analytics:** 
  - Added "Warm Leads" stat (meaningful connection + not converted)
  - Clickable stats to filter: Warm Leads, Converted, Total
  - Real-time stats by role (admin sees global, reps see personal)
- **Task Colors:** Tasks now show workspace color (not project color) on dashboard
- **Settings Redesign:**
  - Discord-style save bar: full-width bottom bar with Cancel + Save buttons
  - Improved toggle switches (dark mode, notifications) with better styling
  - Added Sign Out button in Password & Security section
  - Leave request form: added Cancel button
  - Invoice amount: removed scroll-wheel increment (text input with decimal validation)
- **Sidebar Cleanup:**
  - Removed Settings and Logout nav items
  - Removed "Online" status indicator and Refresh button
  - Cleaner user profile card (name + role only)

### Data Management
- **All Data Page:** Consolidated to single page (removed tabs); stats moved to corner badge
- **Import Modal:** Replaced side drawer with centered ModalShell
- **Search Bar:** Full-width search + Import/Refresh buttons in single row
- **Delete Button:** Shows only when items selected

### Dashboard & Analytics
- **Attendance:** Removed Hours column
- **Daily Logs:** Removed "Completed Today" card (kept Activity Grid and Goal)
- **All Data Page:** Shows only Total count in compact badge (removed 4 stat cards)

### Bug Fixes
- Fixed password verification: backend now selects password field before comparing
- Fixed sidebar "All Data" highlight on other admin pages
- Fixed LeadsPage useEffect hook import
- Fixed statFilter initialization order in LeadsPage

## [2026-05-27] Version 1.7.24
- Implemented CRM Webhook for direct Next.js Booked Call ingest.
- Automated Least-Loaded Sales Rep assignment upon booking.
- Configured Dual AiSensy WhatsApp integration (Customer confirmation & Rep Alert).
- Synced `BookedCalls` Google Sheet directly from CRM logic.
- Implemented UPSERT logic in Lead creation to gracefully handle duplicate emails during booking.
- Updated AiSensy templates and payload attributes for sales reps and customers.
- Applied TSC Brandbook styles, including extracted patterns and ink spill textures to authentication and landing pages for a modern, paper-like feel.
- Enhanced Dashboard TaskTable with colored left-border indicators to visually link tasks to their assigned projects.

## [2026-05-26] Version 1.7.23
- Resolved input lag and cursor reset issues on metadata editing panels via `editForm` local state synchronization and onBlur update triggers.
- Replaced absolute overlay preview navigation with a styled top navbar to align with global UI standards.
- Integrated `pdf-parse` and `tesseract.js` OCR/OMR processing on backend for document details extraction.
- Imported historical Basecamp invoices and receipts into database collections.

## [2026-05-26] Version 1.7.21
- Fixed email signature rendering issues using imported base64 assets.
- Corrected frontend CSV/HolySheet parsing logic to split compound emails on commas and semicolons immediately upon import.
- Cleaned up obsolete stats refresh buttons.
