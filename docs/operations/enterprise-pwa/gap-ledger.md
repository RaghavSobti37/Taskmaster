# Enterprise PWA Gap Ledger — CoreKnot/Taskmaster

**Audit date:** 2026-06-26  
**Maturity:** Professional PWA → Enterprise (in migration)  
**Scope:** CoreKnot/Taskmaster only

## Executive summary

| Priority | Blocker | Phase |
|----------|---------|-------|
| P0 | No local-first client DB (TanStack Query → network only) | 3, 5 |
| P0 | Mongo primary; Postgres pilot tables exist but not sync-fed | 2 |
| P1 | SW `skipWaiting()` + `autoUpdate` + `/api/*` NetworkFirst cache | 4 |
| P1 | Layer-based `pages/` layout (623 files), no `features/` | 1, 5, 9 |
| P2 | No WebAuthn passkeys | 6 |
| P2 | Webhook-only idempotency | 6 |
| P2 | No COOP/COEP for OPFS | 3 |
| P3 | No offline E2E / SW lifecycle tests | 11 |
| P3 | No Terraform IaC | 12 |

---

## §17 Production checklist scorecard

### PWA manifest (`client/public/manifest.json`)

| Item | Status | Notes |
|------|--------|-------|
| name, short_name, start_url, display, theme_color, background_color, icons | ✅ | Complete |
| 192px + 512px icons | ✅ | icon-192, icon-512 |
| Maskable icons | ✅ | icon-maskable-512 |
| display_override | ✅ | standalone, minimal-ui |
| shortcuts | ✅ | Dashboard, Inbox, Todo, Projects |
| categories | ✅ | business, productivity |
| prefer_related_applications | ✅ | false |
| share_target | ❌ | Not configured (optional) |
| file_handlers | ❌ | Not configured (optional) |
| protocol_handlers | ❌ | Not configured (optional) |
| window-controls-overlay | ❌ | Not configured |
| IARC certification | ❌ | Not configured |

### Service worker (`client/src/sw.js`, `client/vite.config.js`)

| Item | Status | Notes |
|------|--------|-------|
| clients.claim() on activate | ✅ | L14–16 |
| Cache version cleanup | ✅ | Workbox cleanupOutdatedCaches |
| API expiration plugins | ✅ | 5 min TTL on api-read cache |
| **skipWaiting on install** | ❌ **Anti-pattern** | L10–12 silent update |
| **registerType autoUpdate** | ❌ **Anti-pattern** | vite.config L38 |
| Navigation preload | ❌ | Missing |
| BroadcastChannel update UI | ❌ | Missing |
| Stale-While-Revalidate static | ⚠️ | Precache only |
| No API cache (enterprise) | ❌ | NetworkFirst on GET /api/* L18–37 |
| User skip-waiting prompt | ❌ | Missing |
| SW kill switch | ❌ | Missing |
| Dev bypass toggle | ⚠️ | devOptions.enabled: false only |

### Security

| Item | Status | Notes |
|------|--------|-------|
| Helmet CSP | ✅ | server/app/createApp.js |
| HttpOnly session cookies | ✅ | authCookie.js |
| WebAuthn passkeys | ❌ | JWT + Google OAuth only |
| Global mutating idempotency | ❌ | Webhooks only |
| COOP/COEP | ❌ | Required for OPFS |
| HSTS | ⚠️ | Vercel/Render default; verify prod |

### Local-first / data

| Item | Status | Notes |
|------|--------|-------|
| SQLite WASM + OPFS | ❌ | — |
| PowerSync replication | ❌ | — |
| Zustand UI state | ❌ | React Context only |
| Feature-folder monorepo packages | ❌ | — |

---

## Bounded contexts (server/domains)

| Domain | Owner path | Postgres tier | Sync pilot |
|--------|------------|---------------|------------|
| auth | server/domains/auth | Tier 1 (User, Tenant) | Phase 2 token API |
| projects | server/domains/projects | Tier 1 (Workspace, Project) | **Phase 5 pilot** |
| tasks | server/domains/tasks | Tier 1 (Task, TaskAssignment, TaskActivity) | **Phase 5 pilot** |
| crm | server/domains/crm | Tier 2–3 | Phase 8a |
| mail | server/domains/mail | Tier 4+ | Phase 8b |
| dashboard | server/domains/dashboard | Mixed | Post-pilot |
| data-hub | server/domains/data-hub | Tier 3+ | Phase 8+ |
| artists | server/domains/artists | Tier 3+ | Phase 8+ |

**Prisma pilot models confirmed:** Tenant, User, Workspace, Project, Task, TaskAssignment, TaskActivity (`nestjs-server/prisma/schema.prisma`).

---

## SW lifecycle issues (documented)

1. `self.skipWaiting()` in install — breaks multi-tab asset hash consistency
2. `registerType: 'autoUpdate'` — no user consent before activation
3. GET `/api/*` NetworkFirst — stale data risk; remove when local-first live
4. Chunk recovery exists (`chunkRecovery.js`) — coordinated updates still needed

---

## Target metrics (enterprise)

| Metric | Current (est.) | Target |
|--------|----------------|--------|
| Lighthouse PWA | ~80–90 | 100 |
| INP | Unmeasured | <100ms |
| Offline core views | Static shell + cached API reads | Full local-first pilot |
| Initial JS | Check bundle-analysis.html | <250KB |

---

## Phase remediation map

| Phase | Closes gaps |
|-------|-------------|
| 1 | Monorepo packages, design tokens, dependency-cruiser |
| 2 | PowerSync, dual-write, sync token API |
| 3 | SQLite worker, COOP/COEP, sync bootstrap |
| 4 | SW lifecycle, remove API cache, manifest polish |
| 5 | features/workspace, Zustand, local-first tasks |
| 6 | WebAuthn, idempotency, CSP/COOP server headers |
| 7 | Drafts, offline indicator, contextual permissions |
| 8 | CRM, mail, attendance, finance rollout |
| 9–12 | FE cleanup, observability, E2E, Terraform, §17 gate |
