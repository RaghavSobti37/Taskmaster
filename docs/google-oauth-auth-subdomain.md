# Google OAuth — `auth.tsccoreknot.com` origin fix

**Symptom:** Browser console shows:

```text
[GSI_LOGGER]: The given origin is not allowed for the given client ID
```

on `https://auth.tsccoreknot.com/login` when Google One Tap / Sign-In loads.

**Client ID (from Clerk + server env):**  
`315959957968-2fgkpca1qj077fdj92uc1boffetbaf66.apps.googleusercontent.com`

This is the **staff OAuth client** (`GOOGLE_CLIENT_ID` in `server/.env`). Clerk production uses it for `oauth_google` and `google_one_tap` (verified via `GET /__clerk/v1/environment` → `display_config.google_one_tap_client_id`).

---

## Root cause

Google Identity Services (GIS) only allows the button/One Tap on origins listed under **Authorized JavaScript origins** for that OAuth client. Clerk `allowed_origins` is separate and already includes `https://auth.tsccoreknot.com`; **Google Cloud Console** must list the same hosts.

---

## 1. Google Cloud Console (required — manual)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → select the project that owns client `315959957968-…`.
2. **APIs & Services** → **Credentials**.
3. Under **OAuth 2.0 Client IDs**, open the client named for staff login (ID ends in `…baf66`).
4. **Authorized JavaScript origins** — add every origin below (no trailing slash):

   | Origin |
   |--------|
   | `https://clerk.tsccoreknot.com` | Clerk OAuth callback host |
   | `https://auth.tsccoreknot.com` |
   | `https://tsccoreknot.com` |
   | `https://www.tsccoreknot.com` |
   | `https://landing.tsccoreknot.com` |
   | `http://localhost:5173` *(local dev only)* |

5. **Authorized redirect URIs** — ensure these exist (Clerk + legacy API):

   | URI | Purpose |
   |-----|---------|
   | `https://clerk.tsccoreknot.com/v1/oauth_callback` | Clerk Google OAuth callback |
   | `https://CoreKnot-jfw0.onrender.com/api/auth/google/callback` | Legacy staff Google login (Render API) |
   | `https://CoreKnot-jfw0.onrender.com/api/google/accounts/callback` | Link extra Google accounts |
   | `http://localhost:5000/api/auth/google/callback` | Local API dev |

   Replace `CoreKnot-jfw0.onrender.com` with your canonical Render API host if different (`SERVER_URL` on Render).

6. Click **Save**. Propagation is usually immediate; hard-refresh `https://auth.tsccoreknot.com/login` (or incognito) to retest.

### Verify in browser

1. Open `https://auth.tsccoreknot.com/login`.
2. DevTools → Console — `[GSI_LOGGER]: The given origin is not allowed` should be gone.
3. Click **Continue with Google** — OAuth should proceed without origin errors.

---

## 2. Clerk Dashboard (confirm — usually already correct)

### Sign-in checklist (production login)

| Check | Where |
|-------|--------|
| Email enabled as **first factor** (not contact-only) | Configure → Email, Phone, Username |
| **Force organization selection** OFF (domain-only policy) | Configure → Organizations |
| Google SSO uses custom credentials (section below) | SSO connections → Google |
| `pk_live_` on Vercel auth build matches `sk_live_` on Render | API Keys |
| Frontend API proxy URL registered | Domains → Advanced → Proxy (`https://tsccoreknot.com/__clerk`) |
| Pinned org exists if `VITE_CLERK_ORGANIZATION_ID` set | Organizations |

**Verify identifier step:** DevTools → Network → filter `sign_ins` → after Continue, request body must include email (not `identifier: null`).

**SSO connections → Google → Use custom credentials**

| Field | Expected value |
|-------|----------------|
| Client ID | `315959957968-2fgkpca1qj077fdj92uc1boffetbaf66.apps.googleusercontent.com` |
| Client Secret | Same as `GOOGLE_CLIENT_SECRET` on Render (`server/.env`) |

Clerk **Authorized redirect URI** (copy from Dashboard when editing Google connection) must appear in Google Console redirect URIs above.

**Instance allowed origins** (automated — see script below):

- `https://tsccoreknot.com`
- `https://www.tsccoreknot.com`
- `https://auth.tsccoreknot.com`
- `https://landing.tsccoreknot.com`

---

## 3. Automated checks in this repo

```bash
# Apply / refresh Clerk production allowed_origins + proxy (needs sk_live_ in .cursor/clerk-production.local.env)
node server/scripts/configureClerkProduction.mjs

# Audit Clerk vs env client ID; print Google Console checklist
node server/scripts/verifyGoogleOAuthOrigins.mjs
```

`verifyGoogleOAuthOrigins.mjs` exits `0` when Clerk is configured; it cannot read Google Console origins (no GCP API in repo) — follow section 1 if GSI error persists.

---

## Related docs

- `docs/GOOGLE_META_APP_VERIFICATION.md` — full OAuth URI matrix (staff + YouTube clients)
- `docs/CLOUDFLARE_DNS.md` — `AUTH_FRONTEND_URL`, post-login redirect to auth subdomain
- `server/scripts/configureClerkProduction.mjs` — Clerk `allowed_origins` + FAPI proxy
