# CoreKnot Startup Guide

This guide covers the current local setup for CoreKnot, including backend, frontend, and proxy support.

## Prerequisites
- Node.js v18 or newer
- MongoDB running locally or reachable via `MONGODB_URI`
- Redis for queue/cache/background-worker features (recommended; memory fallback is local-only)
- Required API keys in `server/.env`

## 1. Prepare environment files

### Server
Copy the template and populate your values:

```bash
cd server
cp .env.example .env
```

Update `server/.env` with your values for:
- `MONGODB_URI` (local dev — e.g. `.../taskmaster_local`)
- `MONGODB_URI_PROD` (production Atlas — e.g. `.../taskmaster_production`)
- `NODE_ENV=development` when running locally

See [LOCAL_DEV_DATABASE.md](./LOCAL_DEV_DATABASE.md) for full local vs production isolation.
- `JWT_SECRET`
- `APP_BASE_URL`
- `FRONTEND_URL`
- `DEBUG_BYPASS` (set to `true` only for local API testing)
- `HOLYSHEET_API_KEY`
- `EXLY_API_KEY`
- `YOUTUBE_API_KEY`
- `RESEND_API_KEY`
- `UPLOADTHING_TOKEN`

### Client
Copy the template for local development:

```bash
cd client
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
```

If `VITE_API_URL` is empty, the client uses relative `/api` routes via the Vite proxy to `localhost:5000`.

**Production (Vercel frontend + Render API):** set `VITE_API_URL` to the Render API URL on the static host. Set `APP_BASE_URL` and `TRACKING_BASE_URL` to the same API URL on Render for email open/click tracking. Do not commit the real production host; keep it in gitignored `.cursor/production-hosts.local.json`.

## 2. Install dependencies

```bash
cd server
npm install
cd ../client
npm install
```

## 3. Start the backend

```bash
cd server
npm run dev
```

Backend default URL: `http://localhost:5000`

## 4. Start the frontend

```bash
cd client
npm run dev
```

Frontend default URL: `http://localhost:5173`

## 5. API proxy testing

The backend proxy is available at `/api/proxy/:service/*`.
It requires authorization using the backend auth middleware.

For local debugging, enable `DEBUG_BYPASS=true` and use the bypass token:

```bash
curl.exe -H "Authorization: Bearer bypass_token" "http://localhost:5000/api/proxy/youtube/search?part=snippet&q=CoreKnot&maxResults=1"
```

## 6. Authentication notes

- Normal login uses `POST /api/auth/login` (legacy) or Clerk on `auth.*` host → `POST /api/auth/clerk-establish`.
- **Clear session cookies** — footer link on login/register/legal pages on auth host. Use it when stale Clerk `session/touch` 401s or auth-host loops persist after a deploy; then sign in again so `clerk-establish` can set a fresh CoreKnot cookie.
- On the auth host, client org switching is skipped. The API pins the org through `CLERK_ORGANIZATION_ID`, so a failed Clerk `setActive` should not block session recovery.
- If your login POST fails with invalid JSON in Windows PowerShell, the issue is usually quoting. Use proper JSON escaping or Node fetch.
- If you want to bypass auth locally, set `DEBUG_BYPASS=true` and use `Bearer bypass_token` from `localhost`.

## Optional: Local Redis

Set `REDIS_URL=redis://127.0.0.1:6379` when Redis is running locally. On Windows, the server helper can resolve WSL Redis when `REDIS_URL` is unset or points at localhost.

If you see `Stream isn't writeable and enableOfflineQueue options is false`, Redis was not writable at enqueue time. In local development this usually means Redis is stopped, the WSL IP changed, or `REDIS_URL` points at the wrong process. Restart Redis and the API. Production should fix Render Key Value linkage instead of relying on memory fallback.

## Optional: Refresh local DB from production (TSC)

From repo root (`coreknot/Taskmaster`):

```bash
npm run sync:prod-tenant-tsc
```

Skips CRM/Data Hub and Exly heavy data; finance folders + metadata only. Requires `MONGODB_URI` + `MONGODB_URI_PROD` in `server/.env`. See [LOCAL_DEV_DATABASE.md](./LOCAL_DEV_DATABASE.md).

## Optional: Seed sample data

```bash
cd server
node seeder.js
```

This command creates sample users and demo data.

## Directory structure overview

```text
/server   — Backend API, routes, models, middleware, service logic
/client   — React + Vite frontend with API proxy support
/docs     — Project memory and architecture notes
```

## Troubleshooting

| Problem | Fix |
|---|---|
| MongoDB connection error | Verify MongoDB is running and `MONGODB_URI` is correct |
| Redis connection error | Verify Redis is running and `REDIS_URL` is correct; restart the API after changing it |
| `Stream isn't writeable and enableOfflineQueue options is false` | Redis was not writable; restart Redis/API locally, or fix Render Key Value linkage in production |
| Clerk stale `session/touch` 401 loop | Use **Clear session cookies** on the auth host footer, then sign in again |
| Slow `POST /api/track/webhooks/resend` | Check Render trace logs, `RESEND_WEBHOOK_SECRET`, `TRACKING_BASE_URL`, and Redis queue health |
| Port 5000 in use | Change `PORT` in `server/.env` |
| Blank frontend page | Ensure both server and client are running |
| `/api/proxy` returns 401 | Add a valid Bearer token or enable local bypass |
| `POST /api/auth/login` invalid JSON | Fix PowerShell quoting or use Node fetch |
