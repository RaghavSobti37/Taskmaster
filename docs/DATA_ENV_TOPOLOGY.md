# Data environment topology

Three-tier local dev target (Jun 2026):

| Tier | Store | Scope | Env flags |
|------|-------|-------|-----------|
| **Hot primary** | Supabase Postgres | Tasks, projects, CRM, users, attendance (Nest :5001), mail campaigns/templates, gamification, system log reads | `SUPABASE_*`, `LOGS_PRIMARY_SUPABASE=true`, `PERSIST_SYSTEM_LOGS=true` |
| **Cold archive** | MongoDB TTL (90d) | SystemLog, Log, CRMAudit, MailEvent (raw), QATestRun, TaskActivity — bulk writes only | `MONGO_LOG_ARCHIVE=true` optional mirror; `npm run mongo:ensure-cold-ttl` |
| **Device local** | localStorage | Notifications inbox only — no server DB writes | `GET /api/notifications` returns `localOnly: true` |

Audit: `npm run audit:data-topology --prefix server`

---

Three database targets — **no duplicate full prod copy on one Supabase cluster**.

| Environment | Primary store | Data scope |
|-------------|---------------|------------|
| **Local Express** | Mongo `taskmaster_local` | Operational sync: users, projects, tasks, workspaces — **no CRM/Data Hub** |
| **Local NestJS** | Docker Postgres `coreknot` | Sanitized ETL tiers 1–2 from operational Mongo |
| **Vercel preview QA** | Supabase **preview** project | Full prod ETL (temporary) |
| **Production** | Supabase **prod** project (post-cutover) | Canonical prod data; Mongo retired last |

## Local Express (Mongo)

```bash
npm run sync:prod-to-local:operational
npm run purge:local-crm-datahub   # if full sync was run earlier
node server/scripts/seedE2eUsers.js
```

`server/.env`:

```env
DATA_HUB_RECONCILE_ENABLED=false
SYNC_MODE=operational
MAIL_USE_PROD_DB=false
```

## Local NestJS (Docker Postgres)

```bash
cd nestjs-server
docker compose up -d --wait
npm run db:setup
npm run etl:local-operational
```

`nestjs-server/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/coreknot
```

Express still uses Mongo on `:5000`; Nest uses Postgres on `:5001`.

## Why not Supabase cloud for local?

- Avoids doubling storage/connections on your Supabase project
- Fast reset via `docker compose down -v`
- Same Prisma schema as preview/prod

## Preview vs prod Supabase

- **Preview project** — ETL prod Mongo once; point Render staging + Vercel Preview API proxy here
- **Prod project** — fresh ETL after preview QA passes; never share with preview long-term

See `docs/PREVIEW_SUPABASE_CUTOVER.md` for step-by-step.

## Automation scripts

| Command | Purpose |
|---------|---------|
| `npm run verify:data-env` | Local readiness checklist |
| `npm run preview:etl -- --dry-run` | Prod Mongo → Supabase preview ETL |
| `npm run preview:vercel-env` | Print Vercel Preview env vars |
| `npm run preview:e2e-smoke` | Playwright smoke vs preview + staging API |
| `npm run prod:cutover-etl -- --dry-run` | Maintenance-window prod ETL |
