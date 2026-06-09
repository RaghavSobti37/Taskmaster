# Feature map

## Navigation highlights

| Area | Routes | Notes |
| --- | --- | --- |
| Dashboard | `/` | Missions, leaderboard, announcements, projects today |
| Projects | `/projects`, `/projects/:id` | Goals/KRA strip, team, status ping |
| Tasks / Todo | `/todo` | Review actions, completed rollback, activity timeline |
| CRM (sales) | `/crm/leads`, followups | Person-linked leads, sales reps |
| **Artist CRM** | `/crm` hub (artist tabs) | Leads, bookings, CSV import; artist-management assignees |
| Email hub | `/emails/*` | Replaces `/workspace/emails` (redirect) |
| Data Hub | `/admin/data-hub` | Person detail, analytics; `artist_crm` + `booked_calls` inlets |
| Artist Path | `/admin/artist-path` | HolySheet sync, profile slider |
| Attendance | Settings → Attendance | Work mode toggle, unified time card |
| Gamification | Leaderboard on dashboard | Last-week rank badge, XP gap |

## Artist CRM (Jun 2026)

| Piece | Location |
| --- | --- |
| Taxonomy | `shared/artistCrmTaxonomy.js`, `shared/artistCrmSheetMappings.js` |
| Import service | `server/services/artistCrmImportService.js` |
| Field parser | `server/utils/artistContactFieldParser.js` |
| API | `server/controllers/artistCrmController.js`, `/api/crm/artist-import` |
| Booking webhook | `artistEnquiryService.js` → `POST /api/webhooks/artist-enquiry` |
| UI import | `ArtistCrmImportPanel.jsx` |
| UI bookings | `ArtistBookingEnquiriesPage.jsx`, `ArtistBookingEnquiryPanel.jsx` |
| Scope helpers | `client/utils/crmScope.js`, `server/utils/crmScope.js` |
| Pipeline filters | `server/utils/crmPipelineFilters.js` (warm stat) |

**Booking enquiry fields in modal:** artist, company, collaboration, nature, when/where, scale, logistics, vision, linked task.

## Project goals

- Models: `ProjectGoal`, `ProjectGoalSnapshot`, `ProjectKRA`
- API: `projectGoalsController`, `projectKraController`, `projectGoalsService`
- UI: `ProjectGoalsPanel`, `ProjectGoalsStrip`, `ProjectGoalMetricCards`

## Mail / Resend

- From-address picker: `resendFromEmails.js` (client + server)
- Wizard: `CampaignWizardShell` + artist CRM audience filter in `useCampaignAudience.js`
