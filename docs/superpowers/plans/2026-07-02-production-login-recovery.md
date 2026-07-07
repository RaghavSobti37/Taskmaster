# Production Login Recovery Plan

> **Status:** Partially resolved (2026-07-07). Clerk `session/touch` 401 loop fixed (`ClerkOrgActivator` skips `setActive` on auth host; establish no longer fails on client org-pin). **Clear cookies** always in auth legal footer. If sign-in still fails, re-run diagnostics below — original root cause was identifier not reaching Clerk `sign_ins`.

## Evidence (Playwright on production)

| Check | Result |
|-------|--------|
| `GET /api/health` via auth proxy | 200 |
| `GET /__clerk/v1/environment` | 200 |
| `POST /__clerk/v1/client/sign_ins` after Continue | **200 but `status: needs_identifier`, `identifier: null`** |
| `POST /api/auth/clerk-establish` | **Never observed** |
| Final URL after 45s | `https://auth.tsccoreknot.com/login` |
| Input field value | Email visible in DOM (`OWNER_EMAIL` placeholder) but **not sent to Clerk API** |

`supported_first_factors` on failed `sign_ins` only lists `google_one_tap`, `ticket`, `oauth_google` — **no password** until identifier is accepted.

Browser MCP (`browse`) unavailable on this machine (`ENOENT`); diagnostics run via `e2e/debug-production-login.mjs`.

---

## How login is wired (code path)

### Layer A — Auth host boot (`auth.tsccoreknot.com`)

1. `main-auth.jsx` → `ClerkAppProvider` + `AuthProvider` + `ClerkAuthEffects` + `AuthApp`
2. `ClerkAppProvider` — `proxyUrl` = `https://auth.tsccoreknot.com/__clerk` (live keys)
3. `forceRedirectUrl` on auth site = `/login` (stay on auth until CoreKnot cookie exists)

### Layer B — Clerk UI (`LoginPage` → `ClerkSignInBlock`)

4. User submits `<SignIn routing="path" path="/login" />`
5. Clerk calls `POST /__clerk/v1/client/sign_ins` (+ `attempt_first_factor` for password)
6. On success: `isSignedIn === true`, sign-in shell hides

### Layer C — Session bridge (`ClerkSessionBridge`)

7. When `isSignedIn && isLoaded`:
   - Optional: wait for `orgId === VITE_CLERK_ORGANIZATION_ID` (`ClerkOrgActivator`)
   - `getToken()` → `POST /api/auth/clerk-establish` (proxied to Render)
8. On 200: `applySessionUser` + `login()` → `sessionReady`

### Layer D — Redirect (`LoginPage`)

9. When `user && sessionReady` → `navigateAfterAuth` → `https://tsccoreknot.com/dashboard`

**Current production failure:** stuck at **step 5–6**. Steps 7–9 never run.

---

## Root causes (prioritized)

### P0 — Clerk identifier not submitted

- `sign_ins` returns `needs_identifier` while email is in the input.
- Password field may be visible but `tabindex="-1"` / not active until identifier step completes.
- **Cookie banner** (`z-[200]` fixed bottom) may intercept Continue clicks.
- Clerk dashboard: `force_organization_selection: true` may add hidden org step.

### P1 — Downstream never reached (not the current blocker)

- `clerk-establish` org gate (fixed on `main` via `CLERK_REQUIRE_ORGANIZATION` opt-in) — needs Render deploy.
- `ClerkOrgActivator` + establish error UI — needs auth Vercel redeploy.
- Silent `getToken()` null when org pin fails — needs code hardening.

### P2 — Infra / config

- Render API must run commit `ab526b8f` (org gate opt-in).
- Auth Vercel build needs `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SITE_MODE=auth`, optional `VITE_CLERK_ORGANIZATION_ID`.
- Google One Tap FedCM errors in console (noise; not primary path for email/password).

---

## Recovery plan

### Phase 1 — Unblock Clerk sign-in (do first)

| # | Action | Owner |
|---|--------|-------|
| 1.1 | Clerk Dashboard → disable **Force organization selection** (or ensure test user is org member) | Manual |
| 1.2 | Clerk Dashboard → Email/Password → confirm password is enabled for sign-in | Manual |
| 1.3 | Redeploy **auth Vercel** from `main`; hard-refresh / clear site data | Deploy |
| 1.4 | **Code:** auto-dismiss or lower cookie banner on `/login` so it cannot cover Clerk Continue | Agent |
| 1.5 | **Code:** after Clerk Continue, verify `sign_ins` reaches `needs_first_factor` or `complete` (add dev-only logging or E2E assert) | Agent |
| 1.6 | Re-test: Network must show `attempt_first_factor` (password) then active session | Verify |

**Exit criteria:** `sign_ins` / `attempt_first_factor` succeed; sign-in form disappears; optional `clerk-establish` appears.

### Phase 2 — CoreKnot session bridge

| # | Action | Owner |
|---|--------|-------|
| 2.1 | Deploy **Render API** from `main` (`CLERK_REQUIRE_ORGANIZATION` unset or `false`) | Deploy |
| 2.2 | Confirm `POST /api/auth/clerk-establish` → 200 + `Set-Cookie: coreknot_token*` with `Domain=.tsccoreknot.com` | Verify |
| 2.3 | **Code:** surface error when `getToken()` returns null or `setActive(org)` fails (no silent spinner) | Agent |

**Exit criteria:** `clerk-establish` 200; redirect to `tsccoreknot.com/dashboard`.

### Phase 3 — Regression gates

| # | Action |
|---|--------|
| 3.1 | `E2E_EMAIL` / `E2E_PASSWORD` → `node e2e/run-production-auth.mjs` green |
| 3.2 | `node e2e/debug-production-login.mjs` reports `clerk-establish seen: true` |
| 3.3 | Manual smoke on mobile width (iPhone emulation) |

---

## Quick manual check (after Phase 1 deploy)

1. Open `https://auth.tsccoreknot.com/login` → accept cookies if shown.
2. Enter email → **wait** → Continue (if two-step).
3. Enter password → Continue.
4. Network filter: `sign_ins` → should NOT be `needs_identifier`.
5. Then filter: `clerk-establish` → expect 200.
6. Land on `https://tsccoreknot.com/dashboard`.

---

## Files reference

| Area | File |
|------|------|
| Auth entry | `client/src/main-auth.jsx` |
| Clerk provider | `client/src/components/providers/ClerkAppProvider.jsx` |
| Sign-in UI | `client/src/components/auth/ClerkSignInBlock.jsx` |
| Bridge | `client/src/components/auth/ClerkSessionBridge.jsx` |
| Org pin | `client/src/components/auth/ClerkOrgActivator.jsx` |
| Login page | `client/src/pages/auth/LoginPage.jsx` |
| API establish | `server/domains/auth/controllers/authController.js` |
| Proxy | `sites/auth/vercel.json` |
| Diagnostic | `e2e/debug-production-login.mjs` |
