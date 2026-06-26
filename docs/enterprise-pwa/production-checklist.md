# Production gate — §17 checklist tracking

See [gap-ledger.md](./gap-ledger.md) for baseline audit.

## Completed in migration

- [x] Monorepo packages: design-tokens, local-database, sync-client
- [x] PowerSync pilot config + sync token API
- [x] SQLite WASM worker + OPFS schema
- [x] SW prompt-based updates, no API cache, nav preload
- [x] features/workspace pilot hooks + Zustand UI state
- [x] WebAuthn passkey routes (register/login options)
- [x] Global API idempotency middleware (Redis-backed)
- [x] COOP/COEP headers (Vite dev + Helmet)
- [x] Offline E2E Playwright spec
- [x] Terraform header documentation

## Remaining for full enterprise gate

- [ ] PowerSync service deployed to staging/production
- [ ] `VITE_LOCAL_FIRST=true` enabled per environment after sync verified
- [ ] Mongo→Postgres cutover for pilot tables
- [ ] axe-core CI gate on authenticated routes
- [ ] WebAuthn full @simplewebauthn/server signature verification
- [ ] Blue-green deploy playbook execution test

## Rollback

1. Set `SW_KILL_SWITCH=true` on API → clients unregister SW
2. Disable `SYNC_DUAL_WRITE` and `VITE_LOCAL_FIRST`
3. Revert to network-first TanStack Query paths
