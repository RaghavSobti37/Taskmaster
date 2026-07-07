# CoreKnot documentation index

> **Start here.** Docs are organized by role. Canonical page-level reference: [`reference/COREKNOT_MASTER.md`](./reference/COREKNOT_MASTER.md).

---

## Priority reading

| # | Document | Audience |
| --- | --- | --- |
| 1 | [`reference/COREKNOT_MASTER.md`](./reference/COREKNOT_MASTER.md) | **Every page, API, hook, permission** — core product bible |
| 2 | [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) | Agent memory hub |
| 3 | [`operations/local-development.md`](./operations/local-development.md) | Local install & run |
| 4 | [`operations/environments.md`](./operations/environments.md) | Hosts, DBs, webhooks |
| 5 | [`design/DESIGN-REFERENCE.md`](./design/DESIGN-REFERENCE.md) | UI checklist (mandatory for client changes) |

---

## Folder layout

```
docs/
├── reference/          # Master doc, locked specs, standards, changelog
├── operations/         # Deploy, env, scripts, monitoring, PWA
├── architecture/       # System design, security, data, debt
├── features/           # Domain deep-dives (Artist OS, Data Hub, integrations)
├── auth/               # OAuth, Clerk, verification
├── design/             # Visual / component design
├── archive/            # Superseded snapshots — do not treat as current truth
├── superpowers/        # Agent specs & plans (dated)
└── .generated/         # Machine output (page-inventory.json) — regenerate, don't edit
```

Regenerate master page catalog:

```bash
node scripts/generate-page-inventory.mjs
node scripts/generate-master-doc.mjs
```

---

## By topic

### Reference & standards

| Topic | Document |
| --- | --- |
| **Master (all pages)** | [`reference/COREKNOT_MASTER.md`](./reference/COREKNOT_MASTER.md) |
| UI components | [`reference/COMPONENT_STANDARDS.md`](./reference/COMPONENT_STANDARDS.md), `client/design_guidelines.md` |
| Email tracking (locked) | [`reference/EMAIL_ENGINE_LOCKED.md`](./reference/EMAIL_ENGINE_LOCKED.md) |
| Logo / spinner (locked) | [`reference/LOGO_LOCKED.md`](./reference/LOGO_LOCKED.md) |
| Version history | [`reference/VERSION_HISTORY.md`](./reference/VERSION_HISTORY.md) |

### Operations

| Topic | Document |
| --- | --- |
| Local dev | [`operations/local-development.md`](./operations/local-development.md) |
| Local Mongo | [`operations/LOCAL_DEV_DATABASE.md`](./operations/LOCAL_DEV_DATABASE.md) — includes **`npm run sync:prod-tenant-tsc`** |
| Data topology | [`operations/DATA_ENV_TOPOLOGY.md`](./operations/DATA_ENV_TOPOLOGY.md) |
| Deploy env | [`operations/deployment.md`](./operations/deployment.md) |
| Environment matrix | [`operations/environments.md`](./operations/environments.md) |
| Production readiness audit | [`operations/PRODUCTION_READINESS_AUDIT_2026-07-08.md`](./operations/PRODUCTION_READINESS_AUDIT_2026-07-08.md) |
| Staging | [`operations/STAGING_SETUP.md`](./operations/STAGING_SETUP.md) |
| Rollback | [`operations/DEPLOY_ROLLBACK.md`](./operations/DEPLOY_ROLLBACK.md) |
| Scripts | [`operations/SCRIPTS_RUNBOOK.md`](./operations/SCRIPTS_RUNBOOK.md) |
| Local demo integrations seed | [`operations/LOCAL_DEV_DEMO_DATA.md`](./operations/LOCAL_DEV_DEMO_DATA.md) |
| Knowledge Engine removal | [`operations/KNOWLEDGE_ENGINE_REMOVAL.md`](./operations/KNOWLEDGE_ENGINE_REMOVAL.md) |
| Production migration | [`operations/PRODUCTION_MIGRATION.md`](./operations/PRODUCTION_MIGRATION.md) |
| Backups | [`operations/DATA_BACKUP.md`](./operations/DATA_BACKUP.md) |
| Cloudflare DNS | [`operations/CLOUDFLARE_DNS.md`](./operations/CLOUDFLARE_DNS.md) |
| PWA checklist | [`operations/enterprise-pwa/production-checklist.md`](./operations/enterprise-pwa/production-checklist.md) |

### Architecture & security

| Topic | Document |
| --- | --- |
| Security | [`architecture/SECURITY.md`](./architecture/SECURITY.md) |
| Tenant security | [`architecture/TENANT_SECURITY_PHASE.md`](./architecture/TENANT_SECURITY_PHASE.md) |
| Data Master | [`architecture/DATA_MASTER_ARCHITECTURE.md`](./architecture/DATA_MASTER_ARCHITECTURE.md) |
| Transactions | [`architecture/transaction_architecture.md`](./architecture/transaction_architecture.md) |
| Architecture debt | [`architecture/ARCHITECTURE_DEBT.md`](./architecture/ARCHITECTURE_DEBT.md) |
| Legacy freeze | [`architecture/LEGACY_FREEZE.md`](./architecture/LEGACY_FREEZE.md) |
| NestJS migration | [`architecture/BACKEND_MIGRATION_PLAYBOOK.md`](./architecture/BACKEND_MIGRATION_PLAYBOOK.md) |

### Features

| Topic | Document |
| --- | --- |
| **Connected Apps & intake (master)** | [`features/CONNECTED_APPS_AND_INTAKE.md`](./features/CONNECTED_APPS_AND_INTAKE.md) |
| Integration Hub | [`features/INTEGRATION_HUB.md`](./features/INTEGRATION_HUB.md) |
| Website Forms | [`features/WEBSITE_FORMS.md`](./features/WEBSITE_FORMS.md) |
| AiSensy (WhatsApp) | [`features/AISENSY.md`](./features/AISENSY.md) |
| Artist OS | [`features/artist-os.md`](./features/artist-os.md) |
| Data Hub vision | [`features/DATA_HUB_PRODUCT_VISION.md`](./features/DATA_HUB_PRODUCT_VISION.md) |
| Integration catalog | [`features/INTEGRATION_DATA_CATALOG.md`](./features/INTEGRATION_DATA_CATALOG.md) |
| Booked calls webhook | [`features/BOOKED_CALLS_CRM_DIRECT.md`](./features/BOOKED_CALLS_CRM_DIRECT.md) |
| Artist enquiry forward | [`features/ARTIST_ENQUIRY_WEBSITE_FORWARD.md`](./features/ARTIST_ENQUIRY_WEBSITE_FORWARD.md) |

### Auth

| Topic | Document |
| --- | --- |
| Google + Meta OAuth | [`auth/google-oauth.md`](./auth/google-oauth.md) |

---

## Superseded (archive only)

| Document | Replacement |
| --- | --- |
| `AI_AGENT_PROJECT_CONTEXT.md` | [`reference/COREKNOT_MASTER.md`](./reference/COREKNOT_MASTER.md) |
| `PROJECT_MEMORY.md` | [`.specify/memory/INDEX.md`](../.specify/memory/INDEX.md) |
| `ARTIST_OS_*.md` (split) | [`features/artist-os.md`](./features/artist-os.md) |
| `comprehensive_audit_report.md` | Spot-check routes in `COREKNOT_MASTER` |
| `weakness_report.md`, `IMPROVEMENT_ROADMAP.md` | Historical risk lists |

---

## Naming

- **Product / UI:** CoreKnot
- **Repo folder:** `coreknot/Taskmaster`
- **Code legacy:** `useTaskmasterQueries`, `TASKMASTER_WEBHOOK_URL` — unchanged until dedicated rename
