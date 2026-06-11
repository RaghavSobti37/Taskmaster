# MongoDB → PostgreSQL ETL (Phase 3)

One-way bulk copy from Express/Mongoose (MongoDB) into NestJS/Prisma (PostgreSQL).  
Mongo `_id` values are preserved as Prisma `String` primary keys.

## Prerequisites

1. **Mongo source** — same database Express uses (`MONGODB_URI` in `server/.env`)
2. **Postgres target** — empty or partially loaded staging DB (`DATABASE_URL`)
3. **Schema applied** — run Prisma migrate/push against the target before ETL

```bash
cd nestjs-server
npm install
npm run etl:prisma:generate
npm run etl:prisma:push   # or: npx prisma migrate dev --schema=prisma/etl/schema.prisma
```

## Environment variables

Load order: `server/.env` first, then `nestjs-server/.env`.

| Variable | Source | Purpose |
|----------|--------|---------|
| `MONGODB_URI` | `server/.env.example` | Mongo read source |
| `DATABASE_URL` | Postgres connection string | Prisma write target |

Optional aliases: `MONGO_URI` (Mongo), `SUPABASE_DB_URL` (Postgres).

**Never** point `DATABASE_URL` at production Mongo. It must be `postgresql://…`.

### Local example

`server/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/taskmaster_local
```

`nestjs-server/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taskmaster_etl_staging
```

## Topological tiers

Collections migrate in dependency order. Run full ETL top-to-bottom, or one tier at a time.

| Tier | Collections | Prisma models |
|------|-------------|---------------|
| **1** | tenants, users, departments, platformsettings | Tenant, User, Department, PlatformSettings |
| **2** | projects, persons, teams | Project, Person, Team |
| **3** | tasks, leads, exlybookings, attendance | Task, Lead, ExlyBooking, Attendance |
| **4** | taskactivities, mailevents, notifications | TaskActivity, MailEvent, Notification |

## Commands

From repo root:

```bash
npm run etl:mongo-to-postgres --prefix nestjs-server -- --dry-run
```

From `nestjs-server/`:

```bash
# Preview counts — no writes
npm run etl:mongo-to-postgres -- --dry-run

# Tier 1 only (foundation)
npm run etl:mongo-to-postgres -- --tier=1

# Single collection
npm run etl:mongo-to-postgres -- --collection=leads

# Full live run (all tiers, in order)
npm run etl:mongo-to-postgres
```

### CLI flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Scan Mongo + print summary; skip `createMany` |
| `--tier=N` | Limit to tier 1–4 |
| `--collection=KEY` | Single collection (`leads`, `users`, `tasks`, …) |

Collection keys: `tenants`, `users`, `departments`, `platformsettings`, `projects`, `persons`, `teams`, `tasks`, `leads`, `exlybookings`, `attendance`, `taskactivities`, `mailevents`, `notifications`.

Singular aliases work too (`--collection=lead` → `leads`).

## Staging run playbook

Recommended flow before any production cutover:

1. **Clone Mongo to staging** — restore prod snapshot into `taskmaster_staging` (see [`docs/STAGING_SETUP.md`](../../docs/STAGING_SETUP.md) and [`docs/DATA_BACKUP.md`](../../docs/DATA_BACKUP.md)).
2. **Provision Postgres** — Supabase staging project or local Docker Postgres; set `DATABASE_URL`.
3. **Apply schema** — `npm run etl:prisma:push` in `nestjs-server/` (uses `prisma/etl/schema.prisma`).
4. **Dry run** — `npm run etl:mongo-to-postgres -- --dry-run` and verify Mongo counts match expectations.
5. **Tiered load** — run tiers 1 → 4 sequentially; fix FK gaps before advancing.
6. **Re-run safe** — script uses `createMany({ skipDuplicates: true })`; re-running skips existing ids.
7. **Validate** — compare summary table (Mongo vs Postgres per collection); spot-check ids in Prisma Studio.

```bash
cd nestjs-server
npm run etl:mongo-to-postgres -- --dry-run
npm run etl:mongo-to-postgres -- --tier=1
npm run etl:mongo-to-postgres -- --tier=2
npm run etl:mongo-to-postgres -- --tier=3
npm run etl:mongo-to-postgres -- --tier=4
npx prisma studio
```

## Implementation notes

- Batch size: **500** documents per `createMany`
- Mongo reads use `bypassTenant: true` to include all tenants
- Uses existing Express Mongoose models from `server/models/` (via `server` package mongoose)
- Postgres target schema: `prisma/etl/schema.prisma` (generated client → `generated/etl-client/`)
- Summary report prints Mongo count, Postgres before/after, and rows inserted per collection

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `MONGODB_URI is not set` | Copy `server/.env.example` → `server/.env` |
| `DATABASE_URL is not set` | Set Postgres URL in `nestjs-server/.env` |
| FK errors on tier 2+ | Re-run missing parent tier first |
| `@prisma/client` not found | `npx prisma generate` in `nestjs-server/` |
