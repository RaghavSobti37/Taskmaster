# Google & Meta App Verification Guide — CoreKnot / The Shakti Collective

**Last updated:** June 2026  
**App:** CoreKnot (internal ERP + artist analytics)  
**Company domain:** `theshakticollective.in`  
**Production frontend:** `https://tsccoreknot.com`  
**Production API:** `https://CoreKnot-jfw0.onrender.com` (also referenced as `YOUR-RENDER-SERVICE.onrender.com` in some env vars — use one canonical host on Render)  
**Marketing site:** `https://theshakticollective.in`

---

## Quick start — test before you submit

1. Deploy latest code to Render + Vercel.
2. Log in as admin → open browser devtools or call:
   ```http
   GET /api/integrations/oauth-readiness
   ```
   (Requires admin session cookie.)
3. Fix every item in `issues[]` until `ready: true`.
4. Run the manual test matrix in [Part 5](#part-5--manual-test-matrix).
5. Record demo videos, then submit to Google + Meta consoles.

---

## Part 0 — Codebase integration map

### Google (3 credential types)

| Use case | Files | Env vars | Scopes |
|----------|-------|----------|--------|
| Staff Google Sign-In | `authController.js`, `LoginPage.jsx` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` | profile, email, calendar, drive, spreadsheets, webmasters.readonly |
| Domain lock | `authController.js` | `ALLOWED_DOMAIN`, `ADMIN_EMAIL` | Blocks non-`@theshakticollective.in` in production |
| Calendar / Drive | `googleRoutes.js`, `googleController.js` | Same Google client | calendar, drive |
| Link extra Google accounts | `googleAccounts.js` | + request-derived API base | + gmail.readonly |
| Artist YouTube analytics | `connectionAuthController.js` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_API_KEY` | youtube.readonly, yt-analytics.readonly |
| Google Sheets (server) | webhooks, HolySheet | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` | Service account — no user OAuth verification |

### Meta / Instagram

| Use case | Files | Env vars | Permissions |
|----------|-------|----------|-------------|
| Artist IG/FB connect | `connectionAuthController.js`, `MetaOAuthCallback.jsx` | `META_APP_ID`, `META_APP_SECRET`, `CLIENT_URL` | pages_show_list, pages_read_engagement, instagram_manage_insights, instagram_basic, business_management |
| Analytics fetch | `metaGraphService.js`, `analyticsService.js` | Per-artist tokens | Graph API v21 |
| Instagram webhooks | `webhookRoutes.js` | `META_VERIFY_TOKEN`, `META_APP_SECRET` | mentions, comments, messages, story_insights |
| **Data deletion callback** | `metaDataDeletionController.js` | `META_APP_SECRET` | Meta signed_request compliance |

### Legal pages (required URLs)

| Page | URL |
|------|-----|
| Privacy Policy | `https://tsccoreknot.com/privacy` |
| Data Deletion Portal | `https://tsccoreknot.com/userdata` |
| Meta deletion status | `https://tsccoreknot.com/userdata?code=CONFIRMATION_CODE` |
| Contact | `privacy@theshakticollective.in` |

---

## Part 1 — Environment variables audit

### Critical — fix on Render before verification

| Variable | Status | Action |
|----------|--------|--------|
| `GOOGLE_CLIENT_SECRET` | Placeholder `ROTATED_PLEASE_UPDATE…` | Set real secret from GCP Console → Credentials |
| `META_APP_SECRET` | Placeholder `ROTATED_PLEASE_UPDATE…` | Set real secret from Meta App Dashboard → Settings → Basic |
| `YOUTUBE_REDIRECT_URI_PROD` | Was wrongly `https://tsccoreknot.com/login` | **Fixed in code/docs** → must be `https://CoreKnot-jfw0.onrender.com/api/artists/auth/callback/youtube` |
| `SERVER_URL` | Was missing | **Added** → `https://YOUR-RENDER-SERVICE.onrender.com` (or your canonical Render URL) |
| `FRONTEND_URL` / `CLIENT_URL` | Localhost in shared `.env` | On Render set both to `https://tsccoreknot.com` |
| `GOOGLE_REDIRECT_URI` | Localhost in shared `.env` | OK for local dev; production uses request host + `SERVER_URL` fallback via `oauthEnv.js` |
| `BOOK_CALL_WEBHOOK_SECRET` | Default `change-me…` | Rotate to a strong random string in production |

### OK / configured

| Variable | Notes |
|----------|-------|
| `ALLOWED_DOMAIN=theshakticollective.in` | Correct |
| `ADMIN_EMAIL=REDACTED_ADMIN@example.com` | Correct bypass admin |
| `GOOGLE_CLIENT_ID` | Set (staff OAuth client) |
| `YOUTUBE_CLIENT_ID` | Set (separate client — good for verification) |
| `META_APP_ID` | Set |
| `META_VERIFY_TOKEN` | Set (`verify_tsc`) — use same value in Meta webhook config |
| `TRACKING_BASE_URL` | Public Render URL — helps OAuth fallback in production |

### Hygiene

| Item | Action |
|------|--------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` trailing space | **Fixed** — trim whitespace |
| Duplicate `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` lines in `.env` | Keep one copy only |
| `META_USER_TOKEN` | Dev fallback only — remove from production after App Review + per-artist OAuth works |
| Hardcoded Meta App ID in code | **Removed** — requires `META_APP_ID` env |

### Production Render checklist

```bash
NODE_ENV=production
SERVER_URL=https://CoreKnot-jfw0.onrender.com
FRONTEND_URL=https://tsccoreknot.com
CLIENT_URL=https://tsccoreknot.com
ALLOWED_DOMAIN=theshakticollective.in
ADMIN_EMAIL=REDACTED_ADMIN@example.com

GOOGLE_CLIENT_ID=<staff client>
GOOGLE_CLIENT_SECRET=<real secret>

YOUTUBE_CLIENT_ID=<youtube client>
YOUTUBE_CLIENT_SECRET=<real secret>
YOUTUBE_REDIRECT_URI_PROD=https://CoreKnot-jfw0.onrender.com/api/artists/auth/callback/youtube
YOUTUBE_API_KEY=<restricted API key>

META_APP_ID=<app id>
META_APP_SECRET=<real secret>
META_VERIFY_TOKEN=verify_tsc
```

### Vercel (frontend)

```bash
VITE_API_URL=https://CoreKnot-jfw0.onrender.com
VITE_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID for staff login>
```

See also: `server/.env.production.example`

---

## Part 2 — URIs to register in developer consoles

### Google Cloud Console → Credentials → OAuth 2.0 Client

**Staff client** — Authorized redirect URIs:
```
https://CoreKnot-jfw0.onrender.com/api/auth/google/callback
https://CoreKnot-jfw0.onrender.com/api/google/accounts/callback
http://localhost:5000/api/auth/google/callback
```

**YouTube client** — Authorized redirect URIs:
```
https://CoreKnot-jfw0.onrender.com/api/artists/auth/callback/youtube
http://localhost:5000/api/artists/auth/callback/youtube
```

**Authorized JavaScript origins:**
```
https://tsccoreknot.com
http://localhost:5173
```

**Authorized domains** (OAuth consent screen):
```
tsccoreknot.com
theshakticollective.in
onrender.com
```

### Meta Developer Dashboard

| Setting | Value |
|---------|-------|
| Valid OAuth Redirect URIs | `https://tsccoreknot.com/oauth/meta/callback` |
| Webhook callback | `https://CoreKnot-jfw0.onrender.com/api/webhooks/instagram` |
| Webhook verify token | Same as `META_VERIFY_TOKEN` |
| **Data Deletion Request URL** | `https://CoreKnot-jfw0.onrender.com/api/webhooks/meta-data-deletion` |
| Privacy Policy URL | `https://tsccoreknot.com/privacy` |
| Data deletion instructions (backup) | `https://tsccoreknot.com/userdata` |

---

## Part 3 — Google verification strategy

### Staff login → Internal OAuth app (recommended)

If GCP project is under the same Google Workspace org as `@theshakticollective.in`:

1. OAuth consent screen → **User type: Internal**
2. Sensitive scopes (Calendar, Drive) skip **public** verification for org users only
3. Workspace Admin → Security → API controls → **Trust internal apps**
4. Keep `ALLOWED_DOMAIN=theshakticollective.in` as app-level backup

Docs: [Google Internal apps FAQ](https://support.google.com/cloud/answer/13463817)

### YouTube artist analytics → External OAuth app (required)

Artists are external Google users → separate **External** OAuth client:

1. Enable YouTube Data API v3 + YouTube Analytics API
2. OAuth consent screen → External → add scopes:
   - `youtube.readonly`
   - `yt-analytics.readonly`
3. Publish to Production
4. **Prepare for verification** with:
   - Scope justification (artist dashboard only, no resale)
   - Unlisted YouTube demo video showing full OAuth flow + analytics UI
5. Timeline: ~3–5 business days

Docs: [Google OAuth verification](https://support.google.com/cloud/answer/13461325)

### Demo video script (Google YouTube)

1. Login to `tsccoreknot.com` as TSC staff
2. Artists → select artist → Connect YouTube
3. Show consent screen (English, all scopes visible)
4. Return to app → sync stats → show subscribers, views, videos
5. Show `/privacy` link

---

## Part 4 — Meta App Review strategy

### Permissions to request (Advanced Access)

| Permission | Why |
|------------|-----|
| `instagram_basic` | IG business profile |
| `pages_show_list` | Required dependency — list user's FB Pages |
| `pages_read_engagement` | Required dependency — Page engagement |
| `instagram_manage_insights` | Followers, post metrics, engagement rate |
| `business_management` | Pages under Business Portfolio |

Docs: [Instagram App Review](https://developers.facebook.com/docs/instagram-platform/app-review/)

### App Review submission

For each permission provide:
1. **Use case text** — label staff connect artist IG for internal analytics only
2. **Screencast** — login → Artists → Connect Instagram → consent → analytics tab

### Demo video script (Meta)

1. Login to CoreKnot
2. Artist detail → Connect Instagram
3. Facebook OAuth → accept permissions (show full dialog)
4. Land on `/oauth/meta/callback` → redirect to artist page
5. Show Instagram tab: followers, posts, engagement
6. Show `/privacy` and `/userdata`

### After approval

- Switch app to **Live** mode
- Remove production dependency on `META_USER_TOKEN`
- Test webhook verify: Meta Dashboard → Webhooks → Test

### Data deletion callback (implemented)

Meta POSTs `signed_request` to:
```
POST /api/webhooks/meta-data-deletion
```

Response format:
```json
{
  "url": "https://tsccoreknot.com/userdata?code=ABC123",
  "confirmation_code": "ABC123"
}
```

Status check:
```
GET /api/webhooks/meta-data-deletion/:code
```

Test manually: [Meta data deletion callback docs](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/)

---

## Part 5 — Manual test matrix

| # | Test | Expected |
|---|------|----------|
| 1 | `GET /api/integrations/oauth-readiness` (admin) | `ready: true`, no issues |
| 2 | Staff Google login `@theshakticollective.in` | Dashboard |
| 3 | Google login with personal Gmail | `unauthorized_domain` |
| 4 | Artist → Connect YouTube | Channel stats after sync |
| 5 | Artist → Connect Instagram | IG followers + posts |
| 6 | Meta webhook verify (GET) | Returns hub.challenge |
| 7 | `/privacy` public | Loads without auth |
| 8 | `/userdata` public | Loads without auth |
| 9 | Meta deletion status URL | `/userdata?code=…` shows status banner |

---

## Part 6 — API reference (new endpoints)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/integrations/oauth-readiness` | Admin | Pre-flight env + URI checklist |
| POST | `/api/webhooks/meta-data-deletion` | Meta signed_request | Platform data deletion |
| GET | `/api/webhooks/meta-data-deletion/:code` | Public | Deletion status for users |

---

## Part 7 — Timeline

| Week | Tasks |
|------|-------|
| 1 | Fix Render env secrets; register all URIs; run oauth-readiness |
| 2 | Record demo videos; submit Google YouTube verification |
| 3 | Submit Meta App Review; configure data deletion URL in Meta Dashboard |
| 4 | Handle reviewer feedback; go Live |

---

## Part 8 — Related files

| File | Role |
|------|------|
| `server/utils/oauthEnv.js` | Production-safe OAuth URL resolution |
| `server/utils/metaSignedRequest.js` | Parse Meta signed_request |
| `server/controllers/metaDataDeletionController.js` | Meta deletion compliance |
| `server/controllers/integrationsVerifyController.js` | Admin readiness check |
| `server/controllers/connectionAuthController.js` | Artist OAuth initiation |
| `server/controllers/artistAnalyticsController.js` | Meta token exchange |
| `server/services/metaGraphService.js` | IG/FB Graph API |
| `client/src/pages/legal/PrivacyPolicy.jsx` | Privacy policy |
| `client/src/pages/legal/UserDataDeletion.jsx` | Deletion portal + Meta status |

---

## Security note

Never commit real secrets to git. Rotate any credentials that were ever exposed in local `.env` files shared across environments. Use Render/Vercel secret stores for production values only.
