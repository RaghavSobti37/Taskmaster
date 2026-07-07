# @coreknot/nestjs-server

NestJS sandbox running alongside the legacy Express app (`server/`). Default port **5001** so Express keeps **5000**.

## Prerequisites

- Node.js >= 18
- PostgreSQL (local or Docker) for Prisma
- Redis optional in dev — BullMQ workers skip when `REDIS_URL` unreachable; attendance/health still start
- Monorepo root `npm install` (workspaces link `@coreknot/contracts`)

## Local Postgres setup

Create the database named in `DATABASE_URL` (default `coreknot`), then push schema.

> **Start Docker Desktop first.** If `docker compose up -d` fails with `dockerDesktopLinuxEngine` / `npipe` not found, the Docker daemon is not running — launch Docker Desktop and wait until it shows "Running", then retry.

### Option A — Docker (recommended when `psql` not installed)

One command (starts Postgres, waits for healthcheck, pushes Prisma + ETL schemas):

```powershell
cd nestjs-server
npm run db:setup
```

Or step by step:

```powershell
cd nestjs-server
npm run db:up           # postgres:16 on localhost:5432, db coreknot
npm run db:push         # apply prisma/schema.prisma
npm run etl:prisma:push # apply prisma/etl/schema.prisma (required before ETL)
```

Stop: `npm run db:down` (add `-v` to `docker compose down` to drop data volume).

### Operational ETL from local Mongo (tier 1 + 2)

After Express local DB is sanitized (from repo root):

```powershell
npm run sync:prod-tenant-tsc
# or: npm run sync:prod-to-local:operational
```

```powershell
cd nestjs-server
npm run db:setup
npm run etl:local-operational
```

Reads `MONGODB_URI` from `server/.env` (must be `taskmaster_local`). Skips CRM/leads (tier 3+) until test fixtures exist.

Full preview/prod ETL: `npm run etl:preview-full` with `DATABASE_URL` pointing at Supabase — see `docs/PREVIEW_SUPABASE_CUTOVER.md`.

### Option B — Native Postgres + setup script

```powershell
# Windows (requires psql on PATH)
.\scripts\setup-local-db.ps1
npx prisma db push
```

```bash
# macOS / Linux
chmod +x scripts/setup-local-db.sh
./scripts/setup-local-db.sh
npx prisma db push
```

Scripts read `DATABASE_URL` from `nestjs-server/.env`, or `.env.example` if `.env` is missing.

If neither Docker nor `psql` is available: install [PostgreSQL](https://www.postgresql.org/download/) or start Docker Desktop, then retry Option A or B.

## Local dev

```bash
# From repo root (installs all workspaces)
npm install

# From nestjs-server/
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, REDIS_URL as needed
npm run start:dev      # watch mode on http://localhost:5001
```

One-off start (no watch):

```bash
npm run start
```

Production build + run:

```bash
npm run build
npm run start:prod
```

## Health check

```bash
curl http://localhost:5001/api/health
```

## Vite proxy (strangler pattern)

Client dev server proxies `/api/attendance` → NestJS (`5001`) and all other `/api` → Express (`5000`). **Requires `nestjs-server` running** on port 5001 for attendance pages.

## Shared contracts

Import shared Zod contracts from the workspace package:

```ts
import * as contracts from '@coreknot/contracts';
// or: import { ... } from '@coreknot/contracts/crm';
```

## Env vars

| Variable       | Purpose                                      |
|----------------|----------------------------------------------|
| `PORT`         | HTTP port (default `5001`)                   |
| `DATABASE_URL` | PostgreSQL connection string (Prisma)        |
| `JWT_SECRET`   | JWT signing secret (match Express when shared) |
| `REDIS_URL`    | Redis / Key Value for BullMQ (optional in dev) |
