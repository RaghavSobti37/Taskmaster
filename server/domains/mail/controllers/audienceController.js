const {
  listExlyAudienceContacts,
  listExlyAudienceOfferings,
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
