const {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
} = require('../services/campaignAudienceService');
const { resolveCampaignEngagementByEmails } = require('../services/campaignEngagementService');

exports.listExlyContacts = async (req, res) => {
  try {
    const { search = '', offeringId = 'all', limit, engagement = 'all' } = req.query;
    const result = await listExlyAudienceContacts({ search, offeringId, limit, engagement });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listExlyOfferings = async (req, res) => {
  try {
    const offerings = await listExlyAudienceOfferings();
    res.json({ offerings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function parseInletQueryList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(',');
  return items.map((s) => s.trim()).filter(Boolean);
}

exports.listDataHubContacts = async (req, res) => {
  try {
    const {
      search = '',
      folder = 'all',
      includeInlets,
      excludeInlets,
      limit,
      engagement = 'all',
    } = req.query;
    const result = await listDataHubAudienceContacts({
      search,
      folder,
      includeInlets: parseInletQueryList(includeInlets),
      excludeInlets: parseInletQueryList(excludeInlets),
      limit,
      engagement,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resolveAudienceEngagement = async (req, res) => {
  try {
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const engagement = await resolveCampaignEngagementByEmails(emails);
    res.json({ engagement });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listDataHubFolders = async (req, res) => {
  try {
    const result = await listDataHubAudienceFolders();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
