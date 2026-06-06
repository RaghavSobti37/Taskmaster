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

echo "==> restore audit needles (filter-repo redacts auditGitHistoryExposure.js too)"
node -e "
const fs=require('fs');
const p='scripts/auditGitHistoryExposure.js';
let s=fs.readFileSync(p,'utf8');
const block=/const NEEDLES = \\[[\\s\\S]*?\\];/;
const needles=\`const NEEDLES = [
  'taskmaster-jfw0.onrender.com',
  'coreknot-api.onrender.com',
  'raghavraj@theshakticollective.in',
  'raghavsobti37@gmail.com',
  'raghav@gmail.com',
  'harshika@theshakticollective.in',
  'deepank@theshakticollective.in',
  'aryaman@theshakticollective.in',
  'rohith@theshakticollective.in',
  'github.com/RaghavSobti37',
  'RaghavSobti37/CoreKnot',
  'RaghavSobti37/Taskmaster',
  'raghavsobti37_db_user',
  'whsec_uYreGAA3',
  'AIzaSyBT6YIo',
];\`;
if (!block.test(s)) { console.error('NEEDLES block not found'); process.exit(1); }
fs.writeFileSync(p, s.replace(block, needles));
"

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
