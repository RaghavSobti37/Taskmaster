# Agent memory protocol

> **Purpose:** Every agent session reads this tree first and writes back after verified work ships.  
> **Hub:** [INDEX.md](INDEX.md)

---

## Read order (start of chat)

| # | File | Why |
|---|------|-----|
| 1 | [INDEX.md](INDEX.md) | Navigation + `Last updated` stamp |
| 2 | [changelog/recent-changes.md](changelog/recent-changes.md) | Last 3+ session deltas (newest first) |
| 3 | [changelog/session-patterns.md](changelog/session-patterns.md) | User preferences + patterns from prior chats |
| 4 | [operations/conventions.md](operations/conventions.md) | Locked zones, audits, business rules |
| 5 | Component doc | See [git-push memory-map](../../.cursor/skills/git-push/memory-map.md) |

**Narrow task?** Still read 1–3. Add component doc only when editing that layer.

**Boot skill:** `.cursor/skills/coreknot-session-boot/SKILL.md`  
**Boot check:** `npm run memory:report` (lists commits possibly missing from changelog)

---

## Write order (end of session — after verify + commit)

| # | Action | File |
|---|--------|------|
| 1 | Session delta | `changelog/recent-changes.md` — dated block at top |
| 2 | Durable patterns | `changelog/session-patterns.md` — prefs, decisions, anti-patterns |
| 3 | Component truth | `platform/`, `architecture/`, `frontend/`, `backend/`, `auth/`, `features/`, `operations/` as needed |
| 4 | Hub stamp | `INDEX.md` — `Last updated: YYYY-MM-DD` |
| 5 | Ship | `docs(memory): sync after <topic>` commit if separate from code |

**Skills:** `.cursor/skills/memory-sync/SKILL.md` · `/git-push` → `.cursor/skills/git-push/SKILL.md`

**Gate:** Do not claim memory is current until verify exited 0 (tests/build per `AGENTS.md`).

---

## recent-changes entry template

```markdown
## YYYY-MM-DD — one-line summary

- **What:** …
- **Why:** …
- **Files:** `path/a`, `path/b`
- **Patterns:** (optional) link or one-liner for session-patterns.md
- **Branch:** `branch` · **Commit:** `abc1234`
```

---

## session-patterns entry template

```markdown
### YYYY-MM-DD — topic

- **Preference:** …
- **Workflow:** …
- **Avoid:** …
```

Keep factual. No secrets. Merge duplicate prefs — do not append the same rule every chat.

---

## What not to duplicate

| Keep in memory | Keep in `docs/` instead |
|----------------|-------------------------|
| One-line truth + pointer | Long specs (email engine, logo) |
| Session deltas | VERSION_HISTORY releases |
| API surface summary | OpenAPI / MASTER § depth |

---

## Folder layout

```
.specify/memory/
├── INDEX.md              ← start
├── MEMORY_PROTOCOL.md    ← this file
├── MASTER.md             ← API/env depth (rare edits)
├── changelog/
│   ├── recent-changes.md
│   └── session-patterns.md
├── platform/
├── architecture/
├── frontend/
├── backend/
├── auth/
├── features/
└── operations/
```

Local-only scratch (gitignored): `.specify/memory/agents/` — do not rely on it across clones.
