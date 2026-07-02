# API uptime (paid Render)

Production API runs on **paid Render** — the web service stays up without artificial keep-warm pings.

## Health checks

- **Render:** `healthCheckPath: /api/health` on the web service (`render.yaml`).
- **Optional:** Datadog Synthetics on `GET /api/health` — see [`MONITORING_ALERTS.md`](./MONITORING_ALERTS.md).

## Removed (Jun 2026)

Keep-warm crons (GitHub Actions, Render cron, client idle ping) were removed to cut unnecessary traffic and Vercel edge load. Reintroduce only if the API moves back to a spin-down plan.
