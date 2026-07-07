# CoreKnot Enterprise Readiness

> Builds on public launch (v1). v2 adds enterprise identity, governance, API platform, and sales-readiness. **Payment/Stripe billing deferred** — plan tiers gate features only.

## §0 Verification (enforced)

| Check | Status |
|-------|--------|
| `rejectClientTenantSpoof` on all authenticated routes | Via `protect` middleware chain |
| `TenantMembership` unique `{tenantId, userId}` | Model index |
| Server `requireFeatureUnlock` on campaigns, finance | Mounted |
| Tenant isolation integration tests | `server/tests/tenantIsolation.integration.test.js` |
| Enterprise smoke | `node server/scripts/enterpriseSmoke.cjs` |

## API surface

| Path | Purpose |
|------|---------|
| `GET /api/enterprise/audit` | Tenant audit log |
| `GET /api/enterprise/audit/export` | CSV export (enterprise plan) |
| `GET/PATCH /api/enterprise/security` | SSO, MFA policy, IP allowlist, branding |
| `POST /api/enterprise/scim/token` | Issue SCIM bearer (enterprise) |
| `GET/POST /api/enterprise/roles` | Custom roles (enterprise) |
| `GET/POST/DELETE /api/enterprise/api-keys` | Tenant API keys |
| `GET/POST /api/enterprise/webhooks` | Outbound webhooks |
| `GET /api/enterprise/usage` | Plan + usage snapshot |
| `GET /api/enterprise/status` | Public status JSON stub |
| `POST /api/enterprise/export` | Queue tenant JSON export |
| `GET /api/enterprise/export/:jobId` | Download completed export |
| `POST /api/enterprise/offboard` | Owner offboarding (14-day grace) |
| `GET /api/v1/health` | Public API (Bearer `ck_live_*`) |
| `POST /api/auth/mfa/*` | User TOTP enrollment |
| `POST /api/admin/support/impersonate` | Platform support impersonation (audited) |
| `/api/scim/v2/*` | SCIM 2.0 provision (Bearer from `/scim/token`) |

## Plan tiers (`shared/planLimits.js`)

- **free** — 5 seats, core features
- **pro** — 25 seats, resend/google/meta/finance
- **enterprise** — SSO, SCIM, custom roles, audit export, API keys, webhooks

## Ops

```bash
node server/scripts/migrateTenantMemberships.js
node scripts/push-enterprise-render-env.mjs   # CREDENTIAL_ENCRYPTION_KEY + ENTERPRISE_FEATURES_ENABLED
node server/scripts/enterpriseSmoke.cjs
```

## Sprint status

| Sprint | Scope | Status |
|--------|-------|--------|
| 8 Identity | SSO fields, SCIM provision, MFA TOTP, custom roles → page access | Wired |
| 9 Governance | AuditEvent, audit UI, export job, offboard cron, impersonation | Wired |
| 10 Monetization | Plan limits, usage metering (no Stripe yet) | Partial |
| 11 Platform/API | API keys, webhooks + lead.created emit, `/developers` nav | Wired |
| 12 White-label | Tenant branding/domain fields on model | Schema only |
| 13 Enterprise UX | Bulk ops, delegated admin, adoption dashboard | Not started |
| 14 Sales readiness | DPA, subprocessor list, SOC 2 docs | Draft stubs |

## Deferred

- Stripe subscriptions / invoice history
- Full SAML/OIDC native (Clerk org link remains primary)
- IP allowlist on every API path (enforced at login today)

## Compliance artifacts (draft)

- **DPA template** — `docs/legal/DPA_TEMPLATE.md` (create before first enterprise contract)
- **Subprocessors** — Render, Vercel, MongoDB Atlas, Resend, Supabase (list in DPA appendix)
- **SOC 2** — map `SecurityAuditPage` controls to policy docs
