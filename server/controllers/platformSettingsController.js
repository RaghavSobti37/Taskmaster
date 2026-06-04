const {
  getAdminSettings,
  updateAdminSettings,
  getExclusionsForClient,
} = require('../services/platformSettingsService');
const logger = require('../utils/logger');

exports.getSettings = async (req, res) => {
  try {
    const data = await getAdminSettings();
    res.json(data);
  } catch (err) {
    logger.error('PlatformSettings', 'getSettings', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = await updateAdminSettings(req.body, req.user._id);
    res.json(data);
  } catch (err) {
    logger.error('PlatformSettings', 'updateSettings', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.getExclusions = async (req, res) => {
  try {
    const data = await getExclusionsForClient();
    res.json(data);
  } catch (err) {
    logger.error('PlatformSettings', 'getExclusions', { error: err.message });
    res.status(500).json({ error: err.message });
  }
};
