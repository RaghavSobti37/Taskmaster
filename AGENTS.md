# CoreKnot (Taskmaster) — Agent Instructions

Every agent in this package reads **agent memory first**, then follows platform governance.

## Memory first (every chat)

| Step | Path |
|------|------|
| 1 | [`memory/obsidian/INDEX.md`](memory/obsidian/INDEX.md) |
| 2 | [`memory/obsidian/ReportExploration.md`](memory/obsidian/ReportExploration.md) |
| 3 | [`memory/obsidian/RecentChanges.md`](memory/obsidian/RecentChanges.md) |
| 4 | [`.specify/memory/INDEX.md`](.specify/memory/INDEX.md) *(compat fallback only)* |
| 5 | Component doc per task — [memory-map](.cursor/skills/git-push/memory-map.md) |

**Protocol:** Obsidian notes are canonical; `.specify` is compatibility-only.  
**Rule:** `.cursor/rules/memory-first.mdc` (always on)  
**Boot skill:** `.cursor/skills/coreknot-session-boot/SKILL.md`  
**End-of-session:** `.cursor/skills/memory-sync/SKILL.md` or `/git-push`

```bash
npm run memory:report   # commits since INDEX date — run at session start if unsure
```

## Platform stack (after memory read)

| # | Component | Location |
|---|-----------|----------|
| 1 | Agent governance | `.cursor/rules/agent-governance.mdc` |
| 2 | Agent OS | `.cursor/rules/agent-os.mdc` |
| 3 | Agent menu | `../../../../.cursor/skills/agent-menu/SKILL.md` |
| 4 | Loop engineering | `../../../../.cursor/skills/loop-engineering/SKILL.md` |

## Memory gate

Never mark work complete in memory until verify exits 0:

```bash
node ../../../../.cursor/scripts/agent-memory-gate.mjs verify-and-patch \
  --ledger .cursor/loop-engineering/<slug>-ledger.json \
  --patch '{"satisfaction":"pass"}' \
  -- "npm test --prefix client && npm test --prefix server"
```

## Verify bundle (before done / memory write)

```bash
npm test --prefix client
npm test --prefix server
npm run build --prefix client
```

## Design reference (mandatory for `client/`)

[`docs/design/DESIGN-REFERENCE.md`](docs/design/DESIGN-REFERENCE.md) · [`docs/reference/COMPONENT_STANDARDS.md`](docs/reference/COMPONENT_STANDARDS.md) · [`docs/reference/COREKNOT_MASTER.md`](docs/reference/COREKNOT_MASTER.md)

## Dates

User-facing **DD/MM/YYYY** — `client/src/utils/dateDisplay.js`. Storage/API stay ISO `yyyy-MM-dd`.

## Heal loop

```bash
node ../../../../.cursor/healing-loop/run-loop.mjs --root ./coreknot/Taskmaster --agent-continue
```

## Local prod data (TSC)

```bash
npm run sync:prod-tenant-tsc   # from coreknot/Taskmaster — skips Data Hub/Exly; finance lite
```

See `docs/operations/LOCAL_DEV_DATABASE.md`.
