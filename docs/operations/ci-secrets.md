# CI secrets (GitHub Actions)

Required repository secrets for full CI gates on `main` / `staging`:

| Secret | Used by | Purpose |
|--------|---------|---------|
| `E2E_EMAIL` | `e2e-core-confidence` | Staff login for authenticated Playwright flows |
| `E2E_PASSWORD` | `e2e-core-confidence` | Password for `E2E_EMAIL` (Clerk or legacy test user) |

PRs without these secrets still pass unit tests, OpenAPI check, tenant static suite, and public e2e smoke.

## Local auth e2e

```bash
cd coreknot/Taskmaster
E2E_EMAIL=you@example.com E2E_PASSWORD=secret npm run test:e2e:auth
```

## Render / observability (optional)

| Variable | Service | Purpose |
|----------|---------|---------|
| `SENTRY_DSN` | Render API | Server error tracking |
| `VITE_SENTRY_DSN` | Vercel client | Browser error tracking |
| `CLERK_WEBHOOK_SECRET` | Render API | Svix verify for `/api/webhooks/clerk` |
