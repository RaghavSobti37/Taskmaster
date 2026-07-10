/**
 * Run specific integration probes in-process (no HTTP QA runner).
 * Usage: node scripts/qaRunIntegrationSubset.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const IDS = [
  'sm-review-approve-success',
  'sm-project-complete-count',
  'int-task-complete-xp',
  'int-lead-captured-xp',
  'int-review-approve-notify',
];

async function main() {
  process.env.QA_SYNC_GAMIFICATION = 'true';
  await mongoose.connect(process.env.MONGODB_URI);
  const { purgeQaTestData } = require('../services/qa/qaTestData');
  const { buildIntegrationTestCases } = require('../services/qa/qaIntegrationTests');
  const cases = await buildIntegrationTestCases();
  const picked = cases.filter((c) => IDS.includes(c.checklistId));

  await purgeQaTestData();

  let failed = 0;
  for (const tc of picked) {
    const result = await tc.test();
    const st = result.checkStatus || (result.passed ? 'pass' : 'fail');
    console.log(`${st.toUpperCase()}  ${tc.checklistId}  ${result.description || result.error || ''}`);
    if (st === 'fail') failed += 1;
  }

  await purgeQaTestData();
  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
