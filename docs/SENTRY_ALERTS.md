# Sentry alert setup

Configure in [Sentry Dashboard](https://sentry.io) — not in repo. Wire after `SENTRY_DSN` and `VITE_SENTRY_DSN` are set on Render and Vercel.

## Projects

Create two projects (or one with separate DSNs):

| Project | DSN env var | Platform |
|---------|-------------|----------|
| `coreknot-api` | `SENTRY_DSN` | Render |
| `coreknot-web` | `VITE_SENTRY_DSN` | Vercel |

Set `SENTRY_ENVIRONMENT` / `VITE_SENTRY_ENVIRONMENT` to `production`, `staging`, or `preview` per host.

## Recommended alert rules

### 1. New issue (instant)

- **When:** A new issue is created
- **Filter:** `environment:production`
- **Action:** Slack `#ops-alerts` + email to on-call
- **Frequency:** Immediately

### 2. Regression

- **When:** Issue changes from resolved → unresolved
- **Action:** Same as above

### 3. Crash-free sessions drop

- **When:** Crash-free rate drops below 99% over 1 hour (web project)
- **Action:** Slack + email

### 4. Error spike

- **When:** Event count > 50 in 5 minutes (either project)
- **Action:** Slack (high priority)

## Slack integration

Sentry → Settings → Integrations → Slack → connect workspace → add `#ops-alerts` to each alert rule.

## Release tracking

Set on deploy:

- Render: `SENTRY_RELEASE=$RENDER_GIT_COMMIT` (auto via `RENDER_GIT_COMMIT` fallback in code)
- Vercel: `VITE_SENTRY_RELEASE=coreknot@$VERCEL_GIT_COMMIT_SHA`

## Verify

1. Trigger test error in staging: `GET /api/health?__sentry_test=1` (do not add to prod)
2. Or use Sentry → Settings → Client Keys → "Test error"
3. Confirm issue shows environment, release, user id (when logged in)
