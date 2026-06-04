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
- `cd server && npm test`
- `cd client && npm run build`

Use the PR template checklist in [`.github/pull_request_template.md`](.github/pull_request_template.md).

Before commit locally: `npm run audit:exposure` — blocks Render URLs, personal emails, and PII literals in all tracked files. Deploy rewrites: `vercel.json.example` + `RENDER_API_PROXY_URL` at Vercel build.

## Scripts

Never run production maintenance scripts without reading [`docs/SCRIPTS_RUNBOOK.md`](docs/SCRIPTS_RUNBOOK.md).

## Agents

Primary context: [`docs/AI_AGENT_PROJECT_CONTEXT.md`](docs/AI_AGENT_PROJECT_CONTEXT.md)
