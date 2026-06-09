# Recent changes (Jun 2026 session)

_Last updated: 2026-06-09_

## Email hub migration

- Removed legacy mail monolith (`AdminMailContent`, `MailCampaignWizard`, `useMailCampaignWizard`, `AdminMail`, `EmailsPage`).
- Added `/emails/*` hub: overview, campaigns list, templates, profiles, analytics.
- Campaign wizard rebuilt as `CampaignWizardShell` with Zod schema + step components.
- HolySheet audience fetch moved to `useCampaignAudience.js`.

## Project goals

- Backend: `ProjectGoal`, `ProjectGoalSnapshot`, `ProjectKRA` models + services.
- Frontend: goals panel/strip/metric cards on project detail.

## Tasks & gamification

- `CompletedTaskRollbackButton`, server-side completed-task limit.
- Leaderboard: `LeaderboardLastWeekRank`, podium/row polish.
- Task review + daily log fixes.

## Hygiene

- Deleted orphan utils: `mailCampaignWizardSnapshot.js`, `loadingPhraseSession.js`, `client/emailContentUtils.js`, `purgeAuthCookies.js`.
- Added `npm run audit:deadcode` orphan scan.
- Initialized `.specify/memory` for agent context.
- Removed stale `.context/memory_graph.md` (superseded by `.specify`).

## PWA

- New icons `icon-44.png`, `icon-96.png`; manifest/catalog updates.

## Scripts (maintenance, not app runtime)

- `backfillArtistPathTenant.js`, `repairArtistPathImport.js`, `fixStringObjectIds.js`, etc.
