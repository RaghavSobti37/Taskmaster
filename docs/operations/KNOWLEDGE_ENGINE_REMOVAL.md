# Knowledge Engine — Removal from CoreKnot

> **Status:** Removed from active CoreKnot codebase as of **2026-07-07**.  
> **Archive:** [`legacy/tsc-knowledge-engine/`](../../../../legacy/tsc-knowledge-engine/)

---

## 1. What was removed

The **TSC Knowledge Engine** was an admin SEO/content pipeline (keywords, articles, publish gates, public `/content/posts` API). It was never fully wired in production CoreKnot before removal.

### Deleted from `coreknot/Taskmaster`

| Area | Removed |
|------|---------|
| Server domain | `server/domains/knowledge-engine/**` |
| Controllers / routes | `knowledgeEngineController.js`, `knowledgeEngineRoutes.js`, `/api/knowledge-engine` mount |
| Workers / cron | `knowledgeEngineWorker.js`, `knowledgeEngineScheduler.js`, registry entries |
| Bridge | `integrations-hub/services/knowledgeEngineBridge.js` |
| Seeds / tests | `seedKnowledgeEngine*.js`, `knowledgeEnginePublic.test.js` |
| Client | `KnowledgeEnginePage.jsx`, `hooks/queries/knowledgeEngine.js`, route `/admin/knowledge-engine` |
| Nav / permissions | Admin tile, `HUB_CHILD_PATHS`, `admin_knowledge_engine`, `knowledge-engine` feature flag |
| Public API | `/content/posts*` and revalidate routes on `publicRoutes.js` |
| Shared | `knowledge-engine` in `orgFeatures`, `planLimits` |

### Kept intentionally

| Item | Reason |
|------|--------|
| `legacy/tsc-knowledge-engine/**` | Full snapshot + integration patches for possible future restore |
| `POST /api/webhooks/masterclass-review` | Unrelated product webhook |
| Mongo collections (`ContentArticle`, etc.) | Orphan data — app no longer reads them; optional DB cleanup |

---

## 2. Verification checklist (post-removal)

```bash
cd coreknot/Taskmaster
npm run docs:generate
npm test --prefix server
npm run build --prefix client
```

Grep guard (should return **no** hits under Taskmaster `*.js` / `*.jsx`):

```bash
rg -i "knowledgeEngine|knowledge-engine" coreknot/Taskmaster --glob "*.{js,jsx}"
```

Expected page count after regen: **140** pages (was 141 with KE admin page).

---

## 3. Optional MongoDB cleanup

Only if you are sure no other tool reads these collections:

```javascript
// Example — run in mongo shell against the correct DB; adjust names from legacy models
db.contentarticles.deleteMany({})
db.contentkeywords.deleteMany({})
// … see legacy/tsc-knowledge-engine/snapshot/server/domains/knowledge-engine/models/
```

**Do not** run on production without backup and product sign-off.

---

## 4. Restoring Knowledge Engine (if ever needed)

1. Read [`legacy/tsc-knowledge-engine/README.md`](../../../../legacy/tsc-knowledge-engine/README.md) and `snapshot/server/INTEGRATION_PATCHES.md`.  
2. Copy `snapshot/server/domains/knowledge-engine/` → `server/domains/knowledge-engine/`.  
3. Re-apply route mounts, workers, client page, navbar, feature flags per patch docs.  
4. Re-run seeds: `seedKnowledgeEngineDemo.js` (archive path only — not in active tree).

Detailed removal log (archive copy): `legacy/tsc-knowledge-engine/docs/COREKNOT_REMOVAL.md`.

---

## 5. Documentation & memory updates

| Location | Update |
|----------|--------|
| `docs/features/CONNECTED_APPS_AND_INTAKE.md` | KE noted removed; intake focus |
| `docs/DOCUMENTATION_INDEX.md` | Removal doc linked |
| `memory/obsidian/KnowledgeEngineRemoval.md` | Agent memory stub |
| `.specify/memory/features/modules.md` | No KE module |
| `docs/operations/ENTERPRISE_READINESS.md` | KE section removed (prior pass) |

---

*Last updated: 2026-07-07*
