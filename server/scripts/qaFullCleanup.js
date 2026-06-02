/**
 * Extended QA cleanup — safe patterns only, never touches real leads with placeholder emails.
 * Usage: node scripts/qaFullCleanup.js [--prod] [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');

const useProd = process.argv.includes('--prod');
const dryRun = process.argv.includes('--dry-run');
const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
const BYPASS = { bypassTenant: true };

/** Contacts/mail events with these exact or prefix patterns are test garbage. */
const SAFE_TEST_EMAIL_PATTERNS = [
  /^test-bounce@example\.com$/i,
  /^test@example\.com$/i,
  /^exly-test-/i,
  /^qa-/i,
  /^artist\.enquiry\.test@/i,
  /^workflow_test/i,
];

function isSafeTestEmail(email) {
  if (!email) return false;
  const e = String(email).trim();
  return SAFE_TEST_EMAIL_PATTERNS.some((re) => re.test(e));
}

async function main() {
  if (!uri) throw new Error(`Missing ${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'}`);
  await mongoose.connect(uri);
  console.log(`\n=== QA Full Cleanup [${useProd ? 'PRODUCTION' : 'LOCAL'}]${dryRun ? ' DRY-RUN' : ''} ===\n`);

  const Lead = require('../models/Lead');
  const Contact = require('../models/Contact');
  const Log = require('../models/Log');
  const MailEvent = require('../models/MailEvent');
  const QATestRun = require('../models/QATestRun');
  const {
    purgeQaTestData,
    purgeQaRunArtifacts,
    countQaResiduals,
  } = require('../services/qa/qaTestData');
  const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');

  const report = { before: {}, actions: {}, after: {} };

  report.before.residuals = await countQaResiduals();
  report.before.qaLogs = await Log.countDocuments({
    $or: [{ origin: 'QA_AGENT_TEST' }, { action: 'QA_TEST' }, { module: 'QA_TESTING' }, { action: 'QA_ASSERTION' }],
  }).setOptions(BYPASS);
  report.before.mailEvents = await MailEvent.countDocuments({ email: { $regex: /^(test-bounce|test@example\.com|qa-|exly-test-)/i } }).setOptions(BYPASS);
  report.before.testContacts = await Contact.countDocuments({ email: { $regex: /^(test-bounce|test@example\.com|exly-test-|qa-)/i } }).setOptions(BYPASS);
  report.before.staleRuns = await QATestRun.countDocuments({ status: { $in: ['pending', 'in-progress'] } });
  report.before.corruptPhones = await Lead.countDocuments({
    $or: [
      { phone: { $regex: /-DUP-[a-f0-9]{24}$/i } },
      { phone: { $regex: /^EMPTY-[a-f0-9]{24}$/i } },
    ],
  }).setOptions(BYPASS);

  console.log('BEFORE:', JSON.stringify(report.before, null, 2));

  if (dryRun) {
    const runs = await QATestRun.find({ 'createdArtifacts.0': { $exists: true } }).select('createdArtifacts bugsCreated status').lean();
    let artifactCount = 0;
    for (const r of runs) artifactCount += (r.createdArtifacts?.length || 0) + (r.bugsCreated?.length || 0);
    console.log(`\nWould purge artifacts from ${runs.length} QA runs (${artifactCount} refs)`);
    await mongoose.disconnect();
    return;
  }

  // 1. Cancel stale QA runs
  const cancelResult = await QATestRun.updateMany(
    { status: { $in: ['pending', 'in-progress'] } },
    { status: 'cancelled', completedAt: new Date() }
  );
  report.actions.cancelledRuns = cancelResult.modifiedCount;

  // 2. Purge artifacts from all QA runs (completed/cancelled/error)
  const allRuns = await QATestRun.find({}).lean();
  let trackedDeleted = 0;
  const artifactErrors = [];
  for (const run of allRuns) {
    try {
      const r = await purgeQaRunArtifacts(run);
      trackedDeleted += r.deleted;
      artifactErrors.push(...r.errors);
    } catch (err) {
      artifactErrors.push(`run ${run._id}: ${err.message}`);
    }
  }
  report.actions.trackedArtifactsDeleted = trackedDeleted;
  if (artifactErrors.length) report.actions.artifactErrors = artifactErrors;

  // 3. Standard QA pattern purge + phone repair
  const [swept, phoneRepair] = await Promise.all([purgeQaTestData(), repairCorruptLeadPhones()]);
  report.actions.standardPurge = swept.deleted;
  report.actions.phoneRepair = phoneRepair;

  // 4. Mail events — test bounce/qa only
  const mailFilter = { email: { $regex: /^(test-bounce|test@example\.com|qa-|exly-test-)/i } };
  const mailResult = await MailEvent.deleteMany(mailFilter).setOptions(BYPASS);
  report.actions.mailEventsDeleted = mailResult.deletedCount || 0;

  // 5. Contacts — only clearly test emails (NOT your.email@example.com or test@test.com with real names)
  const testContacts = await Contact.find({
    $or: SAFE_TEST_EMAIL_PATTERNS.map((re) => ({ email: { $regex: re } })),
  }).setOptions(BYPASS).select('_id email name phone').lean();

  const contactIds = testContacts.filter((c) => isSafeTestEmail(c.email)).map((c) => c._id);
  if (contactIds.length) {
    const contactResult = await Contact.deleteMany({ _id: { $in: contactIds } }).setOptions(BYPASS);
    report.actions.testContactsDeleted = contactResult.deletedCount || 0;
    report.actions.deletedContactEmails = testContacts.filter((c) => contactIds.some((id) => String(id) === String(c._id))).map((c) => c.email);
  } else {
    report.actions.testContactsDeleted = 0;
  }

  // 6. Leads with same safe test emails only
  const testLeads = await Lead.find({
    $or: SAFE_TEST_EMAIL_PATTERNS.map((re) => ({ email: { $regex: re } })),
  }).setOptions(BYPASS).select('_id email').lean();
  const leadIds = testLeads.filter((l) => isSafeTestEmail(l.email)).map((l) => l._id);
  if (leadIds.length) {
    const leadResult = await Lead.deleteMany({ _id: { $in: leadIds } }).setOptions(BYPASS);
    report.actions.testLeadsDeleted = leadResult.deletedCount || 0;
  } else {
    report.actions.testLeadsDeleted = 0;
  }

  report.after.residuals = await countQaResiduals();
  report.after.qaLogs = await Log.countDocuments({
    $or: [{ origin: 'QA_AGENT_TEST' }, { action: 'QA_TEST' }, { module: 'QA_TESTING' }, { action: 'QA_ASSERTION' }],
  }).setOptions(BYPASS);
  report.after.mailEvents = await MailEvent.countDocuments(mailFilter).setOptions(BYPASS);
  report.after.testContacts = await Contact.countDocuments({ email: { $regex: /^(test-bounce|test@example\.com|exly-test-|qa-)/i } }).setOptions(BYPASS);
  report.after.staleRuns = await QATestRun.countDocuments({ status: { $in: ['pending', 'in-progress'] } });
  report.after.corruptPhones = await Lead.countDocuments({
    $or: [
      { phone: { $regex: /-DUP-[a-f0-9]{24}$/i } },
      { phone: { $regex: /^EMPTY-[a-f0-9]{24}$/i } },
    ],
  }).setOptions(BYPASS);

  console.log('\nACTIONS:', JSON.stringify(report.actions, null, 2));
  console.log('\nAFTER:', JSON.stringify(report.after, null, 2));

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
