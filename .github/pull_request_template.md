## Summary

<!-- What changed and why -->

## Docs / env

- [ ] Read [`docs/ENVIRONMENT_MATRIX.md`](../docs/ENVIRONMENT_MATRIX.md) if URLs or env vars changed
- [ ] `npm run audit:exposure` passes (no Render URLs in docs except deploy config)
- [ ] Production hosts set via env vars only — not hardcoded in markdown
- [ ] Large API payloads still target Render via `VITE_API_URL` (not Vercel proxy only)

## Code checklist

- [ ] Department permissions — not legacy `user.role`
- [ ] New API routes have React Query hooks in `useTaskmasterQueries.js`
- [ ] New pages registered in `pagePermissions.js` (client + server)
- [ ] Multi-doc writes use `session.withTransaction()`; notifications after commit
- [ ] Read queries use `.lean()` where appropriate
- [ ] Shared business rules in `shared/` (not duplicated client/server)
- [ ] Email engine / logo untouched OR explicit unlock noted in PR

## Test plan

- [ ] `npm run ci` or `cd server && npm test` + `cd client && npm run build`
- [ ] Manual smoke on affected flows (local)
