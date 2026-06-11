# System Architecture

## High-level diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     React SPA (Vite + PWA) — Vercel                     │
│  Dashboard │ Projects │ CRM │ Finance │ Inbox │ Schedule │ Admin │ Hub  │
│            TanStack Query  │  Service Worker (sw.js)  │  Socket.IO      │
└────────────────────────────┬────────────────────────────────────────────┘
                             │  Same-origin /api/* + /socket.io/* proxy
┌────────────────────────────▼────────────────────────────────────────────┐
│                    Express API (server.js) — Render                     │
│  Auth │ Tasks │ Projects │ CRM │ Mail │ Notifications │ Data Hub        │
│  SystemHealthService │ Rate Limiting │ Helmet │ Gzip │ Trace IDs        │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────────┘
       │              │              │              │
   MongoDB        Redis/BullMQ   Socket.IO     External APIs
   (Mongoose)     (queues)       (realtime)    (Exly, Resend, Google, Meta…)
       │
   Supabase Postgres (secondary mirror via post-save hooks + sync worker)
```

---

## Request lifecycle

1. Browser hits `tsccoreknot.com` (or `localhost:5173` in dev)
2. API calls use relative `/api/...` (Vercel/Vite proxy → Render API)
3. `authMiddleware` verifies `coreknot_token_v3`, slides session if due
4. Page-permission checks on gated Express routers (mail, admin, CRM, workspace, proxy)
5. `tenantPlugin` scopes queries to user's tenant
6. Controller → Service → Model
7. `notificationDispatcher` / `systemLogService` / Supabase mirrors on write
8. Socket.IO broadcasts realtime updates to subscribed channels

---

## Repository layout

```
Taskmaster/
├── client/              React 18 SPA (Vite 5, Tailwind v4)
│   └── src/
│       ├── App.jsx      Routes, lazy loading, auth gates
│       ├── pages/       60+ routed pages
│       ├── components/  24 subfolders (admin, dashboard, tasks, ui, brand…)
│       ├── hooks/       useTaskmasterQueries, useStatusCounts, etc.
│       ├── contexts/    Auth, Theme, Sidebar, Toast, Confirm
│       └── lib/         realtime, systemLogBridge, loadingDisplay
├── server/              Node.js Express API
│   ├── app/             createApp, registerRoutes, startServer
│   ├── domains/       auth, crm, mail, tasks, projects, artists, data-hub…
│   ├── routes/          Legacy route shims (53 files)
│   ├── models/          72 Mongoose models
│   ├── services/        90+ service files
│   ├── workers/         6 background workers
│   └── scripts/         113+ maintenance scripts
├── nestjs-server/       NestJS migration (port 5001)
├── shared/              Cross-runtime contracts + business rules
├── e2e/                 Playwright specs
├── scripts/             Root audit/verify tooling
└── docs/                Long-form specs
```

**Path aliases (client):** `@` → `./src`, `@shared` → `../shared`

---

## Dual backend (transitional)

| Backend | Port | Status |
| --- | --- | --- |
| Express (`server/`) | 5000 | **Production today** |
| NestJS (`nestjs-server/`) | 5001 | Strangler Fig migration in progress |

Vercel/Vite proxy flips individual `/api/<domain>` prefixes to NestJS as domains port. See [backend/nestjs-migration.md](../backend/nestjs-migration.md).

---

## Middleware stack

| File | Purpose |
| --- | --- |
| `authMiddleware.js` | JWT verify, session slide, absolute expiry |
| `loggerMiddleware.js` | Request logging |
| `traceMiddleware.js` | Correlation ID injection |
| `errorMiddleware.js` | Centralized error handler |
| `concurrencyMiddleware.js` | Optimistic concurrency (project `__v`) |

---

## Realtime

- Socket.IO on Express HTTP server (`server/config/realtime.js`)
- Client: `client/src/lib/realtime.js` — `subscribeToChannel`
- JWT-authenticated connections
