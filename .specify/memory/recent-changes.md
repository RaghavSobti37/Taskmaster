# Recent changes (Jun 2026 session)

_Last updated: 2026-06-09_

## Artist CRM pipeline (new)

- **Scope:** `crmType: artist` leads separate from sales CRM; artist-management reps (Akash) on artist leads.
- **Import:** 6 CSV templates via `artistCrmImportService` + `ArtistCrmImportPanel`; partial unique email index (`fixLeadEmailIndex.js`); phone-only rows supported via synthetic phone fallback.
- **Booking enquiries:** TSC website `/query` webhook → `artistEnquiryService` upserts `contactCategory: booking_enquiry` lead + task; default assignee Akash (`primaryCallAssignee.js`).
- **UI:** `CrmHub` artist tabs; `ArtistBookingEnquiriesPage`; `ArtistBookingEnquiryPanel` in `LeadsPage` / `FollowupsPage` modals; warm-leads stat aligned with meaningful-connect filter.
- **Scripts:** `seedArtistCrmFromData.js`, `reassignBookedCallsToAkash.js`, `testArtistBookingWebhook.js`, `backfillLeadCrmType.js`.
- **Tests:** `artistCrmImport.test.js`, `crmPipelineFilters.test.js`, `crmScope.test.js`.

## Email hub migration

- Removed legacy mail monolith (`AdminMailContent`, `MailCampaignWizard`, `useMailCampaignWizard`, `AdminMail`, `EmailsPage`).
- Added `/emails/*` hub: overview, campaigns list, templates, profiles, analytics.
- Campaign wizard rebuilt as `CampaignWizardShell` with Zod schema + step components.

## Project goals

- Backend: `ProjectGoal`, `ProjectGoalSnapshot`, `ProjectKRA` models + services.
- Frontend: goals panel/strip/metric cards on project detail.

## Hygiene

- Added `npm run audit:deadcode` orphan scan.
- Initialized `.specify/memory` for agent context.
