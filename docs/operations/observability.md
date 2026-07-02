# Observability

## Structured logging

- **Server:** Pino JSON to stdout (`server/utils/logger.js`). Render captures stdout.
- **Fields:** `tag`, `msg`, `level`, `service`, `env`, optional `traceId` / `requestId` via `traceMiddleware`.
- **Production default level:** `warn` — 5xx errors always logged at `error` in `errorMiddleware`.

### Log drain (recommended)

1. Render Dashboard → service → Logs → add log stream (Datadog, Axiom, etc.)
2. Filter on `service=coreknot-api` and `level=error` for alerts

## Error tracking

- **Sentry:** set `SENTRY_DSN` on Render API, `VITE_SENTRY_DSN` on Vercel client.
- Release tag: `coreknot-api@<package.version>` / `coreknot-web@<version>`
- Optional: `SENTRY_TRACES_SAMPLE_RATE` (default 0.1)

## Tracing

- `X-Trace-Id` / `X-Request-Id` on every API response from `traceMiddleware`.
- Pass `X-Trace-Id` from client when debugging cross-layer issues.

## Product analytics

- PostHog (consent-gated) — separate from operational telemetry.

## Health

- `GET /api/health` and `GET /api/v1/health` — Mongo, Redis, Supabase flag, UploadThing creds.
