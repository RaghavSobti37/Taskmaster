# Contributing to CoreKnot

## Before you code

1. Read [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md)
2. Production API/frontend URLs: **gitignored** [`.cursor/production-hosts.local.json`](.cursor/production-hosts.local.json) (copy from [`.cursor/production-hosts.local.example.json`](.cursor/production-hosts.local.example.json)) — never use legacy `CoreKnot-jfw0` hosts from old docs
3. Run `npm run preflight` (repo root) after configuring `server/.env`
4. Respect [`docs/LEGACY_FREEZE.md`](docs/LEGACY_FREEZE.md) and locked zones (email, logo)

## Local workflow

```bash
npm run install:all
cp server/.env.example server/.env   # fill secrets
npm run preflight
npm run dev                        # or separate server/client terminals
```

### NestJS local Postgres (F-001)

**Start Docker Desktop first** — required when using Docker Compose (no native `psql` needed).

```powershell
cd nestjs-server
cp .env.example .env               # DATABASE_URL defaults to localhost:5432/coreknot
npm run db:setup                   # docker compose up --wait + prisma db push + etl schema
npm run start:dev                  # http://localhost:5001 — curl /api/health for postgres state
```

If `docker compose` fails with `dockerDesktopLinuxEngine` / pipe not found, Docker Desktop is not running. Alternative: install PostgreSQL locally and run `.\scripts\setup-local-db.ps1` then `npm run db:push`.

## PR requirements

CI runs on push/PR (`.github/workflows/ci.yml`):

- `npm run audit:exposure`
- `cd server && npm test -- --coverage` (Jest + integration smoke)
- `cd client && npm run lint`
- `cd client && npm test -- --coverage` (Vitest)
- `cd client && npm run build`
- Lighthouse public a11y gate (≥90)
- Playwright public E2E smoke
- Authenticated E2E when `E2E_EMAIL` + `E2E_PASSWORD` secrets set
- Core confidence E2E (`e2e/core-confidence.spec.js`) when `E2E_PASSWORD` secret set — uses seeded `e2e-*@test.coreknot.local` users; login rate limit bypass is dev-only (`NODE_ENV !== production`)

**Never push directly to `main`.** Use PRs with at least one review.

### GitHub branch protection (repo admin)

On `main`: require PR, 1 approval, status checks `server-test`, `client-check`, `e2e-public`, `lighthouse-public`.

See [`docs/DEPLOY_ENV.md`](docs/DEPLOY_ENV.md) and [`docs/DEPLOY_ROLLBACK.md`](docs/DEPLOY_ROLLBACK.md).


## Scripts

Never run production maintenance scripts without reading [`docs/SCRIPTS_RUNBOOK.md`](docs/SCRIPTS_RUNBOOK.md).

## Agents

Primary context: [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md)
