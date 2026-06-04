# CoreKnot — Environment matrix (canonical)

> **Single source of truth** for env vars by environment.  
> **Do not commit production API hostnames in docs** — set them only in Render / Vercel dashboards or local gitignored `.env`.

## Security rule

| Where | Backend URL |
|-------|-------------|
| Render dashboard | `SERVER_URL`, `APP_BASE_URL`, `TRACKING_BASE_URL` |
| Vercel dashboard | `VITE_API_URL` (same origin as Render API) |
| Local gitignored `.env` | Optional `TRACKING_PUBLIC_FALLBACK` for mail pixel testing |
| **Committed repo** | **Never** — use placeholders in `.env.example` only |

Public frontend (`FRONTEND_URL` / `CLIENT_URL`): your Vercel custom domain (e.g. production PWA URL).

## Database by environment

| Environment | `NODE_ENV` / host | MongoDB URI var | Typical DB name |
|-------------|-------------------|-----------------|-----------------|
| **Local dev** | `development`, localhost | `MONGODB_URI` | `taskmaster_local` |
| **Vercel preview** | `production` + `VERCEL_ENV=preview` | `MONGODB_URI` (preview env) | `taskmaster_local` (isolated) |
| **Production API** | `production` on Render | `MONGODB_URI_PROD` | `taskmaster_production` |

See [`LOCAL_DEV_DATABASE.md`](./LOCAL_DEV_DATABASE.md).

## Client API routing

| Environment | `VITE_API_URL` | Why |
|-------------|----------------|-----|
| **Local** | `http://localhost:5000` | Direct to Express (`client/.env.development`) |
| **Production (Vercel)** | Your Render `SERVER_URL` value | Bypasses Vercel ~4.5MB proxy for large campaigns |
| **Unset local** | (proxy) | Vite proxies `/api` → `localhost:5000` |

`client/vercel.json` proxies `/api/*` to Render — configured at deploy time, not duplicated in docs.

## Render API (required env)

```env
SERVER_URL=<your-render-service-url>
APP_BASE_URL=<same-as-SERVER_URL>
TRACKING_BASE_URL=<same-as-SERVER_URL>
FRONTEND_URL=<your-vercel-frontend-url>
MONGODB_URI_PROD=<atlas-uri>
```

## Vercel frontend (required env)

```env
VITE_API_URL=<same-as-SERVER_URL>
```

## Webhooks (external sites — TSC website)

```env
BOOK_CALL_WEBHOOK_SECRET=<shared-secret>
TASKMASTER_WEBHOOK_URL=<SERVER_URL>/api/webhooks/book-call
TASKMASTER_ARTIST_ENQUIRY_WEBHOOK_URL=<SERVER_URL>/api/webhooks/artist-enquiry
```

## Redis

| Environment | Required? |
|-------------|-----------|
| Local | Recommended; in-memory fallback exists |
| Production | **Yes** for crons and queues |

## Pre-flight & exposure audit

```bash
npm run preflight           # local env sanity
npm run audit:exposure      # scan committed files for leaked hosts
```

## Related docs

| Doc | Use when |
|-----|----------|
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | What to read first |
| [`AI_AGENT_PROJECT_CONTEXT.md`](./AI_AGENT_PROJECT_CONTEXT.md) | Full system reference |
| [`STARTUP_GUIDE.md`](./STARTUP_GUIDE.md) | Local setup |
| [`EMAIL_ENGINE_LOCKED.md`](./EMAIL_ENGINE_LOCKED.md) | Mail tracking |
| [`LEGACY_FREEZE.md`](./LEGACY_FREEZE.md) | APIs not to extend |
