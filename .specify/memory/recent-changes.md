# Recent changes

_Last updated: Jun 2026 session — push-and-document_

## Profile settings save

- **Settings → Profile:** Removed success/error modals after save; failures show inline under the password section.
- **Session sync:** `applySessionUser` in `AuthContext` merges `PUT /api/users/profile` response into client user state so the unsaved-changes bar clears immediately.
- **`userSessionChanged`:** Now compares name, avatar, phone, dateOfBirth, and teams — fixes stale profile after refresh.
- **API:** `updateProfile` returns `attachProfileCompletion` payload (same shape as `/api/auth/me`).

## Email templates & WYSIWYG (Option C)

- Shared block spacing rules in `shared/emailBlockSpacing.cjs` — applied in preview/send HTML builders and Quill visual email pipeline.
- Mail Template Studio + indent normalization in outbound HTML utilities.

## Campaign analytics & geo

- Campaign detail: **Recent Activity** stream removed; **Engagement by city** chart reads `locationBreakdown` with fixed bar chart wiring.
- Click tracking: scanner/datacenter filtering and `lookupGeoForClick` in `server/utils/geoLookup.js` (pixel/base URL logic unchanged — locked).
- `server/utils/campaignLocationGeo.js` centralizes breakdown recompute for API GET and maintenance scripts.
- **Repair script:** `node server/scripts/rebuildCampaignLocationBreakdown.js <campaignIdOrMongoId> [--dry-run]` — rebuilds `locationBreakdown` / `timeSeries` and fixes stored click cities when needed.

## Hygiene

- Dead-code audit: `mailEventLocation` helper still referenced from campaign city labels.
- Agentation dev stub remains local-only; production bundle excludes annotate tooling.
