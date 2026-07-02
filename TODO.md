# CoreKnot / Taskmaster — Project TODO

**Generated:** 2026-07-01  
**Sources:** `docs/FULL_APP_REVIEW_BACKLOG.md`, `docs/IMPROVEMENT_ROADMAP.md`, `.specify/memory/changelog/recent-changes.md`, `docs/DATA_HUB_PRODUCT_VISION.md`, `docs/TENANT_SECURITY_PHASE.md`, `docs/superpowers/specs/2026-06-29-projects-page-improvement-plan.md`, `docs/ARTIST_OS_PLAN.md`, `docs/UX_ARCHITECTURE_1.0.0_ROADMAP.md`, `docs/enterprise-pwa/gap-ledger.md`, `nestjs-server/MIGRATION_STATUS.md`

Use this as the single checklist for remaining work. When something ships, mark it here and update the source doc.

---

## P0 — Urgent (second org + production ops)

### Tenant security (before onboarding org #2)

- [ ] **T0-6** Finish `TENANT_SECURITY_PHASE` — full `bypassTenant` grep audit + automation (`docs/TENANT_SECURITY_PHASE.md`)
- [ ] **T0-7** Wrap remaining raw `.aggregate(` call sites with `aggregateWithTenant` (CRM stats, Data Hub, mail metrics, workers)
- [ ] **T0-8** Confirm `tenantPlugin` on all remaining models; close any gaps from static QA suite
- [ ] **T0-13** Require webhook secrets in staging; verify SNS/Resend signatures on every path
- [ ] Compound unique indexes `{ tenantId, email }` + backfill legacy `tenantId` rows (Tier 1)
- [ ] Super-admin role + break-glass cross-tenant bypass (optional, planned)
- [ ] Per-tenant worker iteration for all crons (`runForEachTenant`)

### Production / deploy verification

- [ ] **T0-1 (partial)** Manually verify Render Dashboard env (`TRACKING_BASE_URL`, `FRONTEND_URL`, `SERVER_URL`) matches `.cursor/production-hosts.local.json`
- [ ] Confirm GitHub Actions `keep-warm.yml` runs on schedule (Render cron N/A on free tier)
- [ ] Provision `taskmaster-redis-staging` in Render Dashboard if Blueprint did not sync
- [ ] Redeploy Render API after multi-site cookie domain + CORS changes (`.tsccoreknot.com` session cookie)

### RBAC polish (Wave 3 remains)

- [ ] Permission-aware hiding of nav/sidebar links for tool pages (`/office-assets`, `/features`, `/workflows`, `/settings`)
- [ ] Migrate users on legacy custom roles (editor, videographer, cg-artist) if any remain
- [ ] Server-side API guards for tool-page backends when routes are added
- [ ] E2E: permission-denied redirect paths

---

## P1 — User-facing product

### Data Hub (`docs/DATA_HUB_PRODUCT_VISION.md`)

- [ ] **Phase B** — Last activity column (replace “Updated” label); strengthen Inlets column; loyal/multi-inlet filter chips
- [ ] **Phase C** — Single collapsible analytics strip above table; merge insights from retired side panel
- [ ] **T3-2 (ops, partial)** Run `checkPersonHubParity.js` → read-only `PersonIndex` → stop ContactService dual-write when ops-ready

### Projects page (`docs/superpowers/specs/2026-06-29-projects-page-improvement-plan.md`)

**P0 — high impact**

- [ ] Export `useUpdateProject`; use for move + star with optimistic cache + error toasts
- [ ] Move-to-workspace modal + confirm (non-drag path; mobile-friendly)
- [ ] Workspace filter dropdown in toolbar
- [ ] Status badge on `ProjectPreview` in workspace grid
- [ ] `?workspace=` query param on `ProjectCreate` + per-workspace “New project” CTAs
- [ ] Empty-state CTAs (“Create project in {workspace}”)

**P1 — UX polish**

- [ ] Member avatars + count on project cards
- [ ] `updatedAt` / created relative date on cards
- [ ] Starred-only filter toggle
- [ ] Quick-create modal (name + workspace only)
- [ ] Mobile: allow quick-create OR lift desktop gate for minimal create
- [ ] Workspace header aggregates (tasks, overdue, review per group)
- [ ] Create-workspace error toast (replace `console.error` only)

**P2 — larger scope**

- [ ] Compact table view (`DataTable`)
- [ ] Bulk workspace move (optional `PATCH /api/projects/bulk`)
- [ ] Validate workspace name on `PUT /api/projects/:id` (400 if unknown)
- [ ] Project templates / duplicate-from-project

### CRM

- [ ] **T2-5** Extract shared `LeadEditorWorkspace.jsx` + `useLeadEditor` hook (~2000 duplicate lines across Leads + Followups)
- [ ] **T2-6** Fix sidebar prefetch keys to match real React Query keys
- [ ] **T3-3** Migrate `Lead.nextFollowupDate` to `Date` + migration script
- [ ] Duplicate lead merge UI
- [ ] Bulk CRM assign / status / tag
- [ ] **T1-4 (deferred)** Fix `importWorker` rep mapping — only if CSV import is re-enabled

### Artist OS (`docs/ARTIST_OS_PLAN.md`, `docs/ARTIST_OS_PHASE1_IMPLEMENTATION.md`)

**Phase 1b backend (UI shell exists; data is stubbed)**

- [ ] Supabase / Postgres schema for operational entities (inquiries, gigs, calendar, finance, contracts)
- [ ] `GET /api/artists/:id/os/overview` — real MTD revenue / expense / profit KPIs
- [ ] Extend `processArtistEnquiryLogic` → persist `artist_inquiries` (not just tasks)
- [ ] Calendar merge service (inquiries + confirmed gigs + releases)
- [ ] Gigs CRUD
- [ ] Per-artist finance filter + OCR upload
- [ ] Wire Inquiries tab to real pipeline (replace demo data)

**Later phases**

- [ ] Phase 2: Team Notes, Documents, Contracts tabs
- [ ] Phase 3: Analytics tab correlations (releases ↔ gig revenue)
- [ ] Phase 4: Content / release tracker
- [ ] Artist self-onboarding via expanded share-link + claim flow

---

## P2 — UX 1.0.0 roadmap (`docs/UX_ARCHITECTURE_1.0.0_ROADMAP.md`)

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Token foundation + dark palette | partial — verify acceptance criteria |
| 1 | Sidebar, toasts, reduced motion | partial |
| 2 | Command Palette v2 + unified search | mostly done |
| 3 | Data Hub + CRM density (sticky columns) | partial |
| 4 | Finance + HR/Attendance timeline | partial |
| 5 | Tasks + quiet gamification | partial |
| 6 | Integrations + ops terminal | planned |
| 7 | Accessibility hardening + Lighthouse CI | planned |

**Open polish (Phase E)**

- [ ] `PageSkeleton` on all data pages
- [ ] Bulk selection bar consistency across admin tables
- [ ] 44px touch target audit on mobile
- [ ] Mobile card fallback for wide tables
- [ ] Onboarding tour per department
- [ ] Notification category preferences

---

## P2 — Data integrity

- [ ] **T3-1 (partial)** Reconcile stored `$inc` project task counters vs live aggregation — full reconcile script
- [ ] **T3-5** Archive legacy `Campaign` collection after MailCampaign parity
- [ ] **T3-6** Versioned migration ledger (`migrations/` + applied collection)
- [ ] **T3-7** Batch attendance metric refresh if list perf degrades (move off write-on-read)
- [ ] Event bus for task → XP → project rollup (decouple circular service deps)

---

## P2 — Security & compliance

- [ ] **T1-1** Rate-limit public unsubscribe + meta deletion status endpoints
- [ ] **T1-2** Wrap async routes with `asyncHandler` (incremental by domain)
- [ ] **T1-3** Compound unique indexes for multi-tenant email/template names
- [ ] MFA / 2FA (repeatedly deferred since Phase B11+)
- [ ] Google + Meta app verification checklist (`docs/GOOGLE_META_APP_VERIFICATION.md`) — `GET /api/integrations/oauth-readiness` → `ready: true`
- [ ] Verify / remove dead SES webhook code if Resend is sole provider
- [ ] Structured logging: replace raw `console.*` in services (40+ files; needs ESLint pass)

---

## P3 — Platform & infrastructure

### NestJS strangler + Postgres (`nestjs-server/MIGRATION_STATUS.md`, `docs/PREVIEW_SUPABASE_CUTOVER.md`)

- [ ] Local Postgres provisioned (Docker Compose or native) + `prisma db push`
- [ ] ETL tier-1 validation (`npm run etl:mongo-to-postgres -- --tier=1`)
- [ ] Preview Supabase cutover: Phase A–E per `docs/PREVIEW_SUPABASE_CUTOVER.md`
- [ ] Render Blueprint / sidecar for NestJS on `:5001` (prod still Express-only)
- [ ] Prod strangler cutover for attendance (Vite proxy is dev-only today)
- [ ] Mail tracking parity on Nest when Redis up (email engine locked on Express)

### Phase D infrastructure (`docs/IMPROVEMENT_ROADMAP.md`)

- [ ] Dedicated Render background worker service
- [ ] API versioning `/api/v1`
- [ ] Read/write split + materialized CRM stats
- [ ] S3 off-site backups + restore drill
- [ ] Feature flags service
- [ ] Offline mutation queue (PWA)

### Deferred (explicitly out of scope until product asks)

- True multi-tenant SaaS + Stripe billing
- TypeScript incremental migration
- i18n / localization
- Multi-region / HA
- AI lead scoring / follow-up drafts
- Real-time co-editing (notes, tasks)

---

## P3 — Enterprise PWA (`docs/enterprise-pwa/gap-ledger.md`)

- [ ] Fix SW lifecycle: remove `skipWaiting()` + `autoUpdate`; add user update prompt + BroadcastChannel
- [ ] Remove GET `/api/*` NetworkFirst cache when local-first ships
- [ ] Local-first pilot: SQLite WASM + OPFS + PowerSync (or equivalent)
- [ ] COOP/COEP headers for OPFS
- [ ] WebAuthn passkeys
- [ ] Global mutating idempotency (beyond webhooks)
- [ ] Offline / SW lifecycle E2E tests
- [ ] Reorganize client to `features/` layout (623 files in layer-based `pages/` today)

---

## P3 — Quality gates & testing

- [ ] **T5-1** E2E: CRM Leads load + lock 423 path
- [ ] **T5-2** E2E: Dashboard widgets load (or error banner)
- [ ] **T5-3** Add `eslint-plugin-jsx-a11y` to client
- [ ] **T5-4** Lighthouse CI on 1–2 authenticated routes (mock session)
- [ ] **T5-5** Raise server coverage on tenant + auth paths only
- [ ] **T5-6** `PageSkeleton` on all data pages
- [ ] Client ESLint debt burn-down (`docs/LINT_DEBT.md`) — 2000+ issues; not a CI gate yet
- [ ] Prettier + format on commit
- [ ] `no-console` ESLint rule on `server/` (except scripts)

---

## P4 — Maintainability & API hygiene

- [ ] **T4-1** Migrate `AssetsPage`, `ProjectCreate`, `ExlyDataContent` to React Query
- [ ] **T4-3** Standardize API response envelope `{ success, data, error }` (domain-by-domain)
- [ ] **T4-4** Zod validation on remaining routes (extend B14 pattern)
- [ ] **T4-5** Remove NestJS Vite proxy if NestJS abandoned — or keep if strangler continues
- [ ] **T4-6** Split mega-files when next bug touches them (Finance, Leads, Exly, AdminMailContent)
- [ ] **T4-7** Update `EMAIL_ENGINE_LOCKED.md` + cursor rule to match current file paths
- [ ] Consolidate `MailCampaign` → `Campaign` (avoid locked tracking files)
- [ ] Full OpenAPI coverage for all routes (stub exists; ~curated subset only)
- [ ] Archive dev-only scripts (`test-mailer.js`, etc.)
- [ ] Version sync across README / `AI_AGENT_PROJECT_CONTEXT.md` / `package.json`
- [ ] Monolithic component refactor pass (`weakness_report.md` — 22 files >15 functions)
- [ ] Architectural inversion cleanup (utils importing UI — 196+ instances noted)

---

## P4 — Integrations & features (backlog)

- [ ] Google/Outlook calendar sync
- [ ] Task dependencies + Gantt
- [ ] Workflow automation (Trigger.dev rules)
- [ ] Subscription calendar / iCal feed
- [ ] Lead lock WebSocket presence (replace 15m TTL stale locks — `weakness_report.md`)
- [ ] HolySheet queue batching / rate-limit on high-volume import

---

## Recently shipped (context — not TODO)

These landed in recent sessions; listed so this file stays aligned with chat/memory context:

| Date | What |
|------|------|
| 2026-06-27 | Attendance `MetricCard` compact layout fix |
| 2026-06-25 | Vercel Web Analytics on all frontends |
| 2026-06-25 | Multi-site deploy (`VITE_SITE_MODE`), cookie consent, OG previews, onboarding checklist |
| 2026-06-20 | Finance OCR limits, legacy script cleanup |
| 2026-06-18 | Platform settings admin UI, workspace goals, CRM digest settings, migration ETL prep |
| 2026-06-10 | Wave 4 UX: `QueryErrorBanner`, global 401, Followups lock, `NotFoundPage` |
| 2026-06-10 | Wave 3: 5 base roles + admin page permissions |
| 2026-06-10 | Data Hub Phase A layout simplification |

---

## How to update

1. Check off items in this file when done.
2. Mirror status in `docs/FULL_APP_REVIEW_BACKLOG.md` (T0–T5 IDs) or `docs/IMPROVEMENT_ROADMAP.md` (Phase A–F).
3. Append shipped work to `.specify/memory/changelog/recent-changes.md`.
4. For new features: add spec under `docs/superpowers/specs/` before large implementation.
