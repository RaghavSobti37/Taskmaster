# Multi-tenant security phase (deferred)

This document tracks planned hardening for CoreKnot's `tenantPlugin` and `bypassTenant` usage. **Not implemented yet** — scheduled as a dedicated security-only PR batch.

## Current model

- Most Mongoose queries auto-filter by `tenantId` from AsyncLocalStorage.
- `setOptions({ bypassTenant: true })` skips that filter for admin, tracking, Data Hub, and legacy paths.

## Risks

- A new query without tenant context may attach to "Default Tenant" auto-created in `tenantPlugin` validate hook.
- `bypassTenant` is opt-out by convention, not an allowlist enforced at runtime.

## Planned work

1. Grep audit of all `bypassTenant` call sites (~40+).
2. Publish `docs/TENANT_BYPASS_ALLOWLIST.md` with justification per file.
3. Production: fail fast when `tenantId` missing instead of silent default tenant.
4. Extend `server/services/qa/qaSuite3Static.js` to flag new bypass usage in route handlers.

## Out of scope until this phase

Changing email tracking bypass paths (`server/routes/track.js`) — see `docs/EMAIL_ENGINE_LOCKED.md`.
