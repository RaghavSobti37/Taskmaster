# NestJS Migration — Phase 5 QA Validation Status

**Date:** 2026-06-10  
**Branch context:** NestJS scaffold + attendance/mail modules alongside legacy Express  
**Tester environment:** Windows 11, Node v22.19.0, Docker CLI 29.4.3 (daemon **not running**), no `psql` on PATH, repo on OneDrive

---

## Feature validation (F-001 – F-008)

| ID | Feature | Command / check | Result | Notes |
|----|---------|-----------------|--------|-------|
| F-001 | Local Postgres setup | `setup-local-db.ps1` + `npx prisma db push` | **FAIL** | `psql` not on PATH. Docker Compose added (`docker-compose.yml`) but daemon not running — DB still missing |
| F-002 | Redis-down dev boot | `REDIS_URL=redis://127.0.0.1:6399 node dist/main.js` + curl | **PASS** | `:5001` stays up; BullMQ skipped; health 200; attendance 401 |
| F-003 | ETL mongo→postgres | `--dry-run` then `--tier=1` | **PARTIAL** | Dry-run PASS (Mongo connected, PG skipped). Tier-1 **NOT RUN** — blocked by F-001 |
| F-004 | Vite attendance proxy | Inspect `client/vite.config.js` | **PASS** | `/api/attendance` → `:5001` in dev + preview; catch-all `/api` → `:5000` |
| F-005 | Client Vite build | `cd client && npx vite build` | **PASS** | vite 5.4.21, no dep corruption errors |
| F-006 | NestJS e2e + 401 shape | `npm run test:e2e` + live curl | **PASS** | 2/2 tests; live 401 `{ error: "Not authorized, no token" }` matches Express |
| F-007 | Root CI includes NestJS | `package.json` `ci` script | **PASS (fixed)** | Added `build --workspace=nestjs-server` + `test:e2e --workspace=nestjs-server` |
| F-008 | Honest status matrix | This file | **PASS** | Updated from Phase 5 QA run |

---

## Test matrix (commands run this session)

| # | Area | Command | Result | Notes |
|---|------|---------|--------|-------|
| 1 | Legacy Express tests | `cd server && npm test` | **PASS** | 40 suites, 260 tests. Worker force-exit warning — pre-existing |
| 2 | Root typecheck | `npm run typecheck` | **PASS** | `tsc --noEmit -p tsconfig.json` clean |
| 3 | NestJS build | `cd nestjs-server && npm run build` | **PASS** | `prisma generate && nest build` → `dist/` |
| 4 | NestJS e2e | `cd nestjs-server && npm run test:e2e` | **PASS** | 2 tests: health shape + attendance 401 guard |
| 5 | NestJS live (Redis down) | `REDIS_URL=redis://127.0.0.1:6399 node dist/main.js` | **PASS** | HTTP 200 health; HTTP 401 attendance |
| 6 | Client Vite build | `cd client && npx vite build` | **PASS** | Production build + PWA injectManifest OK |
| 7 | Client Vite proxy | Inspect `client/vite.config.js` | **PASS** | Strangler active for attendance |
| 8 | Local Postgres script | `setup-local-db.ps1` | **FAIL** | `psql` not installed |
| 9 | Docker Postgres | `docker compose up -d` | **FAIL** | Docker Desktop daemon not running |
| 10 | ETL dry-run | `npm run etl:mongo-to-postgres -- --dry-run` | **PASS** | PG unavailable; Mongo counts reported |
| 11 | ETL tier-1 | `npm run etl:mongo-to-postgres -- --tier=1` | **NOT RUN** | Blocked — no local Postgres |
| 12 | Root CI NestJS | `package.json` `ci` | **PASS (fixed)** | Nest build + e2e now in pipeline |

---

## Fixes applied (Phase 5)

1. **`nestjs-server/docker-compose.yml`** — Postgres 16 Alpine on `localhost:5432`, db `coreknot`, healthcheck, named volume.

2. **`nestjs-server/README.md`** — Option A (Docker) + Option B (psql script); explicit prerequisite when neither available.

3. **Root `package.json` `ci`** — added `npm run build --workspace=nestjs-server && npm run test:e2e --workspace=nestjs-server`.

4. **`.agents/bug_report.md`** — BUG-001 (Postgres), BUG-002 (ETL tier-1 blocked), BUG-003 (empty Mongo staging counts).

---

## Live server observations (port 5001, Redis down)

```
GET /api/health     → 200  { ok: true, status: "HEALTHY", dependencies.postgres.state: "disconnected" }
GET /api/attendance → 401  { error: "Not authorized, no token" }
```

Startup warnings (non-fatal):

- `Prisma connect skipped: Database 'coreknot' does not exist` — start Docker Desktop → `docker compose up -d` → `npx prisma db push`
- `REDIS_URL unreachable — BullMQ workers skipped` — expected when Redis down; attendance still available
- `LegacyRouteConverter` — Express 5 / path-to-regexp wildcard auto-conversion on trace middleware route

---

## Remaining blockers

| Blocker | Severity | Detail |
|---------|----------|--------|
| PostgreSQL not provisioned locally | **High** | Start Docker Desktop + `docker compose up -d` OR install Postgres + run `setup-local-db.ps1`; then `npx prisma db push` |
| ETL tier-1 not validated | **High** | Depends on Postgres; Mongo staging shows 0 docs on this machine |
| Prod strangler / cutover | **High** | Vite proxy dev-only; prod still serves attendance from Express `:5000` |
| Mail tracking parity | **High** | Email engine locked on Express; Nest mail module skipped when Redis down |
| OneDrive + npm workspaces | **Medium** | Full root `npm install` unreliable on this machine; CI/Linux source of truth |
| Render service | **High** | No `render.yaml` / Blueprint entry for NestJS sidecar on `:5001` |
| Auth session parity | **Medium** | JWT/cookie auth ported; token revocation + tenant context need prod validation |

---

## Commands to reproduce

```powershell
# Legacy tests + typecheck
Set-Location server; npm test
Set-Location ..; npm run typecheck

# Local Postgres (pick one)
Set-Location nestjs-server
docker compose up -d                    # requires Docker Desktop running
# OR .\scripts\setup-local-db.ps1       # requires psql on PATH
npx prisma db push

# NestJS
npm run build
npm run test:e2e

# Live smoke (Redis down)
$env:REDIS_URL="redis://127.0.0.1:6399"
node dist/main.js
curl.exe http://127.0.0.1:5001/api/health
curl.exe http://127.0.0.1:5001/api/attendance   # expect 401

# ETL
npm run etl:mongo-to-postgres -- --dry-run
npm run etl:mongo-to-postgres -- --tier=1       # after Postgres up

# Client
Set-Location ..\client
npx vite build
```

---

## Recommended next steps

1. Start Docker Desktop → `docker compose up -d` → `npx prisma db push` on dev machines.
2. Re-run ETL `--tier=1` after Postgres provisioned; confirm Mongo seed data if counts expected.
3. Provision staging Postgres + run full ETL; flip `DATABASE_URL` to Supabase staging.
4. Deploy NestJS as separate Render web service on port 5001.
5. Move repo off OneDrive-synced path for reliable Windows dev installs.
