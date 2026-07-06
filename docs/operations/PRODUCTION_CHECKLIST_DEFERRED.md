# Production checklist — deferred (todo)

> Parked after production-gates batch (2026-07-06). Not blocking dev/staging/main promotion.
> Source: `PRODUCTION_READINESS_CHECKLIST.md` remaining `[ ]` items.

## §1 Foundation stability

- [ ] Staging green 48h across Express + Nest + Vercel (no manual intervention)
- [ ] Clerk FAPI proxy failure RCA + doc (not just rollback)
- [ ] NestJS build-time failure doc + re-verify `npm run build --workspace=@coreknot/nestjs-server`
- [ ] Audit `production-hosts.local.json` vs Render/Vercel (gitignored)
- [ ] Supabase project not paused/idle
- [ ] Redis/BullMQ linked on all queue-dependent prod services

## §2 Data integrity

- [ ] `budgetSource` displayed distinctly everywhere budget appears (UI audit)
- [ ] `conversionRate` on all `FinanceDocument` writes (import scripts path)
- [ ] Task status transitions atomic (server + test)

## §3 Multi-tenancy

- [ ] Tenant isolation suite covers every nested collection in checklist
- [ ] `featureUnlocks` enforced on all mutating routes (route matrix test)
- [ ] IDOR spot-check across resource types (manual QA)
- [ ] Platform-admin routes — full matrix beyond `/api/admin/scripts`

## §4 Auth & security

- [ ] CORS locked to production domains
- [ ] CSRF on cookie-authenticated mutating endpoints
- [ ] OAuth/Resend/Meta credentials encrypted; `CREDENTIAL_ENCRYPTION_KEY` in prod
- [ ] Integration Revoke invalidates stored credentials
- [ ] No full API keys at debug log level
- [ ] `AppBootError` graceful Clerk outage

## §5 Org-first / Clerk

- [ ] Clerk dashboard test events against staging
- [ ] Sprint F backfill: `Tenant.clerkOrganizationId`, `User.clerkUserId`, memberships
- [ ] Membership count parity (`inventoryClerkSync.js`)
- [ ] Role changes via Clerk API first (beyond invites)
- [ ] Platform-admin unaffected by identity change (manual)
- [ ] Custom-role overlay on Clerk membership

## §6 Onboarding UX

- [ ] SSO/SCIM JIT default restrictive preset
- [ ] Org creation transaction + invite emails E2E

## §7–§16 (enterprise / ops)

- [ ] Admin activity feed, platform-admin visual distinction, setup badges
- [ ] Audit log UI, `AuditEvent` coverage, CSV/SIEM export, retention
- [ ] Tenant export, offboarding owner flow, impersonation audit
- [ ] DPA, SOC 2 stubs
- [ ] Stripe billing, usage dashboard, overage, invoices
- [ ] API-key rate limit separate from session; developer portal
- [ ] Custom domains, white-label
- [ ] Observability depth (Sentry, PostHog, uptime)
- [ ] E2E invite flow, load tests, Lighthouse top-10
