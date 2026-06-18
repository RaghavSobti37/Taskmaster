# Recent changes

Session deltas appended by `/git-push` and agent ship workflows. Newest first.

---

## 2026-06-18 — Workspace goals, CRM digest settings, migration ETL

- **What:** Workspace-level goals API/UI; per-project CRM digest settings (monthly target, plan values) on TSC projects; expanded Mongo→Postgres ETL + `validate-counts`; NestJS staging service in `render.yaml`; lead follow-up datetime + notification dispatcher fixes; migration readiness scripts (`migrationReadiness`, `productionReadiness`, `verifyLocalMigration`).
- **Why:** Ops leads configure digest targets in-app instead of env-only; Postgres cutover prep; strangler Nest deploy on Render staging.
- **Files:** `server/domains/projects/*workspaceGoals*`, `server/services/crmDigestSettingsService.js`, `client/src/components/project/ProjectCrmDigestSettings.jsx`, `nestjs-server/scripts/etl/mongo-to-postgres.ts`, `render.yaml`, `scripts/migrationReadiness.js`
- **Branch:** `main` · **Commit:** `20f1e743`

---

## 2026-06-18 ? CRM lead filters for all users

- **What:** Interest / Meaningful Connect / Source / Quality / Agent filters always visible on Leads; sales team browses shared pipeline; delete still scoped per rep.
- **Why:** Artist-management users only saw artist-specific filters; sales reps had `restrictToOwn` blocking Agent and team-wide filters.
- **Files:** `client/src/pages/crm/LeadsPage.jsx`, `client/src/utils/crmScope.js`, `server/utils/crmScope.js`
- **Branch:** `main` ? **Commit:** `4ca03e83`

---
