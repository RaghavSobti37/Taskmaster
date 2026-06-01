# CoreKnot Startup Guide

This guide covers the current local setup for CoreKnot, including backend, frontend, and proxy support.

## Prerequisites
- Node.js v18 or newer
- MongoDB running locally or reachable via `MONGODB_URI`
- Redis for queue/cache/background-worker features (recommended)
- Required API keys in `server/.env`

## 1. Prepare environment files

### Server
Copy the template and populate your values:

```bash
cd server
cp .env.example .env
```

Update `server/.env` with your values for:
- `MONGODB_URI`
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
Ensure `client/.env` exists and optionally configure the frontend API URL:

```env
VITE_API_URL=http://localhost:5000
```

If `VITE_API_URL` is empty, the client will use relative `/api` routes and rely on the Vite proxy.

**Production (Vercel frontend + Render API):** set `VITE_API_URL=https://CoreKnot-api.onrender.com` on the static host. Set `APP_BASE_URL` to the same API URL on Render for email open/click tracking.

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

- Normal login uses `POST /api/auth/login`.
- If your login POST fails with invalid JSON in Windows PowerShell, the issue is usually quoting. Use proper JSON escaping or Node fetch.
- If you want to bypass auth locally, set `DEBUG_BYPASS=true` and use `Bearer bypass_token` from `localhost`.

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
| Redis connection error | Verify Redis is running and `REDIS_URL` is correct |
| Port 5000 in use | Change `PORT` in `server/.env` |
| Blank frontend page | Ensure both server and client are running |
| `/api/proxy` returns 401 | Add a valid Bearer token or enable local bypass |
| `POST /api/auth/login` invalid JSON | Fix PowerShell quoting or use Node fetch |
