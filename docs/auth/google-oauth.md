# Google & Meta OAuth — CoreKnot

> **Last updated:** 2026-07-02  
> **Merged from:** `google-oauth-auth-subdomain.md` + `GOOGLE_META_APP_VERIFICATION.md`

Staff **login** uses **Clerk** on `auth.tsccoreknot.com` → `POST /api/auth/clerk-establish` → HttpOnly session cookie. Legacy `POST /api/auth/google-login` and password register are disabled in production (`ALLOW_LEGACY_LOGIN` unset).

**Google OAuth** in this doc is for: Clerk Google SSO credentials, artist YouTube/Instagram connect, calendar link — not primary staff auth in prod.

---

## Quick reference

| Surface | Host / callback |
| --- | --- |
| App workspace | `https://tsccoreknot.com` |
| Auth subdomain | `https://auth.tsccoreknot.com` |
| Landing | `https://landing.tsccoreknot.com` |
| Clerk OAuth | `https://clerk.tsccoreknot.com` |
| API (canonical) | Use `.cursor/production-hosts.local.json` → `apiUrl` (not legacy `CoreKnot-jfw0` in new deploys) |

**Pre-flight (admin session):**

```http
GET /api/integrations/oauth-readiness
```

Fix all `issues[]` until `ready: true`.

**Repo scripts:**

```bash
node server/scripts/configureClerkProduction.mjs
node server/scripts/verifyGoogleOAuthOrigins.mjs
```

---

## Part 1 — Auth subdomain / GSI origin fix

**Symptom:** `[GSI_LOGGER]: The given origin is not allowed for the given client ID` on `https://auth.tsccoreknot.com/login`.

**Staff client ID:** `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` (ends in `…baf66`). Clerk uses same for `oauth_google` and `google_one_tap`.

### Google Cloud Console → Credentials → staff OAuth client

**Authorized JavaScript origins** (no trailing slash):

| Origin |
| --- |
| `https://clerk.tsccoreknot.com` |
| `https://auth.tsccoreknot.com` |
| `https://tsccoreknot.com` |
| `https://www.tsccoreknot.com` |
| `https://landing.tsccoreknot.com` |
| `http://localhost:5173` |

**Authorized redirect URIs:**

| URI | Purpose |
| --- | --- |
| `https://clerk.tsccoreknot.com/v1/oauth_callback` | Clerk Google OAuth |
| `https://<API_HOST>/api/auth/google/callback` | Legacy staff Google login |
| `https://<API_HOST>/api/google/accounts/callback` | Link extra Google accounts |
| `http://localhost:5000/api/auth/google/callback` | Local dev |

### Clerk Dashboard checklist

| Check | Where |
| --- | --- |
| Email as first factor | Configure → Email |
| Google SSO custom credentials | SSO → Google (Client ID/Secret match Render) |
| `pk_live_` on Vercel auth = `sk_live_` on Render | API Keys |
| FAPI proxy registered | Domains → `https://tsccoreknot.com/__clerk` |
| Allowed origins include auth + landing | Domains / script `configureClerkProduction.mjs` |

---

## Part 2 — Codebase integration map

### Google credential types

| Use case | Files | Env vars |
| --- | --- | --- |
| Staff sign-in | `authController.js`, `LoginPage.jsx` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID` |
| Domain lock | `authController.js` | `ALLOWED_DOMAIN`, `ADMIN_EMAIL` |
| Calendar / Drive | `googleRoutes.js` | Same staff client |
| Extra Google accounts | `googleAccounts.js` | + request-derived API base |
| Artist YouTube | `connectionAuthController.js` | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_API_KEY` |
| HolySheet / webhooks | server services | `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` |

### Meta / Instagram

| Use case | Files | Env vars |
| --- | --- | --- |
| Artist IG/FB connect | `connectionAuthController.js`, `MetaOAuthCallback.jsx` | `META_APP_ID`, `META_APP_SECRET`, `CLIENT_URL` |
| Analytics | `metaGraphService.js` | Per-artist tokens |
| Webhooks | `webhookRoutes.js` | `META_VERIFY_TOKEN`, `META_APP_SECRET` |
| Data deletion | `metaDataDeletionController.js` | `META_APP_SECRET` |

### Legal URLs (verification)

| Page | URL |
| --- | --- |
| Privacy | `https://tsccoreknot.com/privacy` |
| Data deletion | `https://tsccoreknot.com/userdata` |
| Meta status | `https://tsccoreknot.com/userdata?code=<code>` |

---

## Part 3 — URIs for developer consoles

### Staff OAuth client — redirect URIs

```
https://<API_HOST>/api/auth/google/callback
https://<API_HOST>/api/google/accounts/callback
http://localhost:5000/api/auth/google/callback
```

### YouTube OAuth client — redirect URIs

```
https://<API_HOST>/api/artists/auth/callback/youtube
http://localhost:5000/api/artists/auth/callback/youtube
```

`YOUTUBE_REDIRECT_URI_PROD` must match API callback — **not** the frontend `/login` path.

### Meta Developer Dashboard

| Setting | Value |
| --- | --- |
| OAuth redirect | `https://tsccoreknot.com/oauth/meta/callback` |
| Webhook | `https://<API_HOST>/api/webhooks/instagram` |
| Data deletion | `https://<API_HOST>/api/webhooks/meta-data-deletion` |
| Privacy URL | `https://tsccoreknot.com/privacy` |

---

## Part 4 — Verification strategy

### Staff Google → Internal OAuth (Workspace org)

OAuth consent **Internal** + Workspace trust → Calendar/Drive scopes without public verification for `@theshakticollective.in`.

### YouTube → External OAuth

Separate client, External consent, scopes `youtube.readonly` + `yt-analytics.readonly`, demo video for Google review (~3–5 days).

### Meta App Review

Request: `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `instagram_manage_insights`, `business_management`. Screencast: staff connects artist IG → analytics tab.

---

## Part 5 — Manual test matrix

| # | Test | Expected |
| --- | --- | --- |
| 1 | `GET /api/integrations/oauth-readiness` | `ready: true` |
| 2 | Staff Google `@theshakticollective.in` | Dashboard |
| 3 | Personal Gmail | `unauthorized_domain` |
| 4 | Connect YouTube | Stats after sync |
| 5 | Connect Instagram | IG metrics |
| 6 | Meta webhook verify GET | `hub.challenge` |
| 7 | `/privacy`, `/userdata` public | 200 without auth |

---

## Part 6 — API endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/integrations/oauth-readiness` | Admin | Env + URI checklist |
| POST | `/api/webhooks/meta-data-deletion` | Meta signed_request | Platform deletion |
| GET | `/api/webhooks/meta-data-deletion/:code` | Public | Deletion status |

---

## Related

- [`operations/cloudflare-dns.md`](../operations/CLOUDFLARE_DNS.md) — DNS for auth subdomain
- [`reference/COREKNOT_MASTER.md`](../reference/COREKNOT_MASTER.md) — auth pages (`LoginPage`, `MetaOAuthCallback`, legal)
- [`operations/deployment.md`](../operations/deployment.md) — Render/Vercel env
