# External keep-warm (Render free tier)

Taskmaster’s production API runs on **Render’s free web service plan**. Free services **spin down after ~15 minutes of no traffic**, which causes cold starts (slow first request, failed webhooks, login delays).

Render **cron jobs are not available on the free plan**, so the `CoreKnot-keep-warm` job in `render.yaml` is blueprint-only and **does not run** in production today.

**Solution:** smart inactive-aware warming from **outside Render** — check often, ping only when needed.

Canonical URL (from `.cursor/production-hosts.local.json` → `productionApiHealthUrl`):

`https://YOUR-PRODUCTION-API.onrender.com/api/health`

---

## Smart vs dumb ping

| Approach | Behavior |
|----------|----------|
| **Dumb** (old) | `GET /api/health` every 10 minutes regardless of activity |
| **Smart** (current) | Checker runs every **5 minutes**; actual keep-warm ping only when idle **≥ 7 minutes** since last ping **or** response time suggests a **cold start** (> 3s) |

Render free tier spins down after **~15 minutes** of inactivity. The **7-minute idle threshold** leaves margin before spin-down while avoiding unnecessary traffic when the service is already warm.

When a recent ping was **< 7 minutes** ago and the health response was **fast** (< 2s), the script logs `skip: still warm` and does not count another ping.

Script: [`scripts/smartKeepWarm.js`](../scripts/smartKeepWarm.js)

State persisted between runs (`.keep-warm-state.json`): `lastKeepWarmPingAt`, `lastHealthCheckAt`, `lastResponseMs`, `consecutiveFastChecks`.

---

## Primary: GitHub Actions (in repo)

Workflow: [`.github/workflows/keep-warm.yml`](../.github/workflows/keep-warm.yml)

| Setting | Value |
|---------|--------|
| Checker schedule | `*/5 * * * *` (every 5 minutes) |
| Ping threshold | `KEEP_WARM_IDLE_MINUTES=7` |
| Cold start hint | `KEEP_WARM_COLD_MS=3000` (default in script) |
| Method | `node scripts/smartKeepWarm.js` |
| State | `actions/cache` key `keep-warm-state` → `.keep-warm-state.json` |
| Failure | Exit 1 when ping required but health is non-200 |
| Logs | `skip: still warm`, `ping OK`, response ms |

**Requirements**

- Repository on **GitHub** with **Actions enabled** (Settings → Actions → General → allow workflows).
- No API keys or secrets required — URL is set in workflow `env` (update there if production host changes; match `productionApiHealthUrl` in your local hosts file).

**Manual run:** Actions → “Keep warm (Render API)” → **Run workflow**.

**Dry-run (local, no network):**

```bash
SMART_KEEP_WARM_DRY_RUN=1 node scripts/smartKeepWarm.js
```

**Limits:** GitHub scheduled workflows can be delayed a few minutes on free/private repos; the 5-minute checker + 7-minute idle threshold still beats the 15-minute spin-down window in normal operation.

---

## Client-side complement (logged-in users)

When a user has the app open and is logged in, [`client/src/lib/idleKeepWarm.js`](../client/src/lib/idleKeepWarm.js) sends a single same-origin `GET /api/health` after **7 minutes** with no API activity (tab visible). Wired in `AuthContext` + axios request interceptor. This reduces cold starts during active sessions without replacing the GHA checker.

---

## Backup: UptimeRobot (manual, no API key)

Use this if you want redundancy or if GitHub Actions is disabled.

1. Sign up (free): [https://uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor**
   - Monitor type: **HTTP(s)**
   - Friendly name: e.g. `Taskmaster API health`
   - URL: `https://YOUR-PRODUCTION-API.onrender.com/api/health`
   - Monitoring interval: **5 minutes** (free tier)
   - Alert contacts: your email (optional but recommended)
3. Save. UptimeRobot will GET the URL on schedule and alert on downtime.

**What to give an agent for manual setup:** nothing — you configure this in the browser yourself.

**Optional later:** UptimeRobot **API key** only if you want to automate creating/editing monitors (not required for manual setup).

---

## Backup: cron-job.org (manual)

1. Sign up (free): [https://cron-job.org](https://cron-job.org)
2. Create cron job:
   - Title: e.g. `Taskmaster keep-warm`
   - URL: `https://YOUR-PRODUCTION-API.onrender.com/api/health`
   - Schedule: every **10 minutes** (or **14 minutes** — still under 15-minute idle limit)
   - Request method: **GET**
   - Timeout: **30 seconds**
3. Enable notifications if you want email on failure.

No API key required for manual setup.

---

## Render cron (N/A on free tier)

`render.yaml` defines `CoreKnot-keep-warm` and `server/scripts/keepWarm.js` for **paid** Render plans. Do **not** rely on Render cron on the current free API service — use GHA + optional external monitor above.

When you upgrade Render, you can re-enable the Render cron as a second layer; keep external ping until then.

---

## Datadog (optional, later)

`production-hosts.local.example.json` → `monitoring.keepWarmCronTarget` and Datadog synthetics are documented in `docs/datadog/`. Not required for keep-warm today.

---

## What I need from you

### GitHub Actions (primary)

- **Confirm GitHub repo has Actions enabled** — yes / no  
  (Repository → Settings → Actions → “Allow all actions and reusable workflows” or your org policy equivalent.)

Once enabled and this workflow is on `main`, keep-warm runs automatically — **no keys, no Render Dashboard change**.

### UptimeRobot / cron-job.org (backup)

- Only if you want **redundancy** beyond GHA.
- **Manual setup:** create account + monitor yourself — **no API key** required.
- Tell us only if you want help automating monitors later (then an UptimeRobot API key is optional).

### Nothing else

Unless you want **Datadog synthetics** or paid Render cron later, no other input is required for keep-warm.
