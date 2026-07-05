---
name: memory-sync
description: >-
  Sync CoreKnot .specify/memory after verified work — changelog, session patterns,
  component docs, INDEX stamp. Use at session end, after commit, or when user asks
  to update agent memory.
---

# Memory sync

Run **after** verify passes and code is committed (or staged for commit). Do not mark memory "done" before verify exit 0.

## Read first

- [MEMORY_PROTOCOL.md](../../../.specify/memory/MEMORY_PROTOCOL.md)
- [memory-map.md](../git-push/memory-map.md)

## Steps

### 1 — Gather session facts

From git + conversation (no secrets):

```bash
git branch --show-current
git log -1 --format="%h %s"
git diff --name-only HEAD~1..HEAD   # or vs main if single commit session
```

### 2 — recent-changes.md

Prepend block at top (below title), newest first:

```markdown
## YYYY-MM-DD — <one-line summary>

- **What:** …
- **Why:** …
- **Files:** `…`
- **Branch:** `…` · **Commit:** `…`
```

### 3 — session-patterns.md

If user stated a **preference**, **workflow**, or **anti-pattern** that should persist:

- Add under `## Standing preferences` table OR new dated `###` section at top
- Deduplicate — update existing row instead of repeating

### 4 — Component memory

Touch only files affected (see memory-map). One-line delta + link to `docs/` for depth.

### 5 — INDEX.md

Bump: `**Last updated:** YYYY-MM-DD`

### 6 — Commit memory

```bash
git add .specify/memory/
git commit -m "docs(memory): sync after <short topic>"
git push   # if code already pushed and user wants memory on remote
```

If memory ships in same commit as code, skip separate commit — still complete steps 2–5 before push.

## Checklist

```
- [ ] Verify passed this turn
- [ ] recent-changes.md prepended
- [ ] session-patterns.md updated if new durable prefs
- [ ] Component files updated if needed
- [ ] INDEX.md date bumped
- [ ] Memory committed/pushed
```

## Related

- Full ship: `git-push` skill (commit → push → memory → docs push)
- Boot: `coreknot-session-boot` skill
- Report missing deltas: `npm run memory:report`
