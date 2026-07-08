const {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
} = require('../services/campaignAudienceService');
const { resolveCampaignEngagementByEmails } = require('../services/campaignEngagementService');
const { sendJson } = require('../../../utils/httpRespond');

exports.listExlyContacts = async (req, res) => {
  try {
    const { search = '', offeringId = 'all', limit, engagement = 'all' } = req.query;
    const result = await listExlyAudienceContacts({ search, offeringId, limit, engagement });
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 200, result);
  } catch (err) {
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 500, { error: err.message });
  }
};

exports.listExlyOfferings = async (req, res) => {
  try {
    const offerings = await listExlyAudienceOfferings();
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 200, { offerings });
  } catch (err) {
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 500, { error: err.message });
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
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 200, result);
  } catch (err) {
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 500, { error: err.message });
  }
};

exports.resolveAudienceEngagement = async (req, res) => {
  try {
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const engagement = await resolveCampaignEngagementByEmails(emails);
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 200, { engagement });
  } catch (err) {
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 500, { error: err.message });
  }
};

exports.listDataHubFolders = async (req, res) => {
  try {
    const result = await listDataHubAudienceFolders();
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 200, result);
  } catch (err) {
    if (req.timedOut || res.headersSent) return;
    sendJson(res, 500, { error: err.message });
  }
};
