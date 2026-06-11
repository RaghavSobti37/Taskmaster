# Multi-tenant security phase (deferred)

This document tracks planned hardening for CoreKnot's `tenantPlugin` and `bypassTenant` usage.

## Current model

- Most Mongoose queries auto-filter by `tenantId` from AsyncLocalStorage.
- `setOptions({ bypassTenant: true })` skips that filter for admin, tracking, Data Hub, and legacy paths.

## Risks

- A new query without tenant context may attach to "Default Tenant" auto-created in `tenantPlugin` validate hook.
- `bypassTenant` is opt-out by convention, not an allowlist enforced at runtime.

## Shipped (Wave 2 partial — 2026-06-10)

1. **`authMiddleware.js`:** `DEBUG_BYPASS` disabled when `NODE_ENV=production` (`isDebugBypassEnabled`).
2. **`tenantPlugin.js`:** production validate hook fails fast when `tenantId` missing (no silent Default Tenant).
3. **`workerTenantContext.js`:** `runWithWorkerTenant` / `runForEachTenant` for cron/workers.
4. **`aggregateWithTenant`:** dashboard controllers + `notificationRoutes` Lead aggregations.
5. **`leadWriteService.deleteLead`:** tenant-scoped delete (removed unconditional `bypassTenant`).
6. **`TaskAssignment`:** `tenantPlugin` applied.

## Shipped (Wave 2 partial — 2026-06-11)

1. **`docs/TENANT_BYPASS_ALLOWLIST.md`:** route/service/controller/util justification table.
2. **`bypassTenantPolicy.js`:** expanded SERVICE/CONTROLLER/UTIL allowlists + `isScriptPath`.
3. **`aggregateWithTenant`:** CRM stats (`crmStatsService`, `statsWorker`), mail events (`mailEventQueryService`, `mailMetricsService`, `profileSendStats`).
4. **`statsWorker`:** `runForEachTenant` wrapper for snapshot cron.
5. **`tenantPlugin`:** `Attendance`, `MailTemplate`, `NavbarPreference`, `ShortcutPreference`, `WorkspacePreference`.
6. **`qaSuite3Static`:** checks for new plugins + aggregate wrappers; route allowlist imports policy module.

## Planned work (remaining)

1. Grep audit automation for all `bypassTenant` call sites (~40+).
3. Extend `server/services/qa/qaSuite3Static.js` to flag new bypass usage in route handlers.
4. Add `tenantPlugin` to remaining models (`Attendance`, `MailTemplate`, user preferences, etc.).
5. Wrap remaining raw `.aggregate(` call sites (CRM stats, Data Hub, mail metrics, workers).
6. Per-tenant worker iteration (`statsWorker`, etc.) via `runForEachTenant`.
7. Compound unique indexes `{ tenantId, email }` and backfill `tenantId` on legacy rows.
8. Super-admin role + optional cross-tenant bypass for break-glass ops.

## Out of scope until this phase

Changing email tracking bypass paths (`server/routes/track.js`) — see `docs/EMAIL_ENGINE_LOCKED.md`.
