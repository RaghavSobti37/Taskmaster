# Conventions

## Locked (do not change without explicit unlock)

- **Logo / spinner:** `docs/LOGO_LOCKED.md`, `.cursor/rules/logo-mark-locked.mdc`
- **Email engine / tracking:** `docs/EMAIL_ENGINE_LOCKED.md`, `.cursor/rules/email-engine-locked.mdc`
- **Production hosts:** `.cursor/production-hosts.local.json` — never use legacy `CoreKnot-jfw0` hosts

## Pre-push audits (required)

```bash
npm run audit:exposure   # exit 0
npm run audit:deadcode   # exit 0
```

## Pagination

- Default page size: **10** — `DEFAULT_TABLE_PAGE_SIZE` in `client/src/components/ui/primitives.jsx`
- Do not override with 15/25 unless product explicitly requests

## Secrets

- Never commit: `server/.env`, `server/.env.render`, `production-hosts.local.json`, live Mongo URIs
- Scripts targeting prod: `MONGODB_URI_PROD`, explicit `--yes` / confirm flags

## Local-only UI

- **Agentation** feedback widget: `client/src/components/dev/AgentationDev.jsx` — never ship to prod; load via `import.meta.env.DEV` + lazy import in `main.jsx`

## Commits

- Conventional prefix: `feat:`, `fix:`, `chore:`, `docs:`
- `/push-and-document` updates README + `.specify/memory/` tracked files

## Campaign geo repair

- One-off DB fix: `node server/scripts/rebuildCampaignLocationBreakdown.js <id> [--dry-run]` from repo root; uses `server/.env` (`MONGODB_URI` or prod when `MAIL_USE_PROD_DB=true`).
- Do not change locked tracking URL / open pixel behavior when adjusting geo.
