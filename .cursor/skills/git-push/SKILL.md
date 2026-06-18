---
name: git-push
description: >-
  Commits session changes with a crisp senior-dev message, pushes to the current
  GitHub branch, then syncs agent memory and docs. Use when the user says
  /git-push, git push, push changes, or ship/commit and push.
disable-model-invocation: true
---

# Git Push

End-to-end ship workflow for CoreKnot (Taskmaster): **commit → push → update memory → push docs**.

## Iron rules

- **Never** `git config` changes, `--no-verify`, or `push --force` to `main`/`master` unless user explicitly asks.
- **Never** commit: `.env`, `production-hosts.local.json`, credentials, tokens, or `node_modules`.
- Run `npm run audit:exposure` before the code commit; abort if secrets found.
- Push only to the **current branch** on `origin` (or its configured upstream). Do not switch branches.

## Phase 1 — Inspect (parallel)

```bash
git status
git diff
git diff --staged
git branch --show-current
git rev-parse --abbrev-ref @{upstream} 2>/dev/null || echo "no-upstream"
git log -5 --format="%s"
git remote -v
```

Confirm: repo is `Taskmaster`, remote is GitHub, branch matches where work happened.

## Phase 2 — Code commit

### Stage

- `git add` only files that belong to this session's work.
- Exclude gitignored secrets and accidental local-only files.

### Message style

**One line.** Crisp senior-dev English. Easy scan. No fluff.

| Pattern | When |
| --- | --- |
| `fix(scope): …` | Bug / regression |
| `feat(scope): …` | New behavior |
| `perf(scope): …` | Memory, speed |
| `chore(scope): …` | Tooling, deps only |
| `docs(scope): …` | Docs-only follow-up commit |

**Rules:** lowercase type/scope; imperative verb; ≤72 chars; no period at end; no "WIP" or "misc updates".

**Good**

```
fix(backup): stream Supabase export to stop Render OOM
feat(crm): daily call-stats digest for ops leads
```

**Bad**

```
Fixed various backup issues and improved memory usage across the system.
Updated files.
```

### Commit

```bash
git commit -m "$(cat <<'EOF'
fix(backup): stream Supabase export to stop Render OOM

EOF
)"
```

If pre-commit hook fails: fix issue, **new** commit — do not `--amend` unless hook-only auto-fix on your commit.

## Phase 3 — Push code

```bash
# If upstream exists:
git push

# If no upstream:
git push -u origin HEAD
```

Verify: `git status` shows clean or only doc files left for Phase 5.

Report: branch name, commit SHA (short), push result.

## Phase 4 — Update agent memory & docs

**After** code push succeeds. Touch only what this change set affects.

### Always

1. **`.specify/memory/changelog/recent-changes.md`** — append dated bullet block (create file if missing):

```markdown
## YYYY-MM-DD — <one-line summary>

- **What:** …
- **Why:** …
- **Files:** `path/a`, `path/b`
- **Branch:** `branch-name` · **Commit:** `abc1234`
```

2. **`.specify/memory/INDEX.md`** — bump `Last updated:` line to today.

### When applicable (see [memory-map.md](memory-map.md))

| Change type | Update |
| --- | --- |
| Backup / Supabase / Mongo data | `architecture/data.md`, maybe `docs/DATA_BACKUP.md` |
| Render / Vercel / env / cron | `platform/deployment.md`, maybe `docs/DEPLOY_ENV.md` |
| API routes / services | `backend/express.md` |
| React pages / UI | `frontend/client.md` |
| Auth / RBAC / tenancy | `auth/security.md` |
| New feature module | `features/modules.md` |
| New skill or agent rule | `operations/conventions.md` |
| User-visible release | `docs/VERSION_HISTORY.md` (short dated entry at top) |
| New npm script or setup step | `README.md` only if operators need it |

**Do not** duplicate entire specs into `MASTER.md` — one-line pointer + link is enough unless structure changed.

**Do not** edit locked-zone docs (`EMAIL_ENGINE_LOCKED.md`, `LOGO_LOCKED.md`) unless this session explicitly unlocked them.

## Phase 5 — Push docs

If Phase 4 changed files:

```bash
git add .specify/memory/ docs/ README.md   # only paths actually edited
git commit -m "$(cat <<'EOF'
docs(memory): sync agent memory after <short topic>

EOF
)"
git push
```

If nothing to update in memory, skip Phase 5 and say so.

## Phase 6 — Report

Reply with:

1. **Pushed:** `branch` @ `sha` — subject line
2. **Memory:** files updated (or "none needed")
3. **Docs commit:** sha if separate, else "included in main commit"

## Failure handling

| Situation | Action |
| --- | --- |
| Nothing to commit | Stop; report clean tree |
| `audit:exposure` fails | Stop; list findings; do not push |
| Push rejected (non-fast-forward) | `git pull --rebase`, resolve, push — no force without user OK |
| Behind remote | Pull rebase first, then push |
| Only doc changes from start | Single `docs:` commit is fine |

## Quick checklist

```
- [ ] audit:exposure clean
- [ ] No secrets staged
- [ ] Crisp one-line commit
- [ ] Pushed to current branch
- [ ] recent-changes.md appended
- [ ] INDEX.md date bumped
- [ ] Component memory/docs updated if needed
- [ ] Docs commit pushed (if any)
```
