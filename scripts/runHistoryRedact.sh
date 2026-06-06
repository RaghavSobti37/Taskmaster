#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f replacements.txt ]]; then
  echo "missing replacements.txt in repo root" >&2
  exit 1
fi
if [[ ! -f mailmap.txt ]]; then
  echo "missing mailmap.txt in repo root" >&2
  exit 1
fi

MSG_CB="$(cat "$ROOT/scripts/historyMessageCallback.py")"
CMT_CB="$(cat "$ROOT/scripts/historyCommitCallback.py")"

echo "==> filter-repo: blobs + messages + author metadata"
rm -rf .git/filter-repo 2>/dev/null || true
git filter-repo \
  --replace-text replacements.txt \
  --mailmap mailmap.txt \
  --message-callback "$MSG_CB" \
  --commit-callback "$CMT_CB" \
  --force

echo "==> restore audit needles (filter-repo redacts security tooling literals too)"
node scripts/restoreAuditNeedles.js

git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo "==> verify"
if ! node scripts/auditGitHistoryExposure.js; then
  echo "FAIL: audit:history still reports needles" >&2
  exit 1
fi
if git log --all --oneline | grep -iE 'raghavsobti37|RaghavSobti37' | head -1 | grep -q .; then
  echo "FAIL: PII still in commit subjects" >&2
  exit 1
fi
echo "OK: history redaction complete"
