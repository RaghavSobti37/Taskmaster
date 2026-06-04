# Git history redaction

Older commits may still contain Render hosts, emails, Mongo URIs, or names until history is rewritten. The working tree is scanned with `npm run audit:exposure`; history is scanned with `npm run audit:history`.

## Scan only (safe)

```bash
npm run audit:history
```

Exits **0** when no **original** PII needles remain (placeholders like `redacted@example.com` or `YOUR-RENDER-SERVICE.onrender.com` are OK). Needles are defined in `scripts/auditGitHistoryExposure.js`.

## Rewrite history (destructive)

Requires [git-filter-repo](https://github.com/newren/git-filter-repo) and **Git Bash** on Windows. Coordinate with all collaborators before force-pushing. **Do not re-run** if `npm run audit:history` already passes unless new literals were committed.

### Prerequisites

```bash
pip install git-filter-repo
```

`replacements.txt` at the repo root drives blob redaction (`git filter-repo --replace-text`). It mirrors `scripts/gitCommitMessageRedact.py` / `scripts/gitMsgFilter.sh` plus a MongoDB Atlas URI regex.

### Automated script

```bash
bash scripts/runHistoryRedact.sh
npm run audit:history
git push --force origin main
git push --force origin testing   # if applicable
```

`scripts/runHistoryRedact.sh` runs:

| Step | Tool | What it redacts |
|------|------|-----------------|
| 1 | `git filter-repo --replace-text replacements.txt` | File blobs: Render URLs, emails, GitHub org paths, names, `mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/` |
| 2 | `git filter-branch` | Commit **messages** via `scripts/gitMsgFilter.sh` (`cat \| sed`) |
| 2 | `git filter-branch` | Author/committer **email & name** via `scripts/gitEnvRedact.sh` |
| 3 | `git reflog expire` + `git gc` | Drop old objects |
| 4 | Built-in checks | Fails if original personal-email or GitHub-org needles still appear in history |

After `filter-repo`, re-add `origin` if removed:

```bash
git remote add origin https://github.com/YOUR_ORG/Taskmaster.git
```

### Manual pieces (reference)

- Blob rules: `replacements.txt`
- Message filter: `scripts/gitMsgFilter.sh` or `scripts/gitFilterCommitMsg.py`
- Author metadata: `scripts/gitEnvRedact.sh`
- Optional Python helpers: `scripts/gitEmailRedact.py`, `scripts/gitNameRedact.py` (for other filter-repo workflows)

## After rewrite

1. Rotate credentials that ever appeared in history (JWT, Mongo, Google, Resend, etc.).
2. Re-clone or `git fetch origin && git reset --hard origin/main` on every machine.
3. Delete forks or rewrite them separately; GitHub may retain old objects until GC.

## Completed run (Jun 2026)

Repo: `https://github.com/YOUR_ORG/Taskmaster` (force-pushed Jun 2026)

| Phase | Command / artifact |
|-------|-------------------|
| Blob redaction | `git filter-repo --replace-text replacements.txt` |
| Messages + author metadata | `git filter-branch` — `cat \| sed` (`gitMsgFilter.sh`) + `gitEnvRedact.sh` |
| Verify | `npm run audit:history` — **clean** (no original needles) |
| Force push | `main` → **`8630cd9`** (pre-rewrite tip was **`5839cb1`**); **`testing`** rewritten and force-pushed too |

Post-push gate: `npm run audit:exposure` before new commits; `npm run audit:history` after any future history rewrite.
