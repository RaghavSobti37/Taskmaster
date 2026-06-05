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

## Quick map

```
Browser → Vercel (static) → /api/* rewrite → Render API → MongoDB
                ↑ RENDER_API_PROXY_URL (Vercel env only)
```
