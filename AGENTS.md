# TSC Platform — Agent Instructions

Every Cursor agent in this workspace follows **Agent Governance** first.

## Stack (order)

| # | Component | Location |
|---|-----------|----------|
| 1 | Agent governance | `.cursor/rules/agent-governance.mdc` |
| 2 | Agent OS | `.cursor/rules/agent-os.mdc` |
| 3 | Agent menu | `.cursor/skills/agent-menu/SKILL.md` |
| 4 | Loop engineering | `.cursor/skills/loop-engineering/SKILL.md` (build tasks) |
| 5 | Multiagent | `.cursor/skills/multiagent/SKILL.md` (2+ slices) |

## Memory gate

**Never** mark work complete in memory/ledgers until verify exits 0:

```bash
node .cursor/scripts/agent-memory-gate.mjs verify-and-patch \
  --ledger .cursor/loop-engineering/<slug>-ledger.json \
  --patch '{"satisfaction":"pass"}' \
  -- "<verify commands>"
```

## Primary app

**CoreKnot** — `coreknot/Taskmaster/AGENTS.md`

## Heal loop

Autonomous browser tests: `node .cursor/healing-loop/run-loop.mjs --root ./coreknot/Taskmaster --agent-continue`

## Design reference (mandatory for client UI)

**Before any change under `client/`**, read and apply:

`docs/design/DESIGN-REFERENCE.md`

Run the quick checklist at the top on every page you touch. Cursor auto-attaches `.cursor/rules/coreknot-design-reference.mdc` when editing `client/**`.

Complementary: `docs/COMPONENT_STANDARDS.md`, `client/design_guidelines.md`.

## Date display

User-facing dates are **DD/MM/YYYY** (en-GB style). Use helpers in `client/src/utils/dateDisplay.js` (`formatDisplayDate`, `formatDateKeyForDisplay`, etc.). Never show MM/DD/YYYY in labels, nav, or tables. Native `<input type="date">` values stay ISO (`yyyy-MM-dd`); overlay or companion text for visible DD/MM/YYYY.
