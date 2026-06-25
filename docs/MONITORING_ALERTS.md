# Monitoring & instant alerts

Operational alerting for CoreKnot. Complements in-app SystemLog (`/management/ops-logs`) and optional Sentry/Datadog SDKs wired in code.

## Stack

| Layer | Tool | Config location |
|-------|------|-----------------|
| Error tracking | Sentry | [`SENTRY_ALERTS.md`](./SENTRY_ALERTS.md) |
| APM + infra | Datadog | [`datadog/README.md`](./datadog/README.md) |
| Uptime | Datadog Synthetics | Datadog Dashboard |
| Backup ops | Resend email | `BACKUP_NOTIFY_EMAIL` on Render cron |

## Datadog monitors (create in Dashboard)

Import or recreate from [`datadog/monitors-template.json`](./datadog/monitors-template.json).

| Monitor | Condition | Notify |
|---------|-----------|--------|
| API health down | Synthetic fails on `GET /api/health` 2× in 2 min | Slack + email |
| API latency high | `trace.express.request` p95 > 2s for 5 min | Slack |
| 5xx rate | Error rate > 1% over 5 min | Slack + PagerDuty (optional) |
| Render service down | Render integration: service unavailable | Slack + email |
| MongoDB connection | Atlas integration: connection errors | Slack |
| Redis memory | Key Value memory > 80% | Slack |
| Rate limit spike | 429 count > 100 in 5 min | Slack (warn) |

## Datadog Synthetics

Create two HTTP tests:

1. **Health** — `GET https://YOUR-PRODUCTION-API/api/health` — expect 200, body `"ok":true` (real URL in `.cursor/production-hosts.local.json` → `productionApiHealthUrl`)
2. **Landing** — `GET https://tsccoreknot.com/` — expect 200, title contains CoreKnot

Frequency: 1 minute. Alert on 2 consecutive failures.

## On-call routing

1. **Slack** `#ops-alerts` — all Datadog + Sentry alerts
2. **Email** — backup failures (already wired), Datadog monitor digest
3. **SMS/PagerDuty** — optional for production-down synthetics only

## Env vars

See [`DEPLOY_ENV.md`](./DEPLOY_ENV.md) observability section and `.env.example` files.
