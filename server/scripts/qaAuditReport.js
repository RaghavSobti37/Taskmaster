/**
 * Read-only audit of QA / test garbage across MongoDB.
 * Usage: node scripts/qaAuditReport.js [--prod]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const {
  buildQaTestDataFilter,
  buildQaTaskFilter,
  buildQaUserFilter,
  countQaResiduals,
} = require('../services/qa/qaTestData');
const { corruptPhoneQuery } = require('../services/leadPhoneRepair');

const BYPASS = { bypassTenant: true };
const useProd = process.argv.includes('--prod');
const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
const envLabel = useProd ? 'PRODUCTION' : 'LOCAL';

const PROBE_PHONES = ['9876500001', '9876500002', '9876500003', '9876500004', '9999999999'];
const MANUAL_TEST_EMAILS = [
  /^qa-/i,
  /^test@example\.com$/i,
  /^test-bounce@/i,
  /^artist\.enquiry\.test@/i,
  /^workflow_test/i,
  /@example\.com$/i,
  /@test\.com$/i,
];

async function sample(Model, filter, fields, limit = 5) {
  return Model.find(filter).setOptions(BYPASS).select(fields).sort({ createdAt: -1 }).limit(limit).lean();
}

async function audit() {
  if (!uri) throw new Error(`Missing ${useProd ? 'MONGODB_URI_PROD' : 'MONGODB_URI'}`);

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const Lead = require('../models/Lead');
  const Contact = require('../models/Contact');
  const Task = require('../models/Task');
  const User = require('../models/User');
  const FinanceDocument = require('../models/FinanceDocument');
  const Project = require('../models/Project');
  const Notification = require('../models/Notification');
  const Log = require('../models/Log');
  const XPAuditLog = require('../models/XPAuditLog');
  const CRMAudit = require('../models/CRMAudit');
  const QATestRun = require('../models/QATestRun');
  const MailEvent = require('../models/MailEvent');
  const MailCampaign = require('../models/MailCampaign');

  const report = { env: envLabel, db: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), scannedAt: new Date().toISOString(), sections: {} };

  // Core QA residuals (existing purge filters)
  const residuals = await countQaResiduals();
  report.sections.coreQaResiduals = {
    ...residuals,
    samples: {
      leads: await sample(Lead, buildQaTestDataFilter(), 'name email phone source createdAt'),
      tasks: await sample(Task, buildQaTaskFilter(), 'title status createdAt'),
      users: await sample(User, buildQaUserFilter(), 'name email createdAt'),
    },
  };

  // Corrupt phones
  const corruptCount = await Lead.countDocuments(corruptPhoneQuery).setOptions(BYPASS);
  report.sections.corruptPhones = {
    count: corruptCount,
    samples: await sample(Lead, corruptPhoneQuery, 'name email phone createdAt'),
  };

  // Probe phones
  const probeFilter = { phone: { $in: PROBE_PHONES } };
  report.sections.probePhones = {
    count: await Lead.countDocuments(probeFilter).setOptions(BYPASS),
    samples: await sample(Lead, probeFilter, 'name email phone source createdAt'),
  };

  // QA logs
  const qaLogFilter = {
    $or: [
      { origin: 'QA_AGENT_TEST' },
      { action: 'QA_TEST' },
      { module: 'QA_TESTING' },
      { action: 'QA_ASSERTION' },
    ],
  };
  report.sections.qaLogs = {
    count: await Log.countDocuments(qaLogFilter).setOptions(BYPASS),
    bugDetected: await Log.countDocuments({ origin: 'QA_AGENT_TEST', status: 'BUG_DETECTED' }).setOptions(BYPASS),
    samples: await sample(Log, qaLogFilter, 'action origin status targetEntity createdAt'),
  };

  // XP audits
  report.sections.qaXpAudits = {
    count: await XPAuditLog.countDocuments({ 'details.qaProbe': true }),
    samples: await XPAuditLog.find({ 'details.qaProbe': true }).select('action details createdAt').sort({ createdAt: -1 }).limit(5).lean(),
  };

  // QA test runs
  const staleRuns = await QATestRun.countDocuments({ status: { $in: ['pending', 'in-progress'] } });
  const runStatusAgg = await QATestRun.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
  report.sections.qaTestRuns = {
    total: await QATestRun.countDocuments(),
    stalePendingOrInProgress: staleRuns,
    byStatus: Object.fromEntries(runStatusAgg.map((r) => [r._id, r.n])),
    withArtifacts: await QATestRun.countDocuments({ 'createdArtifacts.0': { $exists: true } }),
    samples: await QATestRun.find().select('status startedAt completedAt bugsCreated createdArtifacts cleanupResults').sort({ startedAt: -1 }).limit(5).lean(),
  };

  // Mail test data
  const mailEventFilter = { email: { $regex: /^(test-bounce|test@example\.com|qa-|artist\.enquiry\.test)/i } };
  report.sections.mailEvents = {
    count: await MailEvent.countDocuments(mailEventFilter).setOptions(BYPASS),
    exampleComTotal: await MailEvent.countDocuments({ email: { $regex: /@example\.com$/i } }).setOptions(BYPASS),
    samples: await sample(MailEvent, mailEventFilter, 'email eventType campaignId timestamp'),
  };

  const mailCampaignFilter = { title: { $regex: /QA Test Campaign/i } };
  report.sections.mailCampaigns = {
    count: await MailCampaign.countDocuments(mailCampaignFilter).setOptions(BYPASS),
    samples: await sample(MailCampaign, mailCampaignFilter, 'title status createdAt'),
  };

  // Contacts with QA Course inlet
  const qaCourseFilter = { 'inlets.offeringTitle': 'QA Course' };
  report.sections.qaCourseContacts = {
    count: await Contact.countDocuments(qaCourseFilter).setOptions(BYPASS),
    samples: await sample(Contact, qaCourseFilter, 'name email isMultiInlet createdAt'),
  };

  // Enquiry tasks from manual tests
  const enquiryFilter = {
    type: 'enquiry',
    $or: [
      { description: { $regex: /artist\.enquiry\.test|workflow_test|@example\.com/i } },
      { title: { $regex: /^QA /i } },
    ],
  };
  report.sections.enquiryTasks = {
    count: await Task.countDocuments(enquiryFilter).setOptions(BYPASS),
    samples: await sample(Task, enquiryFilter, 'title type description createdAt'),
  };

  // Notifications linked to QA tasks but no QA in title
  const qaTaskIds = (await Task.find(buildQaTaskFilter()).setOptions(BYPASS).select('_id').lean()).map((t) => t._id);
  const orphanNotifFilter = qaTaskIds.length
    ? { relatedTaskId: { $in: qaTaskIds }, title: { $not: { $regex: /^QA /i } } }
    : { _id: null };
  report.sections.orphanNotifications = {
    count: qaTaskIds.length ? await Notification.countDocuments(orphanNotifFilter).setOptions(BYPASS) : 0,
    samples: qaTaskIds.length ? await sample(Notification, orphanNotifFilter, 'title relatedTaskId createdAt') : [],
  };

  // CRMAudits for QA leads
  const qaLeadIds = (await Lead.find(buildQaTestDataFilter()).setOptions(BYPASS).select('_id').lean()).map((l) => l._id);
  report.sections.qaCrmAudits = {
    count: qaLeadIds.length ? await CRMAudit.countDocuments({ leadId: { $in: qaLeadIds } }).setOptions(BYPASS) : 0,
  };

  // Manual test emails on leads (broader scan — report only, not auto-purge)
  const manualEmailClauses = MANUAL_TEST_EMAILS.map((re) => ({ email: { $regex: re } }));
  const manualLeadFilter = { $or: manualEmailClauses };
  report.sections.manualTestEmails = {
    leads: await Lead.countDocuments(manualLeadFilter).setOptions(BYPASS),
    contacts: await Contact.countDocuments(manualLeadFilter).setOptions(BYPASS),
    leadSamples: await sample(Lead, manualLeadFilter, 'name email phone source createdAt'),
    contactSamples: await sample(Contact, manualLeadFilter, 'name email phone source createdAt'),
  };

  // Finance / projects / notifications counts
  report.sections.breakdown = {
    finance: await FinanceDocument.countDocuments({ title: { $regex: /^QA /i } }).setOptions(BYPASS),
    projects: await Project.countDocuments({ name: { $regex: /^QA /i } }).setOptions(BYPASS),
    notificationsQaTitle: await Notification.countDocuments({ title: { $regex: /^QA /i } }).setOptions(BYPASS),
  };

  // Summary totals to fix
  const toFix = {
    coreQa: residuals.total,
    corruptPhones: corruptCount,
    probePhones: report.sections.probePhones.count,
    qaLogs: report.sections.qaLogs.count,
    qaXpAudits: report.sections.qaXpAudits.count,
    staleQaRuns: staleRuns,
    mailEvents: report.sections.mailEvents.count,
    mailCampaigns: report.sections.mailCampaigns.count,
    qaCourseContacts: report.sections.qaCourseContacts.count,
    enquiryTasks: report.sections.enquiryTasks.count,
    orphanNotifications: report.sections.orphanNotifications.count,
    qaCrmAudits: report.sections.qaCrmAudits.count,
  };
  report.summary = {
    toFix,
    grandTotal:
      toFix.coreQa +
      toFix.corruptPhones +
      toFix.probePhones +
      toFix.qaLogs +
      toFix.qaXpAudits +
      toFix.mailEvents +
      toFix.mailCampaigns +
      toFix.qaCourseContacts +
      toFix.enquiryTasks +
      toFix.orphanNotifications +
      toFix.qaCrmAudits,
    note: 'qaTestRuns history not counted in grandTotal — metadata only unless stale runs cancelled',
  };

  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  return report;
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
