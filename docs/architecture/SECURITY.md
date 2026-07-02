# CoreKnot Security Guide

This document describes the security controls implemented in CoreKnot/Taskmaster, how authentication works, and what to do when building new features.

**Last updated:** June 2026 (post hardening pass)

---

## 1. Authentication model

### HttpOnly session cookie

JWTs are **not** stored in `localStorage`. After login/register/Google OAuth, the API sets:

| Property | Value |
|----------|--------|
| Cookie name | `coreknot_token` |
| `httpOnly` | `true` (not readable by JavaScript) |
| `secure` | `true` in production |
| `sameSite` | `none` in production (cross-origin Vercel → Render), `lax` in dev |
| TTL | `JWT_EXPIRES_IN` (default `7d`) |

**Client requirements:**

- `axios.defaults.withCredentials = true` (configured in `AuthContext`)
- Socket.IO: `withCredentials: true` (see `client/src/lib/realtime.js`)
- UploadThing uploads: `credentials: 'include'` (see `client/src/utils/uploadthing.js`)

**Server reads token from:**

1. `coreknot_token` cookie (preferred)
2. `Authorization: Bearer …` header (legacy/API clients only)

**Logout:** `POST /api/auth/logout` clears the cookie.

### Production signup controls

| Env var | Purpose |
|---------|---------|
| `ALLOWED_DOMAIN` | Email domain required for `/api/auth/register` and Google sign-up |
| `ADMIN_EMAIL` | Bypass email allowed outside `ALLOWED_DOMAIN` |
| `REGISTRATION_DISABLED=true` | Blocks public registration entirely in production |

Registration also validates:

- Password strength (`server/utils/passwordValidation.js`)
- `departmentId` must reference a department with `signupAllowed: true`

---

## 2. Webhook security

All inbound webhooks that mutate data must authenticate callers.

### HMAC webhooks (book-call, Exly)

**Env vars:** `BOOK_CALL_WEBHOOK_SECRET`, `EXLY_WEBHOOK_SECRET`

**Header:** `X-Webhook-Signature: sha256=<hex>`

**Signature:** HMAC-SHA256 of the **raw JSON body** using the secret.

**Node example (sender side):**

```javascript
const crypto = require('crypto');
const body = JSON.stringify(payload);
const signature = 'sha256=' + crypto.createHmac('sha256', SECRET).update(body).digest('hex');
// POST with header X-Webhook-Signature: signature
```

**Endpoints:**

| Route | Secret env |
|-------|------------|
| `POST /api/webhooks/book-call` | `BOOK_CALL_WEBHOOK_SECRET` |
| `POST /api/exly/webhook` | `EXLY_WEBHOOK_SECRET` |

In **development**, missing secrets skip verification (logged). In **production**, missing secrets return `401`.

### Artist enquiry (plain shared secret)

**Env var:** `ARTIST_ENQUIRY_WEBHOOK_SECRET` — **required in production**

**Header:** `X-Webhook-Secret: <secret>`

### Meta / Instagram

**Env var:** `META_APP_SECRET` — required in production for `POST /api/webhooks/instagram`

Validates `X-Hub-Signature-256`. Invalid or missing signatures are rejected with `401`.

### Resend

Uses Svix verification via `RESEND_WEBHOOK_SECRET`. Keep this set in production.

---

## 3. Authorization patterns

Use existing middleware — do not roll custom checks per route unless necessary.

| Middleware | Use when |
|------------|----------|
| `protect` | Any authenticated route |
| `admin` | Admin department only |
| `opsOrAdmin` | Finance, subscriptions, proxy, office ops |
| `artistOrAdmin` | Artist roster / analytics |

**Examples hardened in this pass:**

- Artist platform analytics: `GET /api/artists/:id/analytics/:platform` → `protect` + `artistOrAdmin`
- Subscriptions CRUD (except public rate): `opsOrAdmin`
- API proxy (`/api/proxy/*`): `opsOrAdmin` (HolySheet, Exly, YouTube, OpenAI keys stay server-side)

---

## 4. CORS & realtime

**Default allowed origins** (see `server/server.js`):

- `localhost:5173`, `localhost:5174`
- `tsccoreknot.com`, `theshakticollective.in` (+ www variants)
- Plus `CORS_ALLOWED_ORIGINS` (comma-separated)

**Vercel previews:** `*.vercel.app` is **not** allowed in production unless:

```env
CORS_ALLOW_VERCEL_PREVIEWS=true
```

Prefer listing specific preview URLs in `CORS_ALLOWED_ORIGINS` instead.

Socket.IO uses the same origin policy.

---

## 5. Secrets & environment variables

### Never commit

- `server/.env`, `client/.env`
- Service account JSON files
- API keys, JWT secrets, webhook secrets

Templates only: `server/.env.example`, `client/.env.example`

### Never hardcode in source

- API keys (Songstats fallback was removed — use `SONGSTATS_API_KEY` only)
- MongoDB URIs
- OAuth client secrets

### Rotate immediately if exposed

MongoDB, `JWT_SECRET`, Resend, UploadThing, Meta, Google OAuth, HolySheet, Exly, webhook HMAC secrets.

### Production checklist (Render / Vercel)

1. Set all webhook secrets and `META_APP_SECRET`
2. Set `ALLOWED_DOMAIN` + `ADMIN_EMAIL`
3. Set `CORS_ALLOWED_ORIGINS` to your exact frontend URL(s)
4. Set `FRONTEND_URL` on the API for OAuth redirects
5. Set `JWT_SECRET` to a long random value (≥ 32 bytes)
6. Enable MongoDB Atlas IP allowlist for Render egress
7. Keep repo **private** or audit git history for leaked `.env`

---

## 6. Building new features — developer checklist

### New API route

- [ ] Mount behind `protect` unless intentionally public
- [ ] Add role guard (`admin`, `opsOrAdmin`, etc.) if not all users should access
- [ ] Respect tenant plugin — avoid `bypassTenant` unless cross-tenant job/script
- [ ] Validate input types (strings vs objects) to block NoSQL operator injection
- [ ] Use `express-mongo-sanitize` (already global) — don’t disable it
- [ ] Return generic errors in production (no stack traces) — use `errorMiddleware`
- [ ] Log mutations via `loggerMiddleware` where appropriate

### New webhook / public POST

- [ ] Require HMAC or shared secret (see `server/utils/webhookAuth.js`)
- [ ] Use `req.rawBody` for signature verification (already captured in `server.js`)
- [ ] Rate-limit if outside `/api/` (see track limiter pattern)
- [ ] Never trust payload without authentication

### New frontend page

- [ ] Wrap in `ProtectedRoute` unless public
- [ ] Use `useAuth().user`, not localStorage tokens
- [ ] Use axios with credentials (default via `AuthContext`)
- [ ] Sanitize HTML before `dangerouslySetInnerHTML` (use DOMPurify)
- [ ] Check page permissions via `pagePermissions` if adding nav items

### New third-party integration

- [ ] Store keys in server env only
- [ ] If browser needs access, proxy through `/api/proxy` (ops-only) or a dedicated scoped endpoint
- [ ] Never expose keys in client bundle (`VITE_*` is public)

### New file upload

- [ ] Use UploadThing middleware pattern (`getTokenFromRequest`)
- [ ] Enforce auth in upload route middleware
- [ ] Limit file size/type in multer or UploadThing config

---

## 7. Email engine (locked)

Email tracking, geo, open/click behavior, and HolySheet defaults are **locked** per `docs/EMAIL_ENGINE_LOCKED.md`. Do not change unless explicitly unlocking.

---

## 8. Known residual risks

| Risk | Mitigation |
|------|------------|
| JWT in cookie still vulnerable to CSRF on mutating routes | SameSite=None required for cross-origin; consider CSRF tokens for sensitive POSTs |
| Long JWT TTL (7d) | Shorten `JWT_EXPIRES_IN`; add refresh flow if needed |
| Public artist share links | JWT signed with `JWT_SECRET`; use short `ARTIST_SHARE_TOKEN_EXPIRES` |
| Admin script runner | Admin-only; high blast radius — audit before adding scripts |
| Rate limits (1000/15min) | Tighten per-route for auth/webhooks if abused |

---

## 9. Generating webhook secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the output in Render env for `BOOK_CALL_WEBHOOK_SECRET`, `EXLY_WEBHOOK_SECRET`, and `ARTIST_ENQUIRY_WEBHOOK_SECRET`. Update external integrators (HolySheet, Exly/Pabbly, website form) with the new headers.

---

## 10. Related files

| Area | Location |
|------|----------|
| Auth cookie helpers | `server/utils/authCookie.js` |
| Webhook HMAC | `server/utils/webhookAuth.js` |
| Password rules | `server/utils/passwordValidation.js` |
| Auth middleware | `server/middleware/authMiddleware.js` |
| CORS | `server/server.js` |
| Client auth | `client/src/contexts/AuthContext.jsx` |
| Env template | `server/.env.example` |

For local DB safety, see `docs/LOCAL_DEV_DATABASE.md`.

---

## 11. QA agent verification

The admin **QA Testing** page runs automated checks on every pre-deploy scan:

| Category | What it verifies |
|----------|------------------|
| **Security hardening** | Webhook HMAC, register lockdown, artist analytics auth, subscription/proxy ops gates, HttpOnly cookies, Songstats key, Meta signature enforcement, CORS Vercel gating |
| **Security hardening (live)** | HTTP probes against running API: unsigned webhooks → 401, public analytics → 401, weak password → 400, login omits JWT body |

Static checks: `server/services/qaPreDeploymentChecklist.js` → `runSecurityHardeningChecks()`.

Live probes run when the API is reachable at `QA_API_BASE_URL` or `http://127.0.0.1:5000` (skipped if offline).

Run from Admin → QA Testing, or:

```bash
cd server && npx jest tests/qaPreDeploymentChecklist.test.js --forceExit
```

---

## 12. Local default password

Dev/test default: **`1Million#`** (`shared/defaultPassword.js`).

Override in `server/.env`:

```env
DEFAULT_SEED_PASSWORD=1Million#
```

Used for Clerk auto-created users, auth tests, and QA login probes.

**Reset existing users** still on weak passwords (`1234`, `password123`, etc.):

```bash
cd server

# Local database
node scripts/resetWeakUserPasswords.js
node scripts/resetWeakUserPasswords.js --apply

# Production database
node scripts/resetWeakUserPasswords.js --prod
RESET_WEAK_PASSWORDS_CONFIRM=1 node scripts/resetWeakUserPasswords.js --prod --apply
```

Set `DEFAULT_SEED_PASSWORD=1Million#` in Render production env before running the production reset.

The weak-password **blocklist** in `passwordValidation.js` is unchanged — those values stay rejected on register.
