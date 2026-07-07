# Render logging (CoreKnot)

CoreKnot APIs emit **structured JSON logs to stdout** via [Pino](../server/utils/logger.js). Render captures these automatically — no log agent or syslog drain required on Starter.

## Environment

| Variable | Typical value | Notes |
|----------|---------------|--------|
| `LOG_LEVEL` | `warn` (production), `info` (staging/local) | Controls Pino verbosity |
| `SERVICE_NAME` | `coreknot-api`, `coreknot-api-staging`, `coreknot-nest-staging` | Included in every log line |

Request correlation: [`traceMiddleware.js`](../server/middleware/traceMiddleware.js) sets `X-Trace-Id`; grep that value in Render logs to follow one request.

## Render Dashboard

1. Open [Render Dashboard](https://dashboard.render.com).
2. Select the service (IDs from Render Dashboard or `VITE_RENDER_SERVICE_ID_*`):
   - **Production API:** `Taskmaster` — `srv-<production-api-id>`
   - **Staging API:** `coreknot-api-staging` — `srv-<staging-api-id>`
   - **Nest staging:** `coreknot-nest-staging` — `srv-<staging-nest-id>`
3. **Logs** tab — tail live output or search within the last **30 days**.

Filter tips:

- Errors: search `level":"error"` or use Render’s level filter when JSON level is present.
- Slow requests: search tag `perf` or message `Slow request`.
- Boot diagnostics: search tag `BOOT` (emitted once at startup when `LOG_LEVEL` allows `info`).
- Redis/BullMQ: search `enableOfflineQueue`, `Stream isn't writeable`, `Redis connection lost`, `Failed to add job to BullMQ`, or queue names such as `WebhookQueue` and `CampaignEmailQueue`.
- Resend webhook latency: search `POST /api/track/webhooks/resend`, then pair the `traceId` with nearby `resendWebhook`, `Slow request`, Redis, and Mongo messages.
- Clerk stale sessions: search `session/touch`, `clerk-establish`, `ClerkOrgActivator`, and `401`; stale auth-host sessions should recover through the footer **Clear session cookies** action.

## Incident filters

Use these searches for the current production failure modes:

| Symptom | Search text | First checks |
|---------|-------------|--------------|
| BullMQ/ioredis write failure | `Stream isn't writeable and enableOfflineQueue options is false` | `REDIS_URL` present on Render service, Key Value linked, `noeviction`, redeploy after env change |
| Queue fallback | `Redis connection lost. Switching to memory queue.` | Treat as production incident; memory fallback is local-only operating posture |
| Slow Resend webhook | `POST /api/track/webhooks/resend` + `Slow request` | Trace campaign lookup, tenant resolution, geo enrichment, webhook retries |
| Clerk auth loop | `session/touch` + `401` | Clear stale cookies on auth host, then verify `POST /api/auth/clerk-establish` succeeds |

Keep real service IDs, hostnames, and secrets in gitignored local files or the Render dashboard. Docs and tickets should use placeholders unless access is restricted and explicitly approved.

## Render MCP (`list_logs`)

Use the Render MCP `list_logs` tool with the service resource ID (`srv-…`).

Example parameters:

```json
{
  "resource": ["srv-YOUR-STAGING-API-ID"],
  "type": ["app"],
  "level": ["error", "warn"],
  "text": ["traceId-here"],
  "limit": 50,
  "direction": "backward"
}
```

- `resource` — required; one or more `srv-` IDs in the same region.
- `text` — wildcard/regex supported; useful for `traceId`, route paths, or tags.
- `startTime` / `endTime` — RFC3339; default window is last hour, max retention 30 days.

List service IDs via MCP `list_services` or the Render API.

## In-app shortcuts

Client env (local: `client/.env.development`; Vercel: Production + Preview):

```env
VITE_RENDER_SERVICE_ID_PRODUCTION=srv-<production-api-id>
VITE_RENDER_SERVICE_ID_STAGING_API=srv-<staging-api-id>
VITE_RENDER_SERVICE_ID_STAGING_NEST=srv-<staging-nest-id>
```

After setting `VITE_RENDER_SERVICE_ID_*` (or `VITE_RENDER_LOGS_*_URL` overrides):

- **Dashboard** — add the **Render Logs** widget (status strip); optional per-env widgets (`Production API Logs`, etc.) from Settings → Dashboard.
- **Admin Console** → Developer Tools — tiles open the matching Render Logs tab in a new tab.

## What is not logged in-app anymore

- No Mongo/Supabase **system_logs** persistence.
- No `/api/system-logs` client telemetry.
- No Datadog/Sentry/PostHog SDK shipping.

**Daily Logs** (`/logs`) and CRM/XP/email **audit** collections are unchanged — they are product data, not infra logging.

## Optional upgrade path

If 30-day retention or cross-service search becomes limiting, add a Render **log stream** to Better Stack, Axiom, or similar — still stdout-only in CoreKnot.
