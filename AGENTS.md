# CoreKnot (Taskmaster) — Agent Instructions

All agents working in this monorepo **must** follow the platform governance stack.

## Mandatory stack

1. **Agent governance** — `../../.cursor/rules/agent-governance.mdc` (verify-gated memory)
2. **Agent OS** — `.cursor/rules/agent-os.mdc` (completion loop)
3. **Agent menu** — pick agency agent from `../../.cursor/agency-agents/roster.json` before each slice
4. **Session boot** — `.cursor/skills/coreknot-session-boot/SKILL.md` at task start

## Package root

This directory (`coreknot/Taskmaster/`) is the npm workspace root.

## Verify before memory / done claims

```bash
npm test --prefix client
npm test --prefix server
npm run build --prefix client
```

Update ledgers **only** after exit 0:

```bash
node ../../.cursor/scripts/agent-memory-gate.mjs verify-and-patch \
  --ledger .cursor/loop-engineering/<slug>-ledger.json \
  --patch '{"satisfaction":"pass","phase":"complete"}' \
  -- "npm test --prefix client && npm test --prefix server"
```

## Recent mobile work (Jun 2026)

Commits `d5cc0595`, `162926d5` — mobile dashboard, schedule, attendance UX, Browse-all nav.

Key paths:

| Area | Files |
|------|--------|
| Mobile route policy | `client/src/utils/mobilePageSupport.js`, `MobileRouteGuard.jsx` |
| Dashboard mobile | `DashboardTierLayout.jsx`, hub cards |
| Schedule mobile | `ScheduleMobileList.jsx`, `SchedulePage.jsx` |
| Attendance mobile | `AttendancePage.jsx`, `SelfMonthlyAttendanceCalendar.jsx` |

## Locked zones

Do not edit without explicit unlock: email engine, logo mark, production hosts — see `.cursor/rules/*-locked.mdc`.

## Deploy

Render: `render.yaml`, branch `main` / `staging`. See `../../.cursor/rules/render-auto-deploy.mdc`.
