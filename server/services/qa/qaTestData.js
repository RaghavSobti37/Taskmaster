const Lead = require('../../models/Lead');
const Contact = require('../../models/Contact');
const CRMAudit = require('../../models/CRMAudit');
const Log = require('../../models/Log');

const BYPASS = { bypassTenant: true };

/** Emails created by automated QA probes (qa-*@example.com / qa-*@test.com). */
const QA_EMAIL_PATTERN = /^qa-[a-z0-9-]+@(example\.com|test\.com)$/i;

/** Names prefixed by QA integration / sanitization probes. */
const QA_NAME_PATTERN = /^QA /i;

const QA_SOURCE_PATTERN = /qa integration|qa test/i;

function isQaTestEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return QA_EMAIL_PATTERN.test(normalized) || (normalized.startsWith('qa-') && normalized.includes('@'));
}

function isQaTestRecord({ name, email, source } = {}) {
  if (isQaTestEmail(email)) return true;
  if (name && QA_NAME_PATTERN.test(String(name).trim())) return true;
  if (source && QA_SOURCE_PATTERN.test(String(source))) return true;
  return false;
}

/** Mongo filter: leads/contacts created by QA automation. */
function buildQaTestDataFilter() {
  return {
    $or: [
      { email: { $regex: /^qa-/i } },
      { name: { $regex: /^QA /i } },
      { source: { $regex: QA_SOURCE_PATTERN } },
    ],
  };
}

/** Exclude QA probe rows from Data Hub "All Data" and folder counts. */
function buildDataHubExcludeFilter() {
  return {
    $nor: [
      { email: { $regex: /^qa-/i } },
      { name: { $regex: /^QA /i } },
    ],
  };
}

async function purgeQaTestData() {
  const filter = buildQaTestDataFilter();
  const leadIds = await Lead.find(filter).setOptions(BYPASS).select('_id').lean();
  const ids = leadIds.map((l) => l._id);

  const [contacts, audits, leads, logs] = await Promise.all([
    Contact.deleteMany(filter).setOptions(BYPASS),
    ids.length ? CRMAudit.deleteMany({ leadId: { $in: ids } }).setOptions(BYPASS) : { deletedCount: 0 },
    Lead.deleteMany(filter).setOptions(BYPASS),
    Log.deleteMany({
      $or: [
        { action: 'QA_TEST' },
        { module: 'QA_TESTING' },
        { origin: 'QA_AGENT_TEST' },
        { 'details.title': { $regex: /^QA /i } },
      ],
    }).setOptions(BYPASS),
  ]);

  return {
    deleted: {
      contacts: contacts.deletedCount || 0,
      leads: leads.deletedCount || 0,
      audits: audits.deletedCount || 0,
      logs: logs.deletedCount || 0,
    },
  };
}

async function purgeQaIdentity({ email, phone } = {}) {
  const clauses = [];
  if (email) clauses.push({ email: String(email).trim().toLowerCase() });
  if (phone) clauses.push({ phone });
  if (!clauses.length) return;

  const match = clauses.length === 1 ? clauses[0] : { $or: clauses };
  const leads = await Lead.find(match).setOptions(BYPASS).select('_id').lean();
  const leadIds = leads.map((l) => l._id);

  await Promise.all([
    Contact.deleteMany(match).setOptions(BYPASS),
    leadIds.length ? CRMAudit.deleteMany({ leadId: { $in: leadIds } }).setOptions(BYPASS) : Promise.resolve(),
    Lead.deleteMany(match).setOptions(BYPASS),
  ]);
}

module.exports = {
  isQaTestEmail,
  isQaTestRecord,
  buildQaTestDataFilter,
  buildDataHubExcludeFilter,
  purgeQaTestData,
  purgeQaIdentity,
};
