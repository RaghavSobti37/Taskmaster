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
