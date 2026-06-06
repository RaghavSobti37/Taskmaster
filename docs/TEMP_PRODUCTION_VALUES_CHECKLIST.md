# TEMP — Production values setup checklist

> **Delete this file after you're done.** Personal scratch pad — do not commit real secrets here.  
> Work top to bottom. Check each box before moving on.

---

## Before you start

- [ ] Have logins ready: [Sentry](https://sentry.io), [Datadog](https://app.datadoghq.com), [Render](https://dashboard.render.com), [Vercel](https://vercel.com), [MongoDB Atlas](https://cloud.mongodb.com), [GitHub](https://github.com)
- [ ] Open a local notes file (or password manager) to paste values as you collect them — **not** this repo

**Your live URLs (reference only):**

| What | URL |
|------|-----|
| Production API | `https://CoreKnot-jfw0.onrender.com` |
| Production frontend | `https://tsccoreknot.com` |
| Staging API | `https://coreknot-api-staging.onrender.com` *(after you create it)* |

---

## Part 1 — Sentry (error tracking)

### Step 1.1 — Create Sentry account / org

1. Go to [sentry.io](https://sentry.io) → sign up or log in
2. Create org (or pick existing)
3. Note org name: `________________`

### Step 1.2 — Server project (`coreknot-api`)

1. Sentry → **Projects** → **Create Project**
2. Platform: **Node.js** → name: `coreknot-api`
3. After create → **Settings** → **Client Keys (DSN)**
4. Copy DSN — looks like `https://xxxx@xxxx.ingest.sentry.io/xxxx`

| Paste into | Variable | Value |
|------------|----------|-------|
| Render → **CoreKnot API** (prod) | `SENTRY_DSN` | *(paste DSN)* |
| Render → **coreknot-api-staging** | `SENTRY_DSN` | *(same DSN is OK)* |

- [ ] `SENTRY_DSN` saved in Render prod
- [ ] `SENTRY_DSN` saved in Render staging

Also set on **both** Render API services:

| Variable | Production value | Staging value |
|----------|------------------|---------------|
| `SENTRY_ENVIRONMENT` | `production` | `staging` |
| `SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `0.1` |
| `SENTRY_RELEASE` | *(optional — leave empty; code uses `RENDER_GIT_COMMIT`)* | same |

### Step 1.3 — Browser project (`coreknot-web`)

1. Sentry → **Create Project** → Platform: **React** → name: `coreknot-web`
2. **Settings** → **Client Keys (DSN)** → copy DSN

| Paste into | Variable | Environment in Vercel |
|------------|----------|------------------------|
| Vercel → Env Vars | `VITE_SENTRY_DSN` | **Production** |
| Vercel → Env Vars | `VITE_SENTRY_DSN` | **Preview** *(same DSN OK)* |

Also set on Vercel:

| Variable | Production | Preview |
|----------|------------|---------|
| `VITE_SENTRY_ENVIRONMENT` | `production` | `preview` |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | `0.1` | `0.1` |
| `VITE_SENTRY_RELEASE` | *(optional — or `coreknot@1.0.3`)* | same |

- [ ] `VITE_SENTRY_DSN` in Vercel Production
- [ ] `VITE_SENTRY_DSN` in Vercel Preview

### Step 1.4 — Sentry alerts (Dashboard only)

1. Sentry → **Alerts** → **Create Alert**
2. Create **New issue** rule → filter `environment:production` → notify email/Slack
3. Repeat: **Regression**, **Error spike** (>50 events / 5 min)
4. Sentry → **Settings** → **Integrations** → **Slack** → connect `#ops-alerts`

- [ ] At least one alert rule created
- [ ] Slack or email notification tested

### Step 1.5 — Verify Sentry

1. Sentry → project → **Send test event** (or wait for real error)
2. Redeploy Render API after setting `SENTRY_DSN`
3. Redeploy Vercel after setting `VITE_SENTRY_DSN`
4. Confirm events show **environment** + **release**

- [ ] Server test event visible in `coreknot-api`
- [ ] Browser test event visible in `coreknot-web`

---

## Part 2 — Datadog (APM + RUM + infra)

### Step 2.1 — Create Datadog account

1. Go to [datadoghq.com](https://www.datadoghq.com) → sign up
2. Note your **site** (top-right or URL):
   - US: `datadoghq.com`
   - EU: `datadoghq.eu`

| Variable | Value |
|----------|-------|
| `DD_SITE` / `VITE_DD_SITE` | `datadoghq.com` *(or your site)* |

- [ ] Site noted: `________________`

### Step 2.2 — API key (server APM)

1. Datadog → **Organization Settings** → **API Keys**
2. **New Key** → name: `coreknot-render` → copy key *(shown once)*

| Paste into | Variable |
|------------|----------|
| Render → CoreKnot API (prod) | `DD_API_KEY` |
| Render → coreknot-api-staging | `DD_API_KEY` *(same key OK)* |

Also set on **both** Render API services:

| Variable | Production | Staging |
|----------|------------|---------|
| `DD_ENV` | `production` | `staging` |
| `DD_SERVICE` | `coreknot-api` | `coreknot-api` |
| `DD_VERSION` | `1.0.3` | `1.0.3` |
| `DD_SITE` | `datadoghq.com` | `datadoghq.com` |

- [ ] `DD_API_KEY` on Render prod
- [ ] `DD_API_KEY` on Render staging

### Step 2.3 — RUM app (browser)

1. Datadog → **Digital Experience** → **RUM** → **New Application**
2. Type: **JS** → name: `coreknot-web`
3. Copy from setup screen:

| From Datadog | Vercel variable |
|--------------|-----------------|
| Application ID | `VITE_DD_APPLICATION_ID` |
| Client Token | `VITE_DD_CLIENT_TOKEN` |

Set on Vercel (**Production** and **Preview**):

| Variable | Production | Preview |
|----------|------------|---------|
| `VITE_DD_APPLICATION_ID` | *(paste)* | *(same)* |
| `VITE_DD_CLIENT_TOKEN` | *(paste)* | *(same)* |
| `VITE_DD_SITE` | `datadoghq.com` | `datadoghq.com` |
| `VITE_DD_ENV` | `production` | `preview` |
| `VITE_DD_SERVICE` | `coreknot-web` | `coreknot-web` |
| `VITE_DD_SESSION_SAMPLE_RATE` | `100` | `100` |
| `VITE_DD_REPLAY_SAMPLE_RATE` | `0` | `0` |

- [ ] RUM vars in Vercel Production
- [ ] RUM vars in Vercel Preview

### Step 2.4 — Datadog integrations (no env vars — Dashboard clicks)

**Render**

1. Datadog → **Integrations** → search **Render** → **Install**
2. Connect Render account → select services:
   - CoreKnot API (prod)
   - coreknot-api-staging
   - `CoreKnot-keep-warm` cron
   - `CoreKnot-daily-backup` cron
   - `taskmaster-redis`

- [ ] Render integration connected

**MongoDB Atlas**

1. Atlas → your project → **Integrations** → **Datadog**
2. Follow wizard (needs Datadog API key)

- [ ] Atlas integration connected

### Step 2.5 — Datadog synthetics (uptime alerts)

1. Datadog → **Digital Experience** → **Synthetic Tests** → **New Test**
2. **HTTP test** #1:
   - URL: `https://CoreKnot-jfw0.onrender.com/api/health`
   - Assert: status 200, body contains `"ok":true`
   - Frequency: every 1 min
   - Alert: notify Slack/email on 2 failures
3. **HTTP test** #2:
   - URL: `https://tsccoreknot.com/`
   - Assert: status 200
   - Same alert settings

- [ ] Health synthetic created
- [ ] Landing page synthetic created

### Step 2.6 — Datadog monitors (optional but recommended)

Use [`docs/datadog/monitors-template.json`](./datadog/monitors-template.json) as reference.

Create in Datadog → **Monitors** → **New Monitor**:

- [ ] API p95 latency > 2s
- [ ] 5xx error rate > 1%
- [ ] Keep-warm cron failure (Render integration events)

### Step 2.7 — Verify Datadog

1. Redeploy Render + Vercel after env vars
2. Hit prod site → browse 2–3 pages
3. Datadog → **APM** → **Services** → look for `coreknot-api`
4. Datadog → **RUM** → **Applications** → look for `coreknot-web`

- [ ] APM traces visible
- [ ] RUM sessions visible

---

## Part 3 — MongoDB Atlas staging DB

### Step 3.1 — Create staging database

1. Atlas → **Database** → your cluster → **Browse Collections**
2. Create database: `taskmaster_staging` *(or use new cluster for isolation)*
3. Atlas → **Database Access** → ensure app user can read/write this DB
4. Atlas → **Network Access** → allow Render IPs (or `0.0.0.0/0` if already using that for prod)

### Step 3.2 — Get connection string

1. Atlas → **Connect** → **Drivers** → copy connection string
2. Replace `<password>` with your DB user password
3. Replace database name in URI path with `taskmaster_staging`

Example shape: `mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/`

| Paste into | Variable |
|------------|----------|
| Render → **coreknot-api-staging** only | `MONGODB_URI` |

**Do NOT** put staging URI in prod service.  
**Do NOT** set `MONGODB_URI_PROD` on staging.

- [ ] Staging URI on staging Render service only

---

## Part 4 — Render staging API service

### Step 4.1 — Create or sync staging service

Option A — Blueprint:

1. Render → **Blueprints** → sync [`render.yaml`](../render.yaml) if not already
2. Confirm service `coreknot-api-staging` exists

Option B — Manual:

1. Render → **New** → **Web Service** → connect repo → root dir: `server`
2. Name: `coreknot-api-staging`

### Step 4.2 — Staging env vars (copy from prod, then change)

Open prod API env → copy all → paste into staging → **change these**:

| Variable | Staging value |
|----------|---------------|
| `MONGODB_URI` | Staging Atlas URI *(Step 3.2)* |
| `MONGODB_URI_PROD` | **DELETE / leave unset** |
| `JWT_SECRET` | **New** random string *(≠ prod)* |
| `ENCRYPTION_KEY` | **New** — run `openssl rand -hex 32` |
| `SERVER_URL` | `https://coreknot-api-staging.onrender.com` |
| `APP_BASE_URL` | same as `SERVER_URL` |
| `TRACKING_BASE_URL` | same as `SERVER_URL` *(or prod tracking URL if you want staging emails to use prod pixels — usually use staging)* |
| `FRONTEND_URL` | `https://tsccoreknot.com` or Vercel preview URL |
| `SENTRY_ENVIRONMENT` | `staging` |
| `DD_ENV` | `staging` |

Generate new secrets (PowerShell):

```powershell
# JWT_SECRET — any long random string
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# ENCRYPTION_KEY — must be 64 hex chars
-join ((1..32 | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }))
```

- [ ] Staging service deployed
- [ ] `GET https://coreknot-api-staging.onrender.com/api/health` returns 200

---

## Part 5 — Vercel env vars (production vs preview)

Go to: Vercel → your project → **Settings** → **Environment Variables**

### Step 5.1 — Production only

| Variable | Value | Env |
|----------|-------|-----|
| `VITE_API_URL` | `https://CoreKnot-jfw0.onrender.com` | Production |
| `RENDER_API_PROXY_URL` | `https://CoreKnot-jfw0.onrender.com` | Production |
| `VITE_SENTRY_DSN` | *(Part 1.3)* | Production |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Production |
| `VITE_DD_APPLICATION_ID` | *(Part 2.3)* | Production |
| `VITE_DD_CLIENT_TOKEN` | *(Part 2.3)* | Production |
| `VITE_DD_SITE` | `datadoghq.com` | Production |
| `VITE_DD_ENV` | `production` | Production |
| `VITE_DD_SERVICE` | `coreknot-web` | Production |

- [ ] All Production vars set
- [ ] Redeploy Production after saving

### Step 5.2 — Preview only (PR builds → staging API)

| Variable | Value | Env |
|----------|-------|-----|
| `VITE_API_URL` | `https://coreknot-api-staging.onrender.com` | Preview |
| `RENDER_API_PROXY_URL` | `https://coreknot-api-staging.onrender.com` | Preview |
| `VITE_SENTRY_DSN` | *(same as prod)* | Preview |
| `VITE_SENTRY_ENVIRONMENT` | `preview` | Preview |
| `VITE_DD_*` | *(same IDs/tokens as prod)* | Preview |
| `VITE_DD_ENV` | `preview` | Preview |

**Critical:** Preview must **never** point at prod API or prod DB.

- [ ] Preview vars set
- [ ] Open a test PR → Network tab shows staging API host

---

## Part 6 — Render production API (observability only)

If prod already runs, you only need to **add** these on existing **CoreKnot API** service:

| Variable | Value |
|----------|-------|
| `SENTRY_DSN` | Part 1.2 |
| `SENTRY_ENVIRONMENT` | `production` |
| `DD_API_KEY` | Part 2.2 |
| `DD_SITE` | `datadoghq.com` |
| `DD_ENV` | `production` |
| `DD_SERVICE` | `coreknot-api` |

Then **Manual Deploy** (or push to `main` if auto-deploy).

- [ ] Prod observability vars added
- [ ] Prod redeployed

---

## Part 7 — Keep-warm cron

Render → **CoreKnot-keep-warm** cron → Environment:

| Variable | Correct value |
|----------|---------------|
| `KEEP_WARM_URL` | `https://CoreKnot-jfw0.onrender.com/api/health` |

*(Already in `render.yaml` — confirm Dashboard matches.)*

- [ ] Keep-warm URL verified

---

## Part 8 — GitHub branch protection

GitHub → your repo → **Settings** → **Branches** → **Add rule** for `main`:

- [ ] Require pull request before merging
- [ ] Require approvals: **1**
- [ ] Require status checks:
  - [ ] `server-test`
  - [ ] `client-check`
  - [ ] `e2e-public`
  - [ ] `lighthouse-public`
- [ ] Do not allow bypassing for non-admins

Render + Vercel:

- [ ] Render prod + staging: auto-deploy **only** from `main`
- [ ] Vercel Production: deploy **only** from `main`

---

## Part 9 — Final verification (run in order)

```bash
# 1. Health
curl -s https://CoreKnot-jfw0.onrender.com/api/health

# 2. Staging health (after staging exists)
curl -s https://coreknot-api-staging.onrender.com/api/health

# 3. Local CI (optional)
npm run ci
```

Manual:

1. [ ] Login on `tsccoreknot.com` — no console errors
2. [ ] Sentry shows session with your user after login
3. [ ] Datadog RUM shows your session
4. [ ] Open PR → preview uses staging API (DevTools → Network)
5. [ ] Read rollback steps once: [`DEPLOY_ROLLBACK.md`](./DEPLOY_ROLLBACK.md)

---

## Quick copy-paste template (fill in your notes file)

```env
# === SENTRY ===
SENTRY_DSN=
VITE_SENTRY_DSN=

# === DATADOG ===
DD_API_KEY=
DD_SITE=datadoghq.com
VITE_DD_APPLICATION_ID=
VITE_DD_CLIENT_TOKEN=

# === STAGING DB ===
MONGODB_URI_STAGING=

# === STAGING SECRETS (generate new, never reuse prod) ===
STAGING_JWT_SECRET=
STAGING_ENCRYPTION_KEY=

# === URLS ===
PROD_API=https://CoreKnot-jfw0.onrender.com
STAGING_API=https://coreknot-api-staging.onrender.com
PROD_FRONTEND=https://tsccoreknot.com
```

---

## When done

- [ ] Delete this file or clear checked secrets from your notes
- [ ] Keep long-term reference: [`DEPLOY_ENV.md`](./DEPLOY_ENV.md), [`MONITORING_ALERTS.md`](./MONITORING_ALERTS.md)
