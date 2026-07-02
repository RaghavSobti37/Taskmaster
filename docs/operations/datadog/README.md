# Datadog setup for CoreKnot

## 1. Create Datadog account

Sign up at [datadoghq.com](https://www.datadoghq.com). Note your site (`datadoghq.com` or `datadoghq.eu`).

## 2. Integrations (Dashboard)

| Integration | Purpose |
|-------------|---------|
| **Render** | CPU, memory, deploy events, cron job status |
| **MongoDB Atlas** | Connection count, slow queries, disk |
| **Logs** | Render log stream → Datadog (Log Management) |

Render: Integrations → Render → connect account → select CoreKnot API + crons + Redis.

Atlas: Project → Integrations → Datadog → follow Atlas wizard.

## 3. APM (server)

Set on **Render API** (production + staging):

```env
DD_API_KEY=<from Datadog → Organization Settings → API Keys>
DD_SITE=datadoghq.com
DD_ENV=production
DD_SERVICE=coreknot-api
DD_VERSION=1.0.2
```

Code loads [`server/datadog-init.js`](../server/datadog-init.js) before Express when `DD_API_KEY` is set.

## 4. RUM (browser)

Create RUM application in Datadog → RUM → New Application → JS.

Set on **Vercel** (Production + Preview):

```env
VITE_DD_APPLICATION_ID=<from RUM app>
VITE_DD_CLIENT_TOKEN=<from RUM app>
VITE_DD_SITE=datadoghq.com
VITE_DD_ENV=production
VITE_DD_SERVICE=coreknot-web
VITE_DD_SESSION_SAMPLE_RATE=100
```

## 5. Dashboards

Create dashboard **CoreKnot Production** with:

- APM: request rate, p50/p95 latency, error rate
- RUM: LCP, FID, page views by route
- Infra: Render CPU/memory, Redis memory, Mongo connections

## 6. Monitors & synthetics

See [`MONITORING_ALERTS.md`](../MONITORING_ALERTS.md) and [`monitors-template.json`](./monitors-template.json).

## 7. Staging

Duplicate env vars with `DD_ENV=staging`, `SENTRY_ENVIRONMENT=staging`. Use separate Datadog service tags to filter dashboards.
