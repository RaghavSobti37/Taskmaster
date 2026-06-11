# Testing & QA

## Test commands

| Command | Scope |
| --- | --- |
| `npm test` | Server Jest (194+ cases, MongoDB Memory Server) |
| `npm test --prefix client` | Client Vitest |
| `npm run test:e2e:public` | Playwright public smoke (no credentials) |
| `npm run test:e2e:auth` | Playwright auth flows (`E2E_EMAIL` + `E2E_PASSWORD`) |
| `npm run ci` | Exposure audit + typecheck + server tests + NestJS build + client lint/build |
| `npm run audit:exposure` | Pre-commit secret scan |
| `npm run audit:deadcode` | Orphan module scan |

---

## Server tests (39 files)

Key suites: `auth.test.js`, `artistWorkspace.test.js`, `artistPortfolioPublic.test.js`, `artistRouteAccess.test.js`, `artistOs.test.js`, `authMobileLogin.test.js`, `api.integration.test.js`, `emailFlow.integration.test.js`, `trackingUrls.test.js`, `campaignRegisteredLocation.test.js`, `taskReview.test.js`, `attendanceMetrics.test.js`, `gamificationService.test.js`, `supabaseSecondary.test.js`

CI uses **MongoDB Memory Server** — no local `mongod` required.

---

## E2E specs (`e2e/`)

`smoke.spec.js`, `auth-flows.spec.js`, `mobile-login.spec.js`, `todo.spec.js`, `crm.spec.js`

E2E user manifests: `.agents/e2e-users.json` (gitignored)

---

## In-app QA (Admin → QA Testing)

- 209+ pre-deployment cases
- Suites: static checklist, security live probes, integration (45), page AST scans, Lighthouse
- Purge QA test data with pattern matching
- Socket.IO realtime progress updates

---

## CI pipeline (`.github/workflows/ci.yml`)

| Job | Steps |
| --- | --- |
| `server-test` | Exposure audit + Jest with coverage |
| `client-check` | ESLint + Vitest + production build |
| `lighthouse-public` | a11y ≥ 90 gate |
| `e2e-public` | Playwright public smoke |
| `e2e-auth` | Playwright auth (secrets required) |

---

## Lighthouse auditing

```bash
cd client
npm run lighthouse          # All routes
npm run lighthouse:public   # Public only
```

Reports: `client/lighthouse-reports/` (gitignored)
