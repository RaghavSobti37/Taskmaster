# E2E — Playwright

CoreKnot browser tests. Multi-user agent exploration uses isolated `storageState` per archetype so parallel agents never clash sessions.

## Prerequisites

1. **API** on `http://127.0.0.1:5000` (`npm run dev:server` or full `npm run dev`)
2. **Client** on `http://localhost:5173` (`npm run dev:client` or full `npm run dev`)
3. **Test users** in DB with default password `1Million#` (see `shared/defaultPassword.js`)

## Multi-user manifest

Priority:

1. `.agents/e2e-users.json` (local, gitignored — preferred for agents; often generated with dept archetypes + `pagePermissions`)
2. `e2e/fixtures/e2e-users.default.json` (committed fallback)

Minimal `.agents/e2e-users.json`:

```json
{
  "password": "1Million#",
  "users": [
    { "archetype": "admin", "email": "you@theshakticollective.in" },
    { "archetype": "user", "email": "member@theshakticollective.in" }
  ]
}
```

Generated manifest (7 dept users) includes `department.pagePermissions` — `explore-page.smoke.js` maps those to routes automatically.

Or set env vars instead of inline emails (`E2E_USER_ADMIN_EMAIL`, etc.). Legacy `E2E_EMAIL` + `E2E_PASSWORD` still work for `admin` when no manifest email is set.

Saved sessions land in `e2e/.auth/{archetype}.json` (gitignored).

## Agent workflow (local dev on :5173)

```bash
# Terminal 1 — app already running
npm run dev

# Terminal 2 — bootstrap auth (once per user refresh)
E2E_BASE_URL=http://localhost:5173 E2E_SKIP_WEBSERVER=1 ^
  npx playwright test e2e/scripts/auth-setup.js --config e2e/playwright.config.cjs

# Explore all routes per user (parallel-safe — each archetype has own storageState)
E2E_BASE_URL=http://localhost:5173 E2E_SKIP_WEBSERVER=1 ^
  npx playwright test e2e/explore-page.smoke.js --config e2e/playwright.config.cjs

# Single archetype only
E2E_BASE_URL=http://localhost:5173 E2E_SKIP_WEBSERVER=1 ^
  npx playwright test e2e/explore-page.smoke.js --config e2e/playwright.config.cjs -g "explore as admin"
```

PowerShell one-liners (repo root):

```powershell
$env:E2E_BASE_URL='http://localhost:5173'; $env:E2E_SKIP_WEBSERVER='1'
npm run test:e2e:auth-setup
npm run test:e2e:explore
```

## Seeded local users and auth mode

For repeatable local e2e, seed fixture users into the local tenant database:

```powershell
node server/scripts/seedE2eUsers.js
```

The seeder resolves the default/platform tenant, runs with tenant context, and writes `.agents/e2e-users.json` for local browser tests. Seeded users use the `e2e-*@test.coreknot.local` email pattern and the default password from `shared/defaultPassword.js`.

`e2e/helpers/auth.js` uses API-session login for seeded `@test.coreknot.local` users. Set `E2E_AUTH_MODE=api` to force that mode. Supplying real `E2E_EMAIL` / `E2E_PASSWORD` still exercises the normal Clerk browser path.

For stable local authenticated e2e, keep one API process on `http://127.0.0.1:5000` and one client process on `http://localhost:5173`. Avoid running multiple nodemon/dev-server chains against the same ports during a test pass.

## npm scripts

| Script | What |
|--------|------|
| `npm run test:e2e` | All `*.spec.js` tests (preview server on :4173 by default) |
| `npm run test:e2e:public` | Public smoke only |
| `npm run test:e2e:auth` | Legacy authenticated `*.spec.js` flows |
| `npm run test:e2e:auth-setup` | Multi-user login → `e2e/.auth/*.json` |
| `npm run test:e2e:explore` | Per-route smoke per archetype |
| `npm run test:e2e:core-confidence` | Login redirect, password gate, Artist OS smoke (`e2e/core-confidence.spec.js`) |

## CI / preview mode

Default config serves built client on `http://127.0.0.1:4173` via `vite preview`. No change needed for existing `*.spec.js` tests.

**Core confidence** (`.github/workflows/ci.yml` job `e2e-core-confidence`): needs local API on `:5000`, seeded `e2e-*@test.coreknot.local` users, and `E2E_PASSWORD` secret (defaults to `1Million#` in spec). Dev login rate limit is skipped only for those seeded emails when `NODE_ENV !== production`.

Known 2026-07-08 follow-ups:

- `npm run test:e2e:core-confidence` is not yet fully green.
- Protected-route login still needs to return to the original guarded path instead of landing on `/tsc/dashboard`.
- Password-gate and Artist OS specs need clean rerun evidence after the auth and route-gate fixes.
- Preview e2e should fail fast when Clerk env is missing instead of surfacing "Clerk is not configured" in the browser.

## File map

| Path | Role |
|------|------|
| `e2e/playwright.config.cjs` | Base URL, webServer, testMatch |
| `e2e/fixtures/multiUser.js` | Manifest loader, login, storageState paths |
| `e2e/fixtures/routes.js` | `pagePermissions` → route map for explore smoke |
| `e2e/fixtures/e2e-users.default.json` | Committed archetype template |
| `e2e/package.json` | `"type": "module"` for fixture `fs` imports |
| `e2e/scripts/auth-setup.js` | Bootstrap `e2e/.auth/{archetype}.json` |
| `e2e/explore-page.smoke.js` | Route smoke template per user |
| `e2e/helpers/auth.js` | Shared login helper |
| `e2e/.auth/` | Saved browser sessions (gitignored) |
