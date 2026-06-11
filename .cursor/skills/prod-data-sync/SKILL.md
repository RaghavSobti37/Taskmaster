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

- `docs/DATA_ENV_TOPOLOGY.md`
- `docs/LOCAL_DEV_DATABASE.md`
- `docs/PRODUCTION_MIGRATION.md`
- `server/scripts/` — existing migration patterns

## Patterns

| Task | Approach |
|------|----------|
| Prod → local | Export script → sanitize PII if sharing → import to local Mongo |
| Local → prod | User confirms → idempotent upsert, not blind delete+insert |
| Mass push | Single orchestrated script with progress log; not manual one-by-one in chat |
| Campaign replace | Target collection + MailEvent linkage; verify counts after |

## Anti-patterns (user has hit these)

- One-by-one chat pushes — too slow; write script
- Replacing prod without backup snapshot
- Batching that hides failures — log each row result

## Verify after sync

- Row counts per collection
- Sample spot-check (campaign recipients, leads tenantId)
- App smoke: login, one list page, one write path
