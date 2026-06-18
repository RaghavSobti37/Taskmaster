# Preview Supabase cutover checklist

Phased path: **prod Mongo → Supabase preview → Vercel preview test → prod Supabase → Mongo off**.

## Prerequisites

- `MONGODB_URI_PROD` in `server/.env` (read-only ETL source)
- Supabase preview project created (separate from future prod project)
- Credentials in gitignored `.cursor/production-hosts.local.json` under `supabase.preview`
- `JWT_SECRET` identical across Express prod and Nest staging during strangler

## Phase A — Preview Supabase project

1. Create Supabase project `coreknot-preview` (Dashboard → New project).
2. Copy connection string → `nestjs-server/.env.preview` (gitignored) or Render staging env:
   - `DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`
3. Apply schema (automated in `npm run preview:etl`; manual equivalent):
   ```bash
   cd nestjs-server
   set DATABASE_URL=<preview-url>   # PowerShell: $env:DATABASE_URL=...
   npm run db:push
   npm run prisma:generate
   ```

## Phase B — Full prod ETL → preview

Automated (reads `production-hosts.local.json` + `MONGODB_URI_PROD`):

```bash
npm run preview:etl -- --dry-run
npm run preview:etl -- --yes
```

Manual tier-by-tier:

```bash
set MONGODB_URI_PROD=<prod-mongo-uri>
set DATABASE_URL=<preview-supabase-url>
cd nestjs-server
npm run etl:mongo-to-postgres -- --dry-run
npm run etl:preview-full
```

Validate counts per tier (playbook § Phase 3).

## Phase C — Render staging API

Deploy or configure `stagingApiUrl` (see `.cursor/production-hosts.local.example.json`):

| Env | Value |
|-----|-------|
| `DATABASE_URL` | Preview Supabase |
| `JWT_SECRET` | Same as production Express |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Unset when domain fully on Nest; else keep for unmigrated routes |

Nest health: `GET <stagingApiUrl>/api/health` → `postgres.state: connected`.

## Phase D — Vercel Preview

Print Preview env vars:

```bash
npm run preview:vercel-env
```

Vercel project → Environment Variables → **Preview** only:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `stagingApiUrl` |
| `RENDER_API_PROXY_URL` | `stagingApiUrl` |
| `NEST_API_PROXY_URL` | `stagingNestApiUrl` (attendance strangler only) |

Regenerate `client/vercel.json` if using `generateVercelConfig.js`.

Smoke tests:

```bash
set E2E_BASE_URL=https://<preview-deployment>.vercel.app
npm run preview:e2e-smoke
node e2e/task-explorer-sweep.mjs
```

**Known limitation:** Email tracking stays on prod API host until mail domain ports (email engine locked).

## Phase E — Prod cutover (after preview pass)

1. Create **prod** Supabase project (or re-ETL to fresh prod project — do not reuse preview as prod long-term).
2. Maintenance window ETL:

```bash
npm run prod:cutover-etl -- --dry-run
npm run prod:cutover-etl -- --yes
```

3. Render production: set `DATABASE_URL` to `supabase.production.databaseUrl`; enable Vite strangler routes per domain.
4. Express unmigrated domains still on `MONGODB_URI_PROD` until strangler complete.
5. When all domains ported: remove `MONGODB_URI_PROD` from Render; archive Atlas.

## Phase F — Local dev alignment

Local stays on operational Mongo + Docker Postgres — **not** preview/prod Supabase:

```bash
npm run sync:prod-to-local:operational
cd nestjs-server && npm run etl:local-operational
```

## Rollback

- Preview fails: keep prod on Mongo; delete preview Supabase data or drop preview project.
- Prod cutover fails: revert Render `DATABASE_URL`; Express still on Mongo if strangler not flipped.
