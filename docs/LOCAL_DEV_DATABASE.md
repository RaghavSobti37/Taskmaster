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
# Do NOT set unless you need mail tracking on prod DB from localhost:
# MAIL_USE_PROD_DB=false
# ALLOW_PROD_DB_IN_DEV=true
```

### `client/.env`

```env
VITE_API_URL=http://localhost:5000
```

Restart both `npm run dev` processes after changes.

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
4. **`MAIL_USE_PROD_DB=true`** — local server uses prod DB for mail sync.
5. **Scripts** — `dbPush.js`, `sync-workspaces-to-prod.js`, `sync-finance-to-prod` write to production.

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
