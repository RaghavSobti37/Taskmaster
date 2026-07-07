# KnowledgeEngineRemoval

**Removed:** 2026-07-07 from active CoreKnot.

## Docs

- `coreknot/Taskmaster/docs/operations/KNOWLEDGE_ENGINE_REMOVAL.md`
- Archive: `legacy/tsc-knowledge-engine/`

## Gone from app

- Route `/admin/knowledge-engine`
- API `/api/knowledge-engine`
- Feature `knowledge-engine`, permission `admin_knowledge_engine`
- Workers, seeds, public `/content/posts*`

## Still in DB (optional cleanup)

Orphan Mongo collections from old KE models — app does not read them.

## Restore

Copy from `legacy/tsc-knowledge-engine/snapshot/` per `INTEGRATION_PATCHES.md` — product decision only.
