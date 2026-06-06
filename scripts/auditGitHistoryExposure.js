#!/usr/bin/env node
/**
 * Scan git history for leaked hosts / PII / API secrets (read-only report).
 * Only flags original secrets — not redaction placeholders.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** Original needles only (pre-redaction). */
const NEEDLES = [
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
];

/** Paths that intentionally list needles for detection — exclude from pickaxe scan. */
const EXCLUDE_PATHS = [
  'scripts/auditGitHistoryExposure.js',
  'scripts/checkCommittedExposure.js',
  'scripts/gitMsgFilter.sh',
  'scripts/gitCommitMessageRedact.py',
  'scripts/gitFilterCommitMsg.py',
  'scripts/gitEmailRedact.py',
  'scripts/gitNameRedact.py',
  'scripts/runHistoryRedact.sh',
  'docs/GIT_HISTORY_REDACTION.md',
  'replacements.txt',
  'security-context.md',
];

const pathExcludes = EXCLUDE_PATHS.map((p) => `":(exclude)${p}"`).join(' ');

const hits = [];

for (const needle of NEEDLES) {
  try {
    const out = execSync(`git log --all -S "${needle}" --oneline -- . ${pathExcludes}`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
    const lines = out.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length) hits.push({ needle, commits: lines.length, sample: lines.slice(0, 5) });
  } catch {
    // no matches
  }
}

if (!hits.length) {
  console.log('Git history exposure scan: no original PII/secret needles found.');
  process.exit(0);
}

console.error('\nGit history exposure scan — original literals still present\n');
for (const h of hits) {
  console.error(`  "${h.needle}" — ${h.commits} commit(s)`);
  for (const line of h.sample) console.error(`    ${line}`);
  if (h.commits > h.sample.length) console.error('    …');
}
console.error('\nRe-run git filter-repo per docs/GIT_HISTORY_REDACTION.md\n');
process.exit(1);
