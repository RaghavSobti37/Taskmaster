# Staging environment setup

Full pre-production mirror: staging API + isolated database + Vercel preview frontend.

## 1. MongoDB Atlas

Create database **`taskmaster_staging`** on Atlas (separate from `taskmaster_production`).

Copy connection string → Render staging service env:

```env
MONGODB_URI=mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/
```

Optional: seed from prod snapshot using [`DATA_BACKUP.md`](./DATA_BACKUP.md) restore scripts into staging only.

## 2. Render staging API

Blueprint service: `coreknot-api-staging` in [`render.yaml`](../render.yaml).

After first deploy, note URL (e.g. `https://coreknot-api-staging.onrender.com`).

Required env (Dashboard):

| Variable | Value |
|----------|-------|
| `MONGODB_URI` | Staging Atlas URI |
| `JWT_SECRET` | Staging-only secret (≠ prod) |
| `ENCRYPTION_KEY` | Staging-only hex key |
| `REDIS_URL` | Same Render Redis or dedicated staging Redis |
| `SERVER_URL` / `APP_BASE_URL` | Staging Render URL |
| `FRONTEND_URL` | Vercel preview base or staging domain |
| `SENTRY_ENVIRONMENT` | `staging` |
| `DD_ENV` | `staging` |

**Never** set `MONGODB_URI_PROD` on staging.

## 3. Vercel preview → staging API

Vercel → Project → Settings → Environment Variables → **Preview**:

```env
VITE_API_URL=https://coreknot-api-staging.onrender.com
VITE_SENTRY_ENVIRONMENT=preview
VITE_DD_ENV=preview
RENDER_API_PROXY_URL=https://coreknot-api-staging.onrender.com
```

Production env keeps production API URL only.

## 4. Flow

```mermaid
flowchart LR
  PR[FeaturePR] --> Preview[VercelPreview]
  Preview --> StagingAPI[StagingAPI]
  StagingAPI --> StagingDB[taskmaster_staging]
  Merge[MergeMain] --> ProdFE[VercelProd]
  Merge --> ProdAPI[ProdAPI]
  ProdAPI --> ProdDB[taskmaster_production]
```

## 5. Verify

1. Open PR → Vercel preview URL
2. Login with staging test user (not prod admin)
3. Confirm Network tab: API calls hit `coreknot-api-staging.onrender.com`
4. Confirm no writes to production DB (check Atlas metrics)

## 6. CORS

Set staging API `FRONTEND_URL` to Vercel preview pattern or enable `CORS_ALLOW_VERCEL_PREVIEWS=true` on staging service.
