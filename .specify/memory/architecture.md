# Architecture

## Local runtime

```
Browser → Vite (:5173) → proxy /api → Express (:5000) → MongoDB / Redis
```

- `DEBUG_BYPASS=true` + `Authorization: Bearer bypass_token` for local API tests.
- Production: Vercel serves `client/dist`; `/api` and `/socket.io` rewrite to Render API.

## Backend patterns

- Zod validation on route bodies/queries (campaigns, projects, mail, attendance, etc.).
- `.lean()` reads; aggregation over repeated `countDocuments`.
- Task review pipeline with activity timeline + gamification XP.
- Person spine: `Person`, `PersonIdentifier`, `PersonHubView` — domain facts in `Lead`, `ArtistPathResponse`, `ExlyBooking`, etc.
- **Artist CRM:** `Lead.crmType` + `contactCategory`; import upserts by `metadata.importRowKey`; partial unique index on non-empty email.

## Artist CRM data flow

```
CSV upload / webhook → artistCrmImportService | artistEnquiryService
  → Lead (crmType: artist) → ContactService / Data Hub inlets
  → CrmHub UI + booking panel in lead modal
```

Default booked-call assignee: `PRIMARY_CALL_ASSIGNEE` env → Akash (artist-management).

## Frontend patterns

- Lazy routes with chunk-retry in `App.jsx`.
- `react-query` for server state; optimistic updates where safe.
- 4px grid, high-density tables, row-first actions.
- Unsaved-changes guard via `useUnsavedChanges` on notes, mail studio, campaign wizard.

## Email hub (Jun 2026 refactor)

Legacy monolith removed: `AdminMailContent`, `MailCampaignWizard`, `EmailsPage`, `AdminMail`.

New surface:

| Route | Component |
| --- | --- |
| `/emails` | `EmailHubLayout` → overview, campaigns, templates, profiles, analytics |
| `/emails/campaigns/new` | `CreateCampaignPage` → `CampaignWizardShell` (4 steps) |
| `/campaigns/:id` | `CampaignDetails` (tracking locked) |

Wizard: `client/src/components/emails/wizard/*` + `campaignWizardSchema.js`.
