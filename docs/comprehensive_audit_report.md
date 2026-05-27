# Comprehensive API & Page Performance Report

This report is generated via static analysis of controllers and routes. Live speed data is estimated based on code patterns.

## Route Group: /api/analyticsRoutes

### GET /api/analyticsRoutes/cumulative
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/analyticsRoutes/location-leads
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/analyticsRoutes/geo-campaign
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/artistRoutes

### GET /api/artistRoutes/webhook/meta
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/artistRoutes/webhook/meta
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/artistRoutes/:id/auth/spotify
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/artistRoutes/auth/callback/spotify
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/artistRoutes/:id/auth/youtube
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/artistRoutes/auth/callback/youtube
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/artistRoutes/:id/auth/meta/callback
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/artistRoutes/:id/analytics/:platform
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/artistRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/artistRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/artistRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/artistRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### POST /api/artistRoutes/:id/inject-event
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/artistRoutes/:id/sync-stats
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/artistRoutes/:id/tracked-video
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/artistRoutes/:id/webhooks/subscribe
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/artistRoutes/:id
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

## Route Group: /api/artistV2Routes

### GET /api/artistV2Routes/:id/stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/artistV2Routes/shared/:sharedTokenId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

## Route Group: /api/assetRoutes

### GET /api/assetRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/assetRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/assetRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/assetRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/authRoutes

### POST /api/authRoutes/register
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/authRoutes/login
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/authRoutes/google-login
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/authRoutes/google
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/authRoutes/google/callback
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/authRoutes/me
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/calendarRoutes

### GET /api/calendarRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/calendarRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/calendarRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/calendarRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/campaignRoutes

### GET /api/campaignRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/campaignRoutes/:id
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### POST /api/campaignRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/campaignRoutes/:id/dispatch
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/campaignRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/chatRoutes

### GET /api/chatRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/chatRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/contactRoutes

### GET /api/contactRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/contactRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/contactRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/contactRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/crmRoutes

### POST /api/crmRoutes/leads/upload
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/crmRoutes/export
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/rep-summary
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/config
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/imports
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/purge-logs
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### DELETE /api/crmRoutes/imports/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### POST /api/crmRoutes/reset
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/crmRoutes/debug/columns
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/crmRoutes/debug/save-mapping
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/crmRoutes/sync-bookings
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/crmRoutes/sync-unsubscribed
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/crmRoutes/leads/cleanup-test-data
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/crmRoutes/followups
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/crmRoutes/leads/audit-logs
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### DELETE /api/crmRoutes/leads/audit-logs/purge
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### POST /api/crmRoutes/leads/:id/notes
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/dashboardRoutes

### GET /api/dashboardRoutes/summary
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/exlyRoutes

### POST /api/exlyRoutes/webhook
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/exlyRoutes/dashboard-stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/exlyRoutes/unlinked-bookings
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/exlyRoutes/unlinked-bookings/link
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/exlyRoutes/offerings
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/exlyRoutes/offerings/:offeringId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/exlyRoutes/offerings/:offeringId/analytics
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### PUT /api/exlyRoutes/offerings/:offeringId
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/exlyRoutes/config
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/exlyRoutes/sync
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/financeRoutes

### POST /api/financeRoutes/upload
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/financeRoutes/bulk
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/financeRoutes/stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/gamificationRoutes

### GET /api/gamificationRoutes/missions
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/gamificationRoutes/progress
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/googleAccounts

### GET /api/googleAccounts/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/googleAccounts/simulate
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/googleAccounts/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/googleRoutes

### GET /api/googleRoutes/holidays
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/googleRoutes/link
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/googleRoutes/calendar/events
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/googleRoutes/calendar/events
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/googleRoutes/drive/files
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/logRoutes

### GET /api/logRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/logRoutes/bug-report
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/logRoutes/run-qa
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/logRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/logRoutes/clear
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### PUT /api/logRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/logRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/logRoutes/activity-grid
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/mailRoutes

### GET /api/mailRoutes/templates
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/mailRoutes/templates
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/mailRoutes/templates/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/mailRoutes/profiles
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/mailRoutes/profiles
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/mailRoutes/profiles/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### PUT /api/mailRoutes/profiles/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/mailRoutes/campaigns
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/mailRoutes/campaigns
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/mailRoutes/campaigns/:id/send
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/mailRoutes/campaigns/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/mailRoutes/stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/mailRoutes/scan-bounces
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/mailRoutes/track/:campaignId/:recipientId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/mailRoutes/click/:campaignId/:recipientId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/mailRoutes/unsubscribe/:campaignId/:recipientId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/mailRoutes/templates
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/mailRoutes/templates
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/mailRoutes/templates/:name
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/mailRoutes/holysheet/all
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

## Route Group: /api/notificationRoutes

### GET /api/notificationRoutes/status-counts
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/notificationRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### PATCH /api/notificationRoutes/:id/read
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### PATCH /api/notificationRoutes/read-all
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/officeAssetRoutes

### GET /api/officeAssetRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/officeAssetRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/officeAssetRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/officeAssetRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/projectRoutes

### POST /api/projectRoutes/:id/members
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### PUT /api/projectRoutes/:id/remove-member
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### POST /api/projectRoutes/:id/link-calendar
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/projectRoutes/:id/calendar-events
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

## Route Group: /api/proxyRoutes

## Route Group: /api/sesRoutes

### POST /api/sesRoutes/webhook
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/taskRoutes

### POST /api/taskRoutes/bug
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/teamRoutes

### GET /api/teamRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/teamRoutes/
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/teamRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/track

### GET /api/track/open/:pixelId.gif
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### GET /api/track/click/:clickId
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Ensure ID indexes exist. Watch for N+1 populates.

### POST /api/track/webhooks/resend
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/track/unsubscribe
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Route Group: /api/tscRoutes

### GET /api/tscRoutes/
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/tscRoutes/stats
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/tscRoutes/upload
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/tscRoutes/import
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/tscRoutes/bulk-delete
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### DELETE /api/tscRoutes/import/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/userRoutes

### GET /api/userRoutes/team
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### GET /api/userRoutes/sales-reps
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### PUT /api/userRoutes/profile
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### GET /api/userRoutes/directory
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### PUT /api/userRoutes/:id/role
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### PUT /api/userRoutes/:id/teams
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### PUT /api/userRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

### DELETE /api/userRoutes/:id
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Potential cache invalidation overhead. Needs optimistic UI updates.

## Route Group: /api/webhookRoutes

### POST /api/webhookRoutes/book-call
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### GET /api/webhookRoutes/instagram
- **Speeds**: Estimated 50-150ms
- **Bottlenecks**: Risk of unbounded array return. Implement pagination / limit().

### POST /api/webhookRoutes/instagram
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

### POST /api/webhookRoutes/resend
- **Speeds**: Estimated 100-300ms
- **Bottlenecks**: Database write lock during insert. Ensure input validation is strict before hitting DB.

## Changelog
- **2026-05-28**:
  - Fixed Redis `ECONNREFUSED` log spam by attaching `error` event listeners to cloned BullMQ `Queue` and `Worker` instances in `importWorker.js`, `webhookWorker.js`, and `webhookController.js`.
  - Migrated legacy `assignees` arrays on `tasks` documents to the new `TaskAssignments` collection for `taskmaster_local` and `taskmaster_production` databases to fix tasks not displaying on the dashboard.
  - Re-mapped `.env` DB connections to explicitly point to renamed clone databases `taskmaster_local` and `taskmaster_production`, and purged all unused temporary DBs.

