# CoreKnot — Production Readiness Checklist (Master)

> Consolidates: v1 Launch Readiness Plan, v2 Enterprise Readiness Plan, Org-First/Clerk Roadmap,
> Admin Console & Dynamic Onboarding improvements. Organized as gates — each section should be
> substantially checked off before the next is load-bearing for real customer traffic.
>
> **Last audited:** 2026-07-06 (org-first Clerk Sprints A–E + automated verify pass)

Legend: 🔴 blocking for any public traffic · 🟡 blocking for enterprise customers · ⚪ polish/nice-to-have

**Verify evidence (2026-07-06):**

| Command | Result |
|---------|--------|
| `npm test --prefix server -- "--testPathPatterns=clerkWebhook\|backfillClerk\|clerkRoleMapping\|clerkInvite\|orgFirstAuth"` | 6 suites, **37 passed** |
| `npm test --prefix client` | 82 files, **345 passed** + 11 node tests |
| `npm run build --prefix client` | **exit 0** |

---

## 1. Foundation stability 🔴

- [ ] Staging green across all 3 services (Express, NestJS, Vercel) for 48+ hours with no manual intervention — **NOT VERIFIED** (MANUAL ONLY; no 48h soak evidence)
- [ ] Root cause of Clerk FAPI proxy middleware failure fixed and documented, not just rolled back — **NOT VERIFIED** (needs ops postmortem doc)
- [ ] NestJS build-time failure fixed and documented — **PARTIAL**: `npm run build --workspace=@coreknot/nestjs-server` referenced in `environments.md` staging gate; not re-run this audit
- [ ] `production-hosts.local.json` audited against actual Render/Vercel config — **MANUAL ONLY** (gitignored file)
- [ ] Supabase project confirmed not paused/idle — **NOT VERIFIED** (MANUAL ONLY)
- [ ] Redis/BullMQ confirmed linked to every queue-dependent service — **PARTIAL**: `environments.md` documents staging Redis; prod linkage **NOT VERIFIED** this pass
- [x] Working staging env var set documented in `operations/environments.md` — evidence: `docs/operations/environments.md` (staging gate table 2026-07-05)

## 2. Data integrity 🔴

- [ ] Summary vs. detail analytics hours reconciled via single `aggregateProjectEffort` path — **NOT VERIFIED**
- [ ] `conversionRate` snapshot on all `FinanceDocument` writes — **NOT VERIFIED**
- [ ] `budgetSource` displayed distinctly everywhere budget appears — **NOT VERIFIED**
- [ ] Assignment→completion join regression test in CI — **NOT VERIFIED**
- [ ] `clientRequestId` idempotency (unique index) on `Log` writes — **NOT VERIFIED**
- [ ] Gamification level recalculation idempotent — **NOT VERIFIED**
- [ ] Task rollback window (24h) enforced server-side — **NOT VERIFIED**
- [ ] Task status transitions atomic — **NOT VERIFIED**

## 3. Multi-tenancy & data isolation 🔴

- [ ] Tenant isolation test suite in CI on every PR across all list/detail endpoints — **PARTIAL**: `server/tests/tenantIsolation.integration.test.js` exists; CI runs full Jest (`ci.yml` server-test job) but suite does not cover every nested collection named in checklist
- [x] `rejectClientTenantSpoof` mounted before tenant-scoped routes — evidence: `authMiddleware.js` `protect` chain calls `rejectClientTenantSpoof`; `server/tests/rejectClientTenantSpoof.test.js`
- [x] No handlers reading `tenantId`/`orgId` from `req.body`/`req.query` — evidence: grep `req.(body|query).(tenantId|orgId)` → **0 matches** (2026-07-06)
- [x] `TenantMembership` compound unique `{tenantId, userId}` — evidence: `server/models/TenantMembership.js` line 17
- [ ] `featureUnlocks` enforced server-side on mutating routes — **PARTIAL**: `requireFeatureUnlock` middleware exists; full route coverage **NOT VERIFIED**
- [ ] IDOR spot-check across resource types — **NOT VERIFIED** (MANUAL ONLY)
- [ ] Platform-admin routes unreachable by org `admin` — **NOT VERIFIED** (MANUAL ONLY; needs real customer-org admin account)

## 4. Auth, security & secrets 🔴

- [x] Rate limiting on `authRoutes.js` (login, OTP, clerk-establish) — evidence: `server/domains/auth/routes.js` `authLoginLimiter`, `authSignupLimiter`, `clerkEstablishLimiter`; `server/middleware/rateLimits.js`
- [ ] Password reset / OTP tokens short-lived and single-use — **NOT VERIFIED** this pass
- [ ] `SessionsTab` revoke-all on password change — **NOT VERIFIED**
- [ ] CORS locked to production domains — **NOT VERIFIED** this pass
- [ ] CSRF on cookie-authenticated mutating endpoints — **NOT VERIFIED**
- [ ] OAuth/Resend/Meta credentials encrypted at rest; `CREDENTIAL_ENCRYPTION_KEY` set in prod — **NOT VERIFIED** (MANUAL ONLY)
- [ ] Integration Revoke actions invalidate stored credentials — **NOT VERIFIED**
- [x] Webhook signature verification — evidence: Clerk Svix in `clerkWebhookHandler.js`; tests `clerkWebhookSync.test.js` invalid + valid signature cases
- [ ] No full API keys logged at debug — **NOT VERIFIED** (static grep only partial via `qaPreDeploymentChecklist.js`)
- [ ] `AppBootError` graceful Clerk outage — **NOT VERIFIED**

## 5. Org-first identity & Clerk integration 🟡

> **Sprint mapping (org-first ledger):** A=webhook+ClerkSyncEvent · B=backfill scripts · C=CLERK_IDENTITY_WRITE_PATH invites · D=CLERK_ORG_FIRST_AUTH session · E=UI (OrgSwitcher, org-first redirects) · F=migration (pending) · G=hardening (pending)

- [x] Option A vs B documented — evidence: **Option A** (global `User`, org-scoped UX) in `docs/architecture/adr/001-clerk-first-auth.md`; ledger discovery d-002 notes link-only `user.created` (no auto-provision)
- [x] `clerkWebhookHandler.js` deployed path + Svix verify + `ClerkSyncEvent` idempotency — evidence: `server/domains/auth/webhooks/clerkWebhookHandler.js`, `server/models/ClerkSyncEvent.js`, `clerkWebhookSync.test.js` (7 webhook tests in combined suite)
- [ ] Clerk dashboard test events against staging — **MANUAL ONLY**
- [ ] Backfill run: every `Tenant` has `clerkOrganizationId` — **DEFERRED** Sprint F; scripts exist: `server/scripts/backfillClerkOrganizations.js` (not executed in prod)
- [ ] Backfill run: every `User` has `clerkUserId` — **DEFERRED** Sprint F
- [ ] Backfill run: active `TenantMembership` ↔ Clerk membership — **DEFERRED** Sprint F; script: `backfillClerkMemberships.js`
- [ ] Membership count parity spot-check — **MANUAL ONLY**; inventory script: `inventoryClerkSync.js`
- [x] Invite creation via Clerk API first (flag-gated) — evidence: `clerkInviteService.js` + `CLERK_IDENTITY_WRITE_PATH`; `clerkInviteService.test.js`
- [ ] Role changes via Clerk API first — **NOT VERIFIED** (invite path only in Sprint C)
- [x] Org-first login behind feature flag — evidence: `server/utils/orgFirstAuth.js` (`CLERK_ORG_FIRST_AUTH`), `client/src/lib/orgFirstAuth.js` (`VITE_ORG_FIRST_AUTH` + `/api/auth/config`); `orgFirstAuth.test.js`
- [x] Legacy 409/`NEEDS_TENANT_SELECTION` path retained — evidence: `authMiddleware.js`, `setupAxiosInterceptors.js`, `orgFirstAuth.test.js`
- [ ] Platform-admin unaffected by identity change — **NOT VERIFIED** (MANUAL ONLY)
- [x] `organization.deleted` → offboarding — evidence: `clerkWebhookHandler.js` case `organization.deleted`; `tenantOffboardingService` via `backgroundQueue.js`
- [ ] Custom-role overlay on Clerk membership — **NOT VERIFIED**

### §5 Env flags (default OFF in production)

| Flag | Side | Purpose |
|------|------|---------|
| `CLERK_IDENTITY_WRITE_PATH` | Server | Invites/membership writes via Clerk API |
| `CLERK_ORG_FIRST_AUTH` | Server | Org resolved before session; reduces 409 picker |
| `VITE_ORG_FIRST_AUTH` | Client | Client mirror; unset → follows `/api/auth/config` |
| `CLERK_WEBHOOK_SECRET` | Server | Svix signature verification (required when webhooks enabled) |

Documented in `docs/operations/environments.md` § Clerk org-first flags.

## 6. Organization creation & onboarding UX 🟡

- [x] `/org/create` multi-step wizard — evidence: `CreateOrganizationPage.jsx` + `client/src/pages/org/create/` steps (modified in Sprint E)
- [ ] Step 3 requires role before email — **NOT VERIFIED** this pass
- [ ] `TenantMembership.role` non-null at schema — **PARTIAL**: model allows null; enforcement **NOT VERIFIED**
- [ ] SSO/SCIM JIT default to restrictive preset — **NOT VERIFIED**
- [ ] Org creation transaction + queued invite emails — **PARTIAL**: `tenantInviteEmailQueue.js` + worker added; E2E **NOT VERIFIED**
- [x] Success screen → dashboard with checklist — evidence: `OrgCreateSuccessPage.jsx`, `OrgOnboardingChecklist.jsx` updates
- [ ] `profile_complete` server-side event — **PARTIAL**: `onboardingListener.js` + tests exist; full wiring **NOT VERIFIED**
- [ ] `first_project` server hook + Finance unlock — **NOT VERIFIED**
- [ ] `applicableIf(tenant)` on onboarding steps — **PARTIAL**: `shared/orgOnboardingChecklist.js`; **NOT VERIFIED** E2E
- [ ] Checklist returns null when complete — **NOT VERIFIED**
- [ ] 24h snooze/dismiss — **NOT VERIFIED** after onboarding changes

## 7. Admin console 🟡

- [x] Status ribbon / summary — **PARTIAL**: `useAdminConsoleSummary.js`, `AdminConsole.jsx` overhaul (uncommitted)
- [ ] Recent admin-activity feed from audit log — **NOT VERIFIED**
- [ ] Platform-admin visual distinction — **NOT VERIFIED**
- [x] Command palette over admin tiles — evidence: `commandPaletteActions.js` admin entries
- [ ] Setup-required vs caution badges — **NOT VERIFIED**
- [x] Bulk actions on AdminUsers/Teams — evidence: `AdminBulkActionBar.jsx`, `AdminUsers.jsx`, `AdminTeamsPage.jsx` changes
- [x] Breadcrumbs on nested admin — evidence: `AdminBreadcrumbs.jsx` (new)

## 8. Governance, audit & compliance 🟡

- [ ] Tenant audit log page `/admin/audit-log` — **PARTIAL**: enterprise routes in `ENTERPRISE_READINESS.md`; UI **NOT VERIFIED**
- [ ] `AuditEvent` interceptor coverage — **NOT VERIFIED**
- [ ] CSV/SIEM export — **PARTIAL**: enterprise route documented; **NOT VERIFIED**
- [ ] Audit retention per plan — **NOT VERIFIED**
- [ ] Self-service tenant export — **PARTIAL**: enterprise export job documented
- [ ] Tenant offboarding owner flow — **PARTIAL**: `tenantOffboardingService`; Clerk delete path wired
- [ ] Impersonation audited + visible to tenant — **NOT VERIFIED**
- [ ] DPA + subprocessor list — **DEFERRED** (`ENTERPRISE_READINESS.md` draft stubs)
- [ ] SOC 2 controls documented — **DEFERRED**

## 9. Billing & plan enforcement 🟡

- [ ] Stripe integrated — **DEFERRED** (`ENTERPRISE_READINESS.md`: payment deferred)
- [ ] Seat limits at invite time post-Clerk — **NOT VERIFIED** after Sprint C
- [x] Plan-tier gates server-side — **PARTIAL**: `planEnforcementService.js`, `requireFeatureUnlock`; enterprise features in `shared/planLimits.js`
- [ ] Usage dashboard — **NOT VERIFIED**
- [ ] Overage handling — **NOT VERIFIED**
- [ ] Invoice history + GSTIN — **NOT VERIFIED**

## 10. Public API & extensibility 🟡

- [x] Tenant API keys — **PARTIAL**: `ENTERPRISE_READINESS.md` § API surface wired
- [x] Outbound webhooks — **PARTIAL**: enterprise routes documented
- [ ] API-key rate limiting separate from session — **NOT VERIFIED**
- [ ] OpenAPI published — **PARTIAL**: CI `generate-openapi.mjs --check`
- [ ] Developer portal — **NOT VERIFIED**

## 11. White-label & custom domains 🟡

- [ ] Custom domain → tenantId before auth — **NOT VERIFIED**
- [ ] Automated TLS for custom domains — **NOT VERIFIED**
- [ ] Branding scoped to tenant workspace — **PARTIAL**: schema only per `ENTERPRISE_READINESS.md`
- [ ] White-label outbound email domain — **NOT VERIFIED**

## 12. Observability & reliability 🔴 (baseline) / 🟡 (per-tenant depth)

- [ ] Centralized error tracking Express + Nest — **PARTIAL**: Sentry referenced in ops docs; **NOT VERIFIED** live
- [ ] Uptime monitoring all 3 services — **MANUAL ONLY**
- [ ] Per-tenant latency/error metrics — **NOT VERIFIED**
- [ ] Distributed tracing — **NOT VERIFIED**
- [ ] Status page — **PARTIAL**: `GET /api/enterprise/status` stub
- [ ] SLA tiers vs hosting plans — **NOT VERIFIED**
- [ ] Backup restore E2E tested — **MANUAL ONLY**
- [ ] `tenantId` leading compound indexes — **NOT VERIFIED** (audit needed)

## 13. UI/UX consistency pass ⚪→🟡

- [ ] Empty states on all DataTable/ListPageLayout — **NOT VERIFIED**
- [ ] Actionable error states — **NOT VERIFIED**
- [ ] CoreKnot spelling consistent — **NOT VERIFIED**
- [ ] DD/MM/YYYY everywhere — **PARTIAL**: `shared/dateFormatPreference.js` updated
- [ ] No `window.alert`/`confirm` — **NOT VERIFIED**
- [ ] No deprecated `CenteredModal` — **NOT VERIFIED**
- [ ] Keyboard shortcut badges — **NOT VERIFIED**
- [ ] Shortcut remap conflict detection — **NOT VERIFIED**

## 14. Knowledge Engine / content pipeline (Shakti Collective) ⚪

- [ ] PageLoadGuard/EmptyState on KE tabs — **NOT VERIFIED**
- [ ] Job triggers via BullMQ — **NOT VERIFIED**
- [ ] KE OAuth tokens encrypted — **NOT VERIFIED**
- [ ] Human review gate before publish — **NOT VERIFIED**

## 15. Legal & compliance 🔴

- [ ] Privacy Policy reflects multi-org + integrations — **NOT VERIFIED** (pages exist: `PrivacyPolicy.jsx`)
- [x] Terms of Service live — evidence: route `/terms` in `App.jsx`, `TermsOfService.jsx`
- [ ] Meta data-deletion hard-delete — **NOT VERIFIED**
- [ ] Unsubscribe respected on all campaign types — **NOT VERIFIED**
- [ ] Cookie/session consent for EU — **PARTIAL**: `CookieConsentBanner.jsx` exists; legal review **NOT VERIFIED**

## 16. Final QA gate before flipping public 🔴

- [ ] Full invite → accept → org access E2E — **NOT VERIFIED** (MANUAL ONLY)
- [ ] Load test concurrent tenants — **NOT VERIFIED**
- [ ] Lighthouse a11y top-10 pages — **PARTIAL**: CI `lighthouse-public` on `/` and `/login` only
- [ ] Security audit page vs prod config — **MANUAL ONLY**
- [ ] `/admin/security-audit` denied to customer-org admin — **MANUAL ONLY**
- [ ] §1–§4 🔴 complete before external signups — **BLOCKED** (see gate assessment)
- [ ] §5–§11 🟡 complete before enterprise sales — **BLOCKED**

---

## Suggested gating order (assessment 2026-07-06)

| Tier | Requirement | Achievable today? |
|------|-------------|-----------------|
| **1. Internal-only** (dogfood) | §1–§4 complete | **NO** — multiple 🔴 items open in §1–§2, §3–§4 partial only |
| **2. Invite-only beta** (3–5 orgs) | §1–§6, §12 baseline, §15 | **NO** — §6 onboarding partial; §15 incomplete |
| **3. Open public signup** | + §13, §14 | **NO** |
| **4. Enterprise sales-ready** | + §5–§11, §12 depth, §16 | **NO** |

### Recommendation

**Ship org-first Clerk foundation to `main` behind env flags (all default OFF).** Safe for continued **internal dogfood** on staging with flags enabled for test tenants. **Do not** open public signups or enterprise sales until §1–§4 🔴 gaps close.

**Highest P0/P1 open items:**

| Priority | Item |
|----------|------|
| P0 | §1 staging 48h green + Clerk FAPI proxy root-cause doc |
| P0 | §3 tenant isolation CI expansion + IDOR + platform-admin denial tests |
| P0 | §4 prod `CREDENTIAL_ENCRYPTION_KEY` + CORS/CSRF verification |
| P1 | §5 Sprint F: run backfills in staging/prod; manual Clerk webhook verification |
| P1 | §5 enable flags only after backfill + staging soak |
| P1 | §6 onboarding server events E2E |
| P1 | §9 seat limits after Clerk invite cutover |

---

## Related

- Org-first ledger: `.cursor/loop-engineering/org-first-clerk-ledger.json`
- Enterprise surface: `docs/operations/ENTERPRISE_READINESS.md`
- Env matrix: `docs/operations/environments.md`
- CI: `.github/workflows/ci.yml`
