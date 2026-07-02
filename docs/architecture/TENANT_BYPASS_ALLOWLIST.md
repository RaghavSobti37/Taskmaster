# Tenant bypass allowlist

Runtime policy: `server/infrastructure/database/bypassTenantPolicy.js`  
Query helper: `setOptions(bypassOptions(reason))` or `{ bypassTenant: true }`.

## Route allowlist (public / pre-auth)

| File | Reason |
|------|--------|
| `routes/track.js` | Email open/click/bounce pixels — no session; see `EMAIL_ENGINE_LOCKED.md` |
| `routes/campaignRoutes.js` | Legacy campaign resolve by public id |
| `routes/campaignApiRouter.js` | Campaign API public lookups |
| `routes/calendarRoutes.js` | Shared calendar feed edge case |

## Service allowlist (admin / cross-inlet)

| File | Reason |
|------|--------|
| `services/DataHubService.js` | Person hub admin aggregates |
| `domains/artists/services/artistPathHubService.js` | Artist path hub rebuild |
| `domains/artists/services/artistEnquiryService.js` | Public enquiry webhook |
| `services/newsletterAudienceService.js` | Newsletter audience cross-contact |
| `services/ContactService.js` | Person identity merge |
| `services/PersonHubBuilder.js` | Hub view rebuild by personId |
| `services/PersonIdentityService.js` | Identity resolution |
| `services/UnifiedSearchService.js` | Global search index |
| `services/subscriptionReminderService.js` | Cron reminders by user id |
| `domains/crm/services/leadWriteService.js` | Controlled delete/import paths |
| `domains/crm/services/leadDuplicateService.js` | Dedup across legacy rows |
| `domains/mail/campaignFacade.js` | Campaign orchestration |
| `domains/data-hub/folderCache.js` | Admin folder cache warm |

## Controller / middleware allowlist

| File | Reason |
|------|--------|
| `domains/auth/controllers/authController.js` | Login before tenant ALS exists |
| `domains/auth/controllers/userController.js` | Password change / self lookup |
| `middleware/authMiddleware.js` | Session hydrate on boot |
| `controllers/financeController.js` | Finance admin rollup (legacy rows) |
| `domains/mail/controllers/campaignApiController.js` | Campaign delete cascade |
| `domains/dashboard/controllers/dashboardController.js` | Public calendar events in summary |

## Util allowlist

| File | Reason |
|------|--------|
| `utils/refreshAttendanceMetrics.js` | Cron attendance refresh |
| `utils/authUserLookup.js` | Pre-tenant auth lookup |
| `utils/ensureDevAdminUser.js` | Dev seed only |
| `utils/primaryCallAssignee.js` | Rep routing bootstrap |
| `utils/platformOwner.js` | Platform owner break-glass |
| `utils/campaignRegisteredLocation.js` | Geo backfill job |
| `utils/artistEnquiryProjectResolver.js` | Webhook project resolve |

## Scripts & QA (not runtime)

All `server/scripts/**` and `server/services/qa/**` may use `bypassTenant` for maintenance, seed, and audit. Not audited as production route handlers.

## Not allowlisted — migrate to tenant scope

- Raw `Model.aggregate()` without `aggregateWithTenant` in domain services (grep `\.aggregate\(`).
- New `bypassTenant` in `server/routes/**` outside route allowlist → QA suite 3 fails.
- Preference models: queries now auto-scope via `tenantPlugin`; compound `{ tenantId, userId }` unique indexes deferred.

## Deferred

- Per-tenant `CRMStatSnapshot` rows (`tenantId` on snapshot model).
- Data Hub inlet processor aggregates (admin-only; use explicit bypass + reason when touched).
- `mailRollupStore.js` / `campaignApiController` list pipelines.
- Compound unique indexes `{ tenantId, email }` backfill on legacy collections.
