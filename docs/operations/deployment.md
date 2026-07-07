# Deployment environment guide

## `server/.env.render` (local reference only)

- File is **gitignored** — copy keys into [Render Dashboard](https://dashboard.render.com) → your API service → **Environment**.
- Never commit `.env.render`. Use `server/.env.render.example` as a checklist of variable names only.

## Render API service (`YOUR-RENDER-SERVICE.onrender.com`)

Set on the **CoreKnot API** web service (not Vercel):

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` / `MONGODB_URI_PROD` | Production database |
| `JWT_SECRET` | Session signing |
| `ENCRYPTION_KEY` | 64-char hex (`openssl rand -hex 32`) — OAuth/API token encryption; keep stable across restarts |
| `REDIS_URL` | Render Key Value internal URL — instance **maxmemory policy must be `noeviction`** for BullMQ |
| `ADMIN_EMAIL` | Domain bypass for signup (email, not user id) |
| `ALLOWED_DOMAIN` | Allowed signup domain |
| `APP_BASE_URL` / `SERVER_URL` / `TRACKING_BASE_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` |
| `FRONTEND_URL` / `CLIENT_URL` | Your Vercel/custom frontend URL (e.g. `https://tsccoreknot.com`) |
| Google, Meta, SMTP, Resend, etc. | As in `.env.render.example` |

### Redis / BullMQ runtime

Production requires a writable Redis connection. Render should inject `REDIS_URL` from the linked Key Value service into the CoreKnot API service and any queue-dependent worker service. Keep the Redis instance policy at `noeviction`; BullMQ can fail under eviction policies even when the URL is otherwise valid.

Treat these log lines as Redis runtime drift, not as a harmless fallback:

```text
Stream isn't writeable and enableOfflineQueue options is false
Failed to add job to BullMQ
Redis connection lost. Switching to memory queue.
```

Local development can fall back to memory or synchronous handling for some jobs. Production should not run that way because queue state, retries, and cross-instance behavior are not durable. After changing Redis env or Render service links, redeploy the affected service and verify `GET /api/health` plus the Admin queue status endpoint.

Queue-dependent areas include TSC webhooks, mail/campaign dispatch, invite email jobs, Knowledge Engine jobs, gamification, CSV/import jobs, and Supabase/domain sync workers.

**Platform role user IDs** are managed in the app: **Admin → Users → Platform roles** (saved in MongoDB). Env `ROOT_ADMIN_USER_IDS` etc. are optional bootstrap only on first empty DB.

## Vercel frontend — `RENDER_API_PROXY_URL`

Put this on **Vercel** (Project → Settings → Environment Variables), **not** on Render:

| Variable | Example | Used by |
|----------|---------|---------|
| `RENDER_API_PROXY_URL` | `https://YOUR-RENDER-SERVICE.onrender.com` | `scripts/generateVercelConfig.js` at build |

Vercel **Build Command** (if project root is `client/`):

```bash
npm run vercel-build
```

That writes `vercel.json` rewrites so `/api/*` proxies to your Render API. The URL is not stored in git.

Preview/local dev does not need this — Vite proxies `/api` to `localhost:5000`.

## Resend tracking webhook runtime

Resend webhook events are handled on the API host at:

```text
POST <API_HOST>/api/track/webhooks/resend
```

Required Render API env:

| Variable | Purpose |
|----------|---------|
| `RESEND_WEBHOOK_SECRET` | Svix verification for Resend webhook payloads |
| `TRACKING_BASE_URL` | API-origin base URL used for open/click tracking links |
| `RESEND_API_KEY` | Outbound Resend API sends |

If Render logs show slow `POST /api/track/webhooks/resend` requests, inspect the request trace before changing code. The handler can do signature verification, campaign/recipient lookup, tenant resolution, dedupe checks, geo enrichment for open/click events, and campaign stat writes. Slow logs are actionable when they coincide with elevated webhook latency, repeated retries from Resend, or Redis errors in adjacent mail queue paths.

Do not paste real webhook secrets or production host values into docs, commits, tickets, or shared logs. Use placeholders here and keep real URLs in gitignored `.cursor/production-hosts.local.json`.

## Quick map

```
Browser → Vercel (static) → /api/* rewrite → Render API → MongoDB
                ↑ RENDER_API_PROXY_URL (Vercel env only)
```

## Observability (Sentry + Datadog)

Set on **Render API** (production + staging):

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` | Server error tracking |
| `SENTRY_ENVIRONMENT` | `production` / `staging` |
| `SENTRY_RELEASE` | Release tag (defaults to `RENDER_GIT_COMMIT`) |
| `SENTRY_TRACES_SAMPLE_RATE` | APM sample rate (default `0.1`) |
| `DD_API_KEY` | Datadog APM |
| `DD_SITE` | `datadoghq.com` |
| `DD_ENV` | `production` / `staging` |
| `DD_SERVICE` | `coreknot-api` |

Set on **Vercel** (Production + Preview):

| Variable | Purpose |
|----------|---------|
| `VITE_SENTRY_DSN` | Browser error tracking |
| `VITE_SENTRY_ENVIRONMENT` | Match deploy tier |
| `VITE_SENTRY_RELEASE` | Release tag |
| `VITE_DD_APPLICATION_ID` | Datadog RUM |
| `VITE_DD_CLIENT_TOKEN` | Datadog RUM |
| `VITE_DD_SITE` | `datadoghq.com` |
| `VITE_DD_ENV` | `production` / `staging` / `preview` |
| `VITE_DD_SERVICE` | `coreknot-web` |

Alert setup: [`SENTRY_ALERTS.md`](./SENTRY_ALERTS.md), [`MONITORING_ALERTS.md`](./MONITORING_ALERTS.md), [`datadog/README.md`](./datadog/README.md).

## Staging environment

| Component | Production | Staging |
|-----------|------------|---------|
| API | Render production API (see `.cursor/production-hosts.local.json`) | Render `coreknot-api-staging` (provision in Dashboard) |
| Frontend | Vercel Production | Vercel Preview (PR builds) |
| Database | `taskmaster_production` | `taskmaster_staging` |
| `VITE_API_URL` (Preview) | — | Staging API URL (never prod) |
| `MONGODB_URI` (staging API) | — | Atlas `taskmaster_staging` URI |

See [`ENVIRONMENT_MATRIX.md`](./ENVIRONMENT_MATRIX.md) and [`render.yaml`](../render.yaml) staging service block.

## Branch protection (GitHub Settings)

Configure on `main`:

1. Require pull request before merging
2. Require 1 approval
3. Require status checks: `server-test`, `client-check`, `e2e-public`, `lighthouse-public`
4. Do not allow bypassing for non-admins

Documented in [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Rollback

See [`DEPLOY_ROLLBACK.md`](./DEPLOY_ROLLBACK.md) — target under 5 minutes for app rollback.

