# Changelog

All notable CoreKnot releases. Version aligns with root `package.json`.

## [1.0.7] - 2026-07-02

### Enterprise readiness

- Clerk-first production auth path; legacy login returns 410 when `ALLOW_LEGACY_LOGIN` unset
- Clerk webhook handler (`/api/webhooks/clerk`) for user lifecycle sync
- Admin session revoke: `POST /api/users/:id/sessions/revoke-all`; auto-revoke on user suspend
- Tenant SSO admin: `/admin/tenant-sso` + `PATCH /api/admin/tenants/:id`
- Unified `SecurityAudit` model + middleware on finance, users, platform settings, data hub
- Security audit UI: `/admin/security-audit`
- Sentry instrumentation (server `instrument.js`, client `lib/sentry.js`)
- API v1 mount: `/api/v1/health`, `/api/v1/auth/me`, `/api/v1/data-hub/sync-status`
- OpenAPI version sync script; Swagger UI at `/api/docs` (non-prod)
- ADR program under `docs/architecture/adr/`
- CI: OpenAPI drift check, tenant static suite, locked-zone regression tests

[1.0.7]: https://github.com/theshakticollective/coreknot/compare/v1.0.6...v1.0.7
