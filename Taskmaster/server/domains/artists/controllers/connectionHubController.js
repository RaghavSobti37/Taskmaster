const {
  buildConnectionHub,
  getConnectionHealthSummary,
  syncPlatformAnalytics,
  saveManualProfile,
} = require('../services/connectionHubService');

exports.getConnectionHub = async (req, res) => {
  try {
    const hub = await buildConnectionHub(req.params.id);
    if (!hub) return res.status(404).json({ message: 'Artist not found' });
    res.json(hub);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.syncPlatformConnection = async (req, res) => {
  try {
    const result = await syncPlatformAnalytics(req.params.id, req.params.platform);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

exports.getConnectionHealth = async (req, res) => {
  try {
    const summary = await getConnectionHealthSummary(req.params.id);
    if (!summary) return res.status(404).json({ message: 'Artist not found' });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.saveManualConnection = async (req, res) => {
  try {
    const { accountName } = req.body || {};
    const result = await saveManualProfile(req.params.id, req.params.platform, { accountName });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};
