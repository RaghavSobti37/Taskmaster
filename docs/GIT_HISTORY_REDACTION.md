# Git history redaction

The full runbook lives at `docs/archive/GIT_HISTORY_REDACTION.md`.

Use `npm run audit:history` for the safe read-only scan. If it fails, coordinate with collaborators before rewriting history, then run:

```bash
bash scripts/runHistoryRedact.sh
npm run audit:history
```

After a passing rewrite, re-add the remote if `git-filter-repo` removed it and force-push only after coordination.
