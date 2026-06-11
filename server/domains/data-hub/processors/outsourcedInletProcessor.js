const OutsourcedRecord = require('../../../models/OutsourcedRecord');
const ContactService = require('../../../services/ContactService');
const { isCommunityText } = require('../../../../shared/dataInlets');
const { CONTACT_BYPASS } = require('../folderCache');

async function reconcileOutsourcedRows(outsourced, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const row of outsourced) {
    const isCommunity = isCommunityText(row.campaign) || isCommunityText(row.originSource);
    contact = await ContactService.mergeContact({
      name: row.name || primaryName,
      email: row.email || email,
      phone: row.phone || phone,
      city: row.city,
      sourceFilename: row.sourceFilename,
      emailStatus: row.emailStatus,
      recordId: row._id,
      summary: { campaign: row.campaign, originSource: row.originSource, role: row.role },
      inletKey: isCommunity ? 'community' : 'outsourced',
    }, isCommunity ? 'community' : 'outsourced');
  }
  return contact;
}

async function loadOutsourcedSection(match) {
  const rows = await OutsourcedRecord.find(match).sort({ createdAt: -1 }).lean();
  return { section: 'outsourced', outsourced: { rows } };
}

function appendOutsourcedTimeline(outsourced) {
  return outsourced.map((row) => ({
    type: 'outsourced',
    date: row.createdAt,
    label: `Outsourced: ${row.campaign || row.originSource || 'import'}`,
    data: row,
  }));
}

async function buildOutsourcedAnalytics(result, { total, HubModel }) {
  const [topCampaigns, topSources, roles, emailBreakdown, outTotal, withEmail, withPhone, crmLinked] = await Promise.all([
    OutsourcedRecord.aggregate([{ $group: { _id: '$campaign', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    OutsourcedRecord.aggregate([{ $group: { _id: '$originSource', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    OutsourcedRecord.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    OutsourcedRecord.aggregate([{ $group: { _id: '$emailStatus', count: { $sum: 1 } } }]),
    OutsourcedRecord.countDocuments({}),
    OutsourcedRecord.countDocuments({ email: { $nin: [null, ''] } }),
    OutsourcedRecord.countDocuments({ phone: { $nin: [null, ''] } }),
    HubModel.countDocuments({ $or: [{ inOutsourced: true }, { inTsc: true }], inCRM: true }).setOptions(CONTACT_BYPASS),
  ]);
  result.topCampaigns = topCampaigns;
  result.topSources = topSources;
  result.roles = roles;
  result.emailBreakdown = emailBreakdown;
  result.kpis = [
    { key: 'records', label: 'Outsourced Records', value: outTotal },
    { key: 'withEmail', label: 'Has Email', value: withEmail },
    { key: 'withPhone', label: 'Has Phone', value: withPhone },
    {
      key: 'crmLinked',
      label: 'Also in CRM',
      value: outTotal ? Math.round((crmLinked / Math.max(total, 1)) * 100) : 0,
      format: 'percent',
    },
  ];
}

module.exports = {
  reconcileOutsourcedRows,
  loadOutsourcedSection,
  appendOutsourcedTimeline,
  buildOutsourcedAnalytics,
};
