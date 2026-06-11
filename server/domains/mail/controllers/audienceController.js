const {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
  listDataHubAudienceContacts,
  listDataHubAudienceFolders,
} = require('../services/campaignAudienceService');

exports.listExlyContacts = async (req, res) => {
  try {
    const { search = '', offeringId = 'all', limit } = req.query;
    const result = await listExlyAudienceContacts({ search, offeringId, limit });
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

exports.listDataHubContacts = async (req, res) => {
  try {
    const { search = '', folder = 'all', limit } = req.query;
    const result = await listDataHubAudienceContacts({ search, folder, limit });
    res.json(result);
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
