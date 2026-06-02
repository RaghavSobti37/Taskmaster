# Architecture debt register

Intentional legacy and known limits. Removal requires product sign-off.

## Dual mail APIs

- `/api/mail` — legacy mail system
- `/api/campaigns` — primary campaigns

Both remain active; consolidation not scheduled.

## Legacy RBAC

`Role` and `Permission` models coexist with department `permissionPreset` / `pagePermissions`. New features should use department presets only.

## Request body size

`server/server.js` allows **50MB** JSON bodies for campaign HTML and attachments. Vercel's `/api` proxy limit (~4.5MB) still applies — production campaign creation must hit Render API directly (`VITE_API_URL`).

## Performance logging

Request timing logs write to `server/performance.log` only when `PERF_LOG_ENABLED=true`. File rotates at 5MB.

## Dashboard widget id `schedule`

Stored presets use `componentId: 'schedule'` for **today's calendar events**, not the team Schedule page (`/schedule`). UI label: "Today's Calendar".

## Shared schedule logic

Task span/overlap for the schedule grid: `shared/scheduleTaskDates.js`. Server assembly: `server/services/scheduleService.js`. Client lanes: `client/src/utils/scheduleLayout.js`.
