# Recent changes

## 2026-06-10 — Supabase IPv4 fix for Render

- **Root cause:** `db.*.supabase.co` direct Postgres is IPv6-only; Render outbound is IPv4 → `ENETUNREACH` on backup widget + statsWorker CRM snapshot mirror.
- **Fix:** `SUPABASE_PG_MODE=rest` on Render (auto when `RENDER=true`). Runtime metadata writes use PostgREST (`restQuery.js`) instead of `pg` pool; storage uploads unchanged (HTTPS).
- **Files:** `server/services/supabase/restQuery.js`, `backupStore.js`, `snapshotStore.js`, `mailRollupStore.js`, `batchInsert.js`, `logStore.js`, `syncService.js`, `health.js`, `config/supabase.js`.
- **Render:** `render.yaml` sets `SUPABASE_PG_MODE=rest` + `SUPABASE_SECRET_KEY` on API, staging, backup cron.

## 2026-06-10 — Supabase secondary store & backup migration

- Supabase Postgres + Storage offloads logs, audits, rollups, CRM snapshots, production backups from Atlas M0.
- Mongo primary for live CRM/email; mirrors async; GridFS purged after successful Supabase dump.
- Verified locally: `npm run backup:verify-supabase`.
