# System Architecture

## High-level diagram

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     React SPA (Vite + PWA) â€” Vercel                     â”‚
â”‚  Dashboard â”‚ Projects â”‚ CRM â”‚ Finance â”‚ Inbox â”‚ Schedule â”‚ Admin â”‚ Hub  â”‚
â”‚            TanStack Query  â”‚  Service Worker (sw.js)  â”‚  Socket.IO      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚  Same-origin /api/* + /socket.io/* proxy
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    Express API (server.js) â€” Render                     â”‚
â”‚  Auth â”‚ Tasks â”‚ Projects â”‚ CRM â”‚ Mail â”‚ Notifications â”‚ Data Hub        â”‚
â”‚  SystemHealthService â”‚ Rate Limiting â”‚ Helmet â”‚ Gzip â”‚ Trace IDs        â”‚
â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
       â”‚              â”‚              â”‚              â”‚
   MongoDB        Redis/BullMQ   Socket.IO     External APIs
   (Mongoose)     (queues)       (realtime)    (Exly, Resend, Google, Metaâ€¦)
       â”‚
   Supabase Postgres (secondary mirror via post-save hooks + sync worker)
```

---

## Request lifecycle

1. Browser hits `tsccoreknot.com` (or `localhost:5173` in dev)
2. **Local dev:** Vite proxies to `localhost:5000`; on OneDrive-synced repos, watch `awaitWriteFinish` and ignored `public/icons` reduce spurious HMR full reloads
3. API calls use relative `/api/...` (Vercel/Vite proxy â†’ Render API)
4. `authMiddleware` verifies `coreknot_token_v3`, slides session if due
5. Page-permission checks on gated Express routers (mail, admin, CRM, workspace, proxy)
6. `tenantPlugin` scopes queries to user's tenant
7. Controller â†’ Service â†’ Model
8. `notificationDispatcher` / `systemLogService` / Supabase mirrors on write
9. Socket.IO broadcasts realtime updates to subscribed channels (websocket may log a failed upgrade on Vercel; client falls back to polling)

---

## Repository layout

```
Taskmaster/
â”œâ”€â”€ client/              React 18 SPA (Vite 5, Tailwind v4)
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ App.jsx      Routes, lazy loading, auth gates
â”‚       â”œâ”€â”€ pages/       60+ routed pages
â”‚       â”œâ”€â”€ components/  24 subfolders (admin, dashboard, tasks, ui, brandâ€¦)
â”‚       â”œâ”€â”€ hooks/       useTaskmasterQueries, useStatusCounts, etc.
â”‚       â”œâ”€â”€ contexts/    Auth, Theme, Sidebar, Toast, Confirm
â”‚       â””â”€â”€ lib/         realtime, systemLogBridge, loadingDisplay
â”œâ”€â”€ server/              Node.js Express API
â”‚   â”œâ”€â”€ app/             createApp, registerRoutes, startServer
â”‚   â”œâ”€â”€ domains/       auth, crm, mail, tasks, projects, artists, data-hubâ€¦
â”‚   â”œâ”€â”€ routes/          Legacy route shims (53 files)
â”‚   â”œâ”€â”€ models/          72 Mongoose models
â”‚   â”œâ”€â”€ services/        90+ service files
â”‚   â”œâ”€â”€ workers/         6 background workers
â”‚   â””â”€â”€ scripts/         113+ maintenance scripts
â”œâ”€â”€ nestjs-server/       NestJS migration (port 5001)
â”œâ”€â”€ shared/              Cross-runtime contracts + business rules
â”œâ”€â”€ e2e/                 Playwright specs
â”œâ”€â”€ scripts/             Root audit/verify tooling
â””â”€â”€ docs/                Long-form specs
```

**Path aliases (client):** `@` â†’ `./src`, `@shared` â†’ `../shared`

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
- Client: `client/src/lib/realtime.js` â€” `subscribeToChannel`
- JWT-authenticated connections
