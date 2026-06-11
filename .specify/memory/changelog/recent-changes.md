# Recent Changes

> Updated each push-and-document session. Full version history: `docs/VERSION_HISTORY.md`

---

## 2026-06-11 � Vercel installCommand fix

- **Root cause:** Vercel Root Directory `client/` � old `installCommand` called `node ../scripts/generateVercelConfig.js` ? file not found ? exit 127
- **Fix:** Canonical generator at `client/scripts/generateVercelConfig.cjs`; `vercel.json` / `client/vercel.json` / `client/package.json` scripts updated; root `scripts/generateVercelConfig.js` delegates to `.cjs`
- **Deploy:** Set `RENDER_API_PROXY_URL` on Vercel; script writes `/api` + `/socket.io` rewrites at install time
- **NestJS:** `server-nest/dist/` gitignored (prior commit)

---

## 2026-06-11 � Access control, error UX, Artist OS

- **Page permission API gates:** Mail, admin, workspace, CRM, proxy, and related Express routes enforce department pagePermissions (aligned with client hasPageAccess / 
avPageAccess).
- **QueryErrorBanner:** Rolled out on query-driven pages for consistent failure states and retry actions.
- **CRM:** Lock parity and scoped delete; sales reps can see legacy leads missing crmType.
- **Tenant security:** Partial hardening on tenant-scoped operations (see uth/security.md).
- **Artist OS:** Tabbed artist workspace, React Query hooks (rtistOs.js), team access utilities.
- **Assets / nav:** Assets hub RQ loaders; navigation respects page permissions.
- **Tests:** Vitest for ForcePasswordChangeGate, QueryErrorBanner, query defaults, artist OS shell, login return path, session merge; server tests for gates.
- **Audits:** udit:exposure allows YOUR-PRODUCTION-API placeholders in *.example env templates.

## 2026-06-10 — Memory restructure

- Reorganized `.specify/memory/` into component folders with `INDEX.md` + `MASTER.md`
- Removed duplicate `agentic_memory/` and stale flat memory files
- Component docs: platform, architecture, frontend, backend, auth, features, operations, changelog

---

## 2026-06-10 — Supabase IPv4 fix for Render

- **Root cause:** `db.*.supabase.co` direct Postgres is IPv6-only; Render outbound is IPv4 → `ENETUNREACH`
- **Fix:** `SUPABASE_PG_MODE=rest` on Render. Runtime metadata writes use PostgREST (`restQuery.js`)
- **Files:** `server/services/supabase/restQuery.js`, `backupStore.js`, `snapshotStore.js`, `mailRollupStore.js`, `batchInsert.js`, `logStore.js`, `syncService.js`, `health.js`, `config/supabase.js`
- **Render:** `render.yaml` sets `SUPABASE_PG_MODE=rest` + `SUPABASE_SECRET_KEY` on API, staging, backup cron

---

## 2026-06-10 — Supabase secondary store & backup migration

- Supabase Postgres + Storage offloads logs, audits, rollups, CRM snapshots, production backups from Atlas M0
- Mongo primary for live CRM/email; mirrors async; GridFS purged after successful Supabase dump
- Verified locally: `npm run backup:verify-supabase`

---

## 2026-06-10 — Mobile login stable

- Committed `client/vercel.json` rewrite + proxy health fallback
- Phone/PWA: same-origin `/api/*` via Vercel rewrite
- Fallback: `apiProxyHealth.js` + `loginRequest.js` → direct `VITE_API_URL` if proxy 404
- Smoke: `npm run verify:mobile-proxy` → 200 on `/api/health`

---

## v1.0.7 (current release)

- Unified same-origin `/api` on every device
- Login gated on `/api/auth/me`
- `/socket.io` Vercel rewrite
- Local dev always uses Vite proxy
