# Release process

## Version source

- Root [`package.json`](../../package.json) `version` (currently 1.0.7)
- Sync OpenAPI: `node scripts/generate-openapi.mjs`
- Update [`CHANGELOG.md`](../../CHANGELOG.md)

## Pre-release checklist

```bash
cd coreknot/Taskmaster
npm run audit:exposure
node scripts/generate-openapi.mjs --check
npm test --prefix server
npm test --prefix client
npm run build --prefix client
```

## Staging → production

1. Merge to `staging`; verify Render staging health
2. Run authenticated E2E if secrets configured
3. Merge `staging` → `main`; poll Render deploy
4. Smoke: `/api/health`, login via Clerk auth host

## Environment flags (auth)

| Env | Purpose |
|-----|---------|
| `CLERK_SECRET_KEY` | API Clerk verify |
| `CLERK_WEBHOOK_SECRET` | Webhook Svix verify |
| `ALLOW_LEGACY_LOGIN=true` | Dev only — enables password login |

Do **not** set `ALLOW_LEGACY_LOGIN` on production/staging.
