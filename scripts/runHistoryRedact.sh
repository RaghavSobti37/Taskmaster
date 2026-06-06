#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f replacements.txt ]]; then
  echo "missing replacements.txt in repo root" >&2
  exit 1
fi

echo "==> filter-repo: blob redaction"
git filter-repo --replace-text replacements.txt --force

echo "==> filter-branch: commit messages + author metadata"
rm -rf .git/refs/original/ 2>/dev/null || true
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f \
  --msg-filter "sh \"$ROOT/scripts/gitMsgFilter.sh\"" \
  --env-filter "sh \"$ROOT/scripts/gitEnvRedact.sh\"" \
  -- --all

git for-each-ref --format='delete %(refname)' refs/original 2>/dev/null | git update-ref --stdin || true
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "==> verify"
if ! node scripts/auditGitHistoryExposure.js; then
  echo "FAIL: audit:history still reports needles" >&2
  exit 1
fi
if git log --all --oneline | grep -iE 'raghavsobti37|RaghavSobti37' | head -1 | grep -q .; then
  echo "FAIL: PII still in commit subjects" >&2
  git log --all --oneline | grep -iE 'raghavsobti37|RaghavSobti37' | head -5 >&2
  exit 1
fi
echo "OK: history redaction complete"
