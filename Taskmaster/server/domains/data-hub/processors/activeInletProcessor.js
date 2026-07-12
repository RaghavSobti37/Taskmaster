const { CONTACT_BYPASS } = require('../folderCache');

async function buildActiveAnalytics(result, { total, HubModel, query }) {
  const [inMailer, inExly, inCRM, multiInlet] = await Promise.all([
    HubModel.countDocuments({ ...query, inMailer: true }).setOptions(CONTACT_BYPASS),
    HubModel.countDocuments({ ...query, inExly: true }).setOptions(CONTACT_BYPASS),
    HubModel.countDocuments({ ...query, inCRM: true }).setOptions(CONTACT_BYPASS),
    HubModel.countDocuments({ ...query, isMultiInlet: true }).setOptions(CONTACT_BYPASS),
  ]);
  result.engagementFlags = [
    { label: 'Mail Engagement', count: inMailer },
    { label: 'Exly Purchases', count: inExly },
    { label: 'In CRM', count: inCRM },
    { label: 'Multi-Inlet', count: multiInlet },
  ];
  result.kpis = [
    { key: 'active', label: 'Active People', value: total },
    { key: 'mail', label: 'Mail Active', value: inMailer },
    { key: 'exly', label: 'Exly Active', value: inExly },
    { key: 'crm', label: 'CRM Active', value: inCRM },
  ];
}

module.exports = {
  buildActiveAnalytics,
};
