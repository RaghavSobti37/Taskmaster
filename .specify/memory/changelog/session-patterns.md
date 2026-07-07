# Session patterns

Durable preferences and workflows learned from agent chats. **Read every session.** Append after ship when something should persist across chats.

Newest entries at top. Merge duplicates — one canonical line per preference.

---

## Standing preferences

| Topic | Pattern |
|-------|---------|
| **Memory** | Read `.specify/memory/INDEX.md` first every chat; sync memory after commit via `memory-sync` or `/git-push` |
| **Dates** | User-facing DD/MM/YYYY; ISO in storage/API |
| **Ship** | `npm run audit:exposure` before commit; memory changelog + INDEX date on push |
| **UI** | Read `docs/design/DESIGN-REFERENCE.md` before `client/` edits |
| **Hosts** | Never guess URLs — `.cursor/production-hosts.local.json` (gitignored) |

---

## 2026-07-07 — TSC tenant sync + org slug routes

- **Local data:** Prefer `npm run sync:prod-tenant-tsc` over full/operational sync when working on Shakti Collective only — skips Data Hub/Exly heavy data.
- **Env:** `PLATFORM_TENANT_SLUG=tsc` in `server/.env` + Render prod API.
- **Routes:** Workspace under `/:orgSlug/...` when `VITE_ORG_SLUG_ROUTES` enabled (default).
- **Clerk auth host:** No client `setActive` org switch on `auth.*` subdomain.
- **After tenant sync:** Restart `npm run dev` API process.

---

- **Preference:** User wants every agent run to read `.specify/memory/` first and update memory after GitHub commits with chat patterns captured.
- **Workflow:** `memory-first.mdc` rule + `MEMORY_PROTOCOL.md` + `memory-sync` skill + `npm run memory:report`.
- **Avoid:** Skipping memory read on "small" tasks; writing to memory before verify passes.

---
