---
name: failure-modes-map
description: >-
  Generates and refreshes a comprehensive "what can break" map for CoreKnot
  across infra, auth, features, and integrations. Use when user asks what
  can fail, failure aspects, weakness audit, or before large fix sweeps.
---

# Failure Modes Map (CoreKnot)

## Layers to cover

1. **Infra** — Mongo, Redis/BullMQ, Render cold start, wrong hosts, missing env
2. **Auth/RBAC** — JWT, role gates, tenant context
3. **Data** — mock data, stale React Query cache, import worker bugs
4. **Features** — per module from `AI_AGENT_PROJECT_CONTEXT.md` §12
5. **Integrations** — Resend, UploadThing, OAuth, HolySheet, Exly webhooks
6. **Ops** — cron not provisioned, Sentry/Datadog unset, keep-warm

## Workflow

```
1. Read docs/weakness_report.md, FULL_APP_REVIEW_BACKLOG.md if present
2. Grep: TODO, stub, bypassTenant, memory fallback, QueryErrorBanner gaps
3. Check systemHealthProbeService, backgroundQueue memory mode
4. Produce table: Failure | What breaks | Severity | Code pointer
5. If user says fix: hand off to parallel-fix-sweep or confidence-audit
```

## Severity

- **P0** — whole app or auth down
- **P1** — feature completely broken
- **P2** — degraded UX / wrong data
- **P3** — edge case / stub

## Keep fresh

After major fixes, append deltas to `.specify/memory/changelog/recent-changes.md` (no secrets).
