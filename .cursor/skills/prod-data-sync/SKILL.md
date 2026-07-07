---
name: prod-data-sync
description: >-
  Safe local↔production data migration for CoreKnot — structure refactors,
  campaign data replacement, mass push with guardrails. Use when user wants
  prod data on local, replace prod with local, mass push, or data refactor
  between environments.
---

# Prod Data Sync (CoreKnot)

## Safety gates (non-negotiable)

1. **Never** run destructive prod writes without explicit user confirmation.
2. Check `ALLOW_PROD_DB_IN_DEV` and `devEnvGuard` — prod URI in dev is blocked by default.
3. `npm run audit:exposure` before any commit from migration scripts.
4. No secrets in committed scripts — use env vars.

## Read first

- `docs/operations/DATA_ENV_TOPOLOGY.md`
- `docs/operations/LOCAL_DEV_DATABASE.md`
- `docs/operations/SCRIPTS_RUNBOOK.md`
- `server/config/syncCollections.js`
- `server/scripts/` — existing migration patterns

## Patterns

| Task | Approach |
|------|----------|
| **Prod → local (TSC, recommended)** | `npm run sync:prod-tenant-tsc` — one org (`PLATFORM_TENANT_SLUG=tsc`); skips Data Hub/Exly; finance metadata-only |
| Prod → local (operational) | `npm run sync:prod-to-local:operational` — all tenants; no CRM spine |
| Prod → local (full) | `npm run sync:prod-to-local` — all collections (heavy; includes CRM) |
| Local → prod | User confirms → idempotent upsert, not blind delete+insert |
| Mass push | Single orchestrated script with progress log; not manual one-by-one in chat |
| Campaign replace | Target collection + MailEvent linkage; verify counts after |
| Single-tenant cleanup | `consolidatePlatformTenant.js` then `restorePlatformTenantSetup.js` |

## TSC tenant sync details

Script: `server/scripts/syncProdTenantToLocal.js`

- **Read-only** on prod (`secondaryPreferred`)
- **Writes** only `taskmaster_local` (name must contain `local` unless `SYNC_ALLOW_NON_LOCAL_TARGET=1`)
- **Skipped collections:** `TENANT_SYNC_SKIP` in `syncCollections.js` (CRM/Data Hub + `exlyofferings`)
- **Finance:** copies rows but strips `extractedText`, file URLs/keys, attachments
- **After:** restart local API; keep `MAIL_USE_PROD_DB=false`

## Anti-patterns (user has hit these)

- One-by-one chat pushes — too slow; write script
- Replacing prod without backup snapshot
- Batching that hides failures — log each row result
- Full sync when user only needs TSC operational data — use tenant sync instead

## Verify after sync

- Row counts: projects, tasks, users vs prod for same `tenantId`
- Skipped collections empty locally (`tscdatas`, `exlybookings`, `leads`, …)
- Finance sample: metadata present, `fileUrl` empty, no `extractedText`
- App smoke: login, dashboard, one project list
