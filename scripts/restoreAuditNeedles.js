#!/usr/bin/env node
/** Re-apply original needles after git filter-repo (which redacts them in tooling files too). */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const block = /const (NEEDLES|BLOCKED_LITERALS) = \[[\s\S]*?\];/;

const NEEDLES = `const NEEDLES = [
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
];`;

const BLOCKED_LITERALS = `const BLOCKED_LITERALS = [
  'taskmaster-jfw0.onrender.com',
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
];`;

const targets = [
  ['scripts/auditGitHistoryExposure.js', NEEDLES],
  ['scripts/checkCommittedExposure.js', BLOCKED_LITERALS],
];

for (const [rel, replacement] of targets) {
  const abs = path.join(ROOT, rel);
  let content = fs.readFileSync(abs, 'utf8');
  if (!block.test(content)) {
    console.error(`[restoreAuditNeedles] block not found in ${rel}`);
    process.exit(1);
  }
  fs.writeFileSync(abs, content.replace(block, replacement));
  console.log(`[restoreAuditNeedles] updated ${rel}`);
}
