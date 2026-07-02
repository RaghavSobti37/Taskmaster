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

`replacements.txt` at the repo root drives blob redaction (`git filter-repo --replace-text`). Regex rules cover `mongodb+srv://REDACTED:REDACTED@REDACTED.example.com/`, `whsec_…` (Stripe), `AIzaSy…` (Google API keys), and `REDACTED_DB_USER`. It mirrors `scripts/gitCommitMessageRedact.py` / `scripts/gitMsgFilter.sh` — **no live secrets** in that file.

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
| 1 | `git filter-repo --replace-text replacements.txt` | File blobs: Render URLs, emails, GitHub org paths, secrets |
| 1 | `git filter-repo --mailmap mailmap.txt` | Author names/emails |
| 1 | `git filter-repo --message-callback` | Commit messages (`scripts/historyMessageCallback.py`) |
| 1 | `git filter-repo --commit-callback` | Committer metadata (`scripts/historyCommitCallback.py`) |
| 2 | `node scripts/restoreAuditNeedles.js` | Restore needles in audit scripts (filter-repo redacts them too) |
| 3 | `git reflog expire` + `git gc` | Drop old objects |
| 4 | `npm run audit:history` | Fails if original needles still appear outside tooling paths |

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

1. Rotate credentials that ever appeared in history (MongoDB Atlas passwords, `YOUTUBE_API_KEY`, `RESEND_WEBHOOK_SECRET` / Stripe `whsec_…`, JWT, Resend, etc.).
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
