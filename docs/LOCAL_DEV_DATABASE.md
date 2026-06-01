# Local vs production MongoDB

Keep test data out of production by wiring **two different database names** in your connection strings and pointing the local frontend at the local API.

## Quick setup

### `server/.env`

```env
NODE_ENV=development
MONGODB_URI=mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/
MONGODB_URI_PROD=mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/
# Optional overrides for sync scripts (defaults match names above)
# MONGODB_DB_LOCAL=taskmaster_local
# MONGODB_DB_PROD=taskmaster_production
# Do NOT set unless you intentionally want ALL local API writes on production DB:
# MAIL_USE_PROD_DB=false
# ALLOW_PROD_DB_IN_DEV=true
```

### `client/.env`

```env
VITE_API_URL=http://localhost:5000
```

Restart both `npm run dev` processes after changes.

> **Note:** Root `.env.vercel` is reference documentation only — it is **not** loaded by Vite or Node. Use `client/.env` and `server/.env` locally; use Vercel/Render dashboards for deployed env.

## How the server picks a database

| Runtime | Variable | Database |
|---------|----------|----------|
| `npm run dev` | `MONGODB_URI` | `taskmaster_local` |
| Render (`NODE_ENV=production`) | `MONGODB_URI_PROD` | `taskmaster_production` |
| Vercel preview | `MONGODB_URI` | `taskmaster_local` |

The database name is the **path segment** in the URI (`.../taskmaster_local`), not a separate Atlas setting.

## Common mistakes

1. **`client/.env` points at Render** — `VITE_API_URL=https://CoreKnot-jfw0.onrender.com` makes localhost UI write to production.
2. **Same URI for `MONGODB_URI` and `MONGODB_URI_PROD`** — both environments share one DB.
3. **`NODE_ENV=production` locally** — server uses `MONGODB_URI_PROD`.
4. **`MAIL_USE_PROD_DB=true`** — local server uses **production** DB for **all** API writes, not just mail. Default must be `false`.
5. **Duplicate `FRONTEND_URL` in `server/.env`** — if a prod URL appears later in the file, it overrides `http://localhost:5173`.
6. **Scripts** — `dbPush.js`, `sync-workspaces-to-prod.js`, `sync-finance-to-prod` write to production.

## Render production checklist

On the **CoreKnot API** web service (Dashboard → Environment):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `MONGODB_URI_PROD` | `mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/` |
| `MONGODB_URI` | unset, or must **not** point at `taskmaster_local` |

Cron backup service: only `MONGODB_URI_PROD` (see `render.yaml`).

## Verify isolation

1. Start local server — log should show `Connected database: taskmaster_local`.
2. Create a test task on http://localhost:5173.
3. In Atlas, confirm the document is only in `taskmaster_local`, not `taskmaster_production`.

## Startup guards

In development, if the resolved URI targets a database name containing `production`, the server **throws** unless `ALLOW_PROD_DB_IN_DEV=true` (or `MAIL_USE_PROD_DB` mail-sync mode, which logs a warning only).

## Refresh local DB from production (full copy)

**Warning:** This replaces everything in `taskmaster_local` with a snapshot of `taskmaster_production`. Production is read-only; only the local database is written.

One-liner from repo root:

```bash
node server/scripts/syncProdToLocal.js --yes
```

Requires `MONGODB_URI` and `MONGODB_URI_PROD` in `server/.env`. After sync, keep `MAIL_USE_PROD_DB=false` and restart the local API server.

For continuous prod→local mirroring (change streams), see `server/scripts/sync-prod-to-local.js` (long-running process).
