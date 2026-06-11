const Lead = require('../../../models/Lead');
const CRMAudit = require('../../../models/CRMAudit');
const EMI = require('../../../models/EMI');
const User = require('../../../models/User');
const ContactService = require('../../../services/ContactService');
const { buildDataHubExcludeFilter } = require('../../../services/qa/qaTestData');
const { resolveLeadInletKey } = require('../queryHelpers');

async function reconcileLeads(leads, { primaryName, email, phone, contact: initialContact }) {
  let contact = initialContact;
  for (const lead of leads) {
    const inletKey = resolveLeadInletKey(lead);
    contact = await ContactService.mergeContact({
      name: lead.name || primaryName,
      email: lead.email || email,
      phone: lead.phone || phone,
      city: lead.city,
      leadStatus: lead.leadStatus,
      leadQuality: lead.leadQuality,
      emailStatus: lead.emailStatus,
      unsubscribed: lead.unsubscribed,
      unsubscribeReason: lead.unsubscribeReason,
      recordId: lead._id,
      summary: { source: lead.source, leadStatus: lead.leadStatus, callStatus: lead.callStatus },
    }, inletKey === 'booked_calls' ? 'booked_calls' : inletKey === 'artist_crm' ? 'artist_crm' : 'crm');
  }
  return contact;
}

async function loadCrmSection(match) {
  const leads = await Lead.find(match).sort({ updatedAt: -1 }).lean();
  const leadIds = leads.map((l) => l._id);
  const [audits, emis, reps] = await Promise.all([
    leadIds.length ? CRMAudit.find({ leadId: { $in: leadIds } }).sort({ timestamp: -1 }).limit(50).lean() : [],
    leadIds.length ? EMI.find({ leadId: { $in: leadIds } }).sort({ dueDate: 1 }).lean() : [],
    (async () => {
      const repIds = [...new Set(leads.map((l) => String(l.assignedRepId)).filter(Boolean))];
      if (!repIds.length) return {};
      const users = await User.find({ _id: { $in: repIds } }).select('name email').lean();
      return Object.fromEntries(users.map((u) => [String(u._id), u]));
    })(),
  ]);
  return { section: 'crm', crm: { leads, audits, emis, reps } };
}

function appendLeadTimeline(leads) {
  return leads.map((lead) => ({
    type: 'lead',
    date: lead.updatedAt || lead.createdAt,
    label: `Lead: ${lead.leadStatus}`,
    data: lead,
  }));
}

async function buildLeadsAnalytics(result, { total, weekAgo }) {
  const qaExclude = buildDataHubExcludeFilter();
  const leadMatch = { $match: qaExclude };
  const [funnel, callStatus, sources, quality, connect, newWeek, converted] = await Promise.all([
    Lead.aggregate([leadMatch, { $group: { _id: '$leadStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Lead.aggregate([leadMatch, { $group: { _id: '$callStatus', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Lead.aggregate([leadMatch, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
    Lead.aggregate([leadMatch, { $group: { _id: '$leadQuality', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    Lead.aggregate([leadMatch, { $group: { _id: '$meaningfulConnect', count: { $sum: 1 } } }]),
    Lead.countDocuments({ ...qaExclude, createdAt: { $gte: weekAgo } }),
    Lead.countDocuments({ ...qaExclude, leadStatus: { $regex: /convert/i } }),
  ]);
  const leadTotal = await Lead.countDocuments(qaExclude);
  const connectYes = connect.find((c) => c._id === 'YES')?.count || 0;
  result.funnel = funnel;
  result.callStatus = callStatus;
  result.sources = sources;
  result.quality = quality;
  result.meaningfulConnect = connect;
  result.kpis = [
    { key: 'people', label: 'People in CRM', value: total },
    { key: 'total', label: 'Lead records', value: leadTotal },
    { key: 'newWeek', label: 'New This Week', value: newWeek },
    { key: 'connected', label: 'Meaningful Connect', value: connectYes },
    {
      key: 'conversion',
      label: 'Conversion Rate',
      value: leadTotal ? Math.round((converted / leadTotal) * 100) : 0,
      format: 'percent',
    },
  ];
}

module.exports = {
  reconcileLeads,
  loadCrmSection,
  appendLeadTimeline,
  buildLeadsAnalytics,
};
