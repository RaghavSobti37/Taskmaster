# Documentation index

Read **one** primary doc for your task; avoid conflicting older guides.

## Start here

| Priority | Document | Audience |
|----------|----------|----------|
| 1 | [`ENVIRONMENT_MATRIX.md`](./ENVIRONMENT_MATRIX.md) | Hosts, DBs, `VITE_API_URL`, webhooks |
| 2 | [`AI_AGENT_PROJECT_CONTEXT.md`](./AI_AGENT_PROJECT_CONTEXT.md) | Complete architecture (agents + senior devs) |
| 3 | [`STARTUP_GUIDE.md`](./STARTUP_GUIDE.md) | Local install & run |

## By topic

| Topic | Document |
|-------|----------|
| Architecture debt (intentional) | [`ARCHITECTURE_DEBT.md`](./ARCHITECTURE_DEBT.md) |
| Legacy APIs — do not extend | [`LEGACY_FREEZE.md`](./LEGACY_FREEZE.md) |
| Email tracking (locked) | [`EMAIL_ENGINE_LOCKED.md`](./EMAIL_ENGINE_LOCKED.md) |
| Logo / spinner (locked) | [`LOGO_LOCKED.md`](./LOGO_LOCKED.md) |
| Local vs prod Mongo | [`LOCAL_DEV_DATABASE.md`](./LOCAL_DEV_DATABASE.md) |
| Production deploy / migration | [`PRODUCTION_MIGRATION.md`](./PRODUCTION_MIGRATION.md) |
| Backups | [`DATA_BACKUP.md`](./DATA_BACKUP.md) |
| Maintenance scripts | [`SCRIPTS_RUNBOOK.md`](./SCRIPTS_RUNBOOK.md) |
| UI components | [`COMPONENT_STANDARDS.md`](./COMPONENT_STANDARDS.md), `client/design_guidelines.md` |
| Security | [`SECURITY.md`](./SECURITY.md), [`TENANT_SECURITY_PHASE.md`](./TENANT_SECURITY_PHASE.md) |
| Git history PII redaction | [`GIT_HISTORY_REDACTION.md`](./GIT_HISTORY_REDACTION.md) |
| Deploy env (no secrets in repo) | [`DEPLOY_ENV.md`](./DEPLOY_ENV.md) |
| Scripts safety tiers | [`SCRIPTS_RUNBOOK.md`](./SCRIPTS_RUNBOOK.md) |
| Transactions | [`transaction_architecture.md`](./transaction_architecture.md) |
| Changelog | [`VERSION_HISTORY.md`](./VERSION_HISTORY.md) (historical; URLs may be outdated) |
| Open risks | [`weakness_report.md`](./weakness_report.md) |
| ESLint backlog | [`LINT_DEBT.md`](./LINT_DEBT.md) |
| Contributing | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |

## Superseded / snapshot only

| Document | Status |
|----------|--------|
| [`../IMPLEMENTATION_GUIDE.md`](../IMPLEMENTATION_GUIDE.md) | Jun 2026 deployment snapshot — use matrix + agent context for current truth |
| [`comprehensive_audit_report.md`](./comprehensive_audit_report.md) | Static route audit — spot-check before acting |
| [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md) | Synthesized notes — prefer agent context for API details |

## Naming

- **Product / UI:** CoreKnot  
- **Repo folder / GitHub:** Taskmaster / CoreKnot  
- **Code legacy:** `useTaskmasterQueries`, `TASKMASTER_WEBHOOK_URL` — unchanged until a dedicated rename pass
