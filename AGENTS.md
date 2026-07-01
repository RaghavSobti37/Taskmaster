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
