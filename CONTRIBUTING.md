# Contributing to CoreKnot

## Before you code

1. Read [`docs/DOCUMENTATION_INDEX.md`](docs/DOCUMENTATION_INDEX.md)
2. Run `npm run preflight` (repo root) after configuring `server/.env`
3. Respect [`docs/LEGACY_FREEZE.md`](docs/LEGACY_FREEZE.md) and locked zones (email, logo)

## Local workflow

```bash
npm run install:all
cp server/.env.example server/.env   # fill secrets
npm run preflight
npm run dev                        # or separate server/client terminals
```

## PR requirements

CI runs on push/PR (`.github/workflows/ci.yml`):

- `npm run audit:exposure`
- `cd server && npm test -- --coverage` (Jest + integration smoke)
- `cd client && npm run lint`
- `cd client && npm test -- --coverage` (Vitest)
- `cd client && npm run build`
- Lighthouse public a11y gate (≥90)
- Playwright public E2E smoke
- Authenticated E2E when `E2E_EMAIL` + `E2E_PASSWORD` secrets set

**Never push directly to `main`.** Use PRs with at least one review.

### GitHub branch protection (repo admin)

On `main`: require PR, 1 approval, status checks `server-test`, `client-check`, `e2e-public`, `lighthouse-public`.

See [`docs/DEPLOY_ENV.md`](docs/DEPLOY_ENV.md) and [`docs/DEPLOY_ROLLBACK.md`](docs/DEPLOY_ROLLBACK.md).


## Scripts

Never run production maintenance scripts without reading [`docs/SCRIPTS_RUNBOOK.md`](docs/SCRIPTS_RUNBOOK.md).

## Agents

Primary context: [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md)
