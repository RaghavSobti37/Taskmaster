# Conventions & locked behavior

## Do not change without explicit unlock

| Domain | Spec |
| --- | --- |
| Logo + spinner | `docs/LOGO_LOCKED.md`, `.cursor/rules/logo-mark-locked.mdc` |
| Email tracking/geo | `docs/EMAIL_ENGINE_LOCKED.md`, `.cursor/rules/email-engine-locked.mdc` |
| Production hosts | `.cursor/production-hosts.local.json` (gitignored), `.cursor/rules/production-hosts-locked.mdc` |

## Pre-push checklist

1. `npm run audit:exposure` — exit 0
2. `npm run audit:deadcode` — exit 0
3. No secrets in staged files (`server/.env.render`, live keys)
4. Update `.specify/memory/recent-changes.md` when behavior shifts

## Commit style

- Prefix: `feat:`, `fix:`, `chore:`, `docs:`
- One logical change per commit when possible

## Testing

- Server: `npm test` (Jest, Memory Server)
- Client: `npm test --prefix client` (Vitest)
- E2E: `npm run test:e2e:public`, `npm run test:e2e:auth`
- CI: `npm run ci`
