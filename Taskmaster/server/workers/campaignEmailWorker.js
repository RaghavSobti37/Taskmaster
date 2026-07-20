const logger = require('../utils/logger');

const initCampaignEmailWorker = () => {
  logger.info('campaignEmailWorker', 'Disabled: campaign email dispatch moved to Auto-Mailer');
  return null;
};

module.exports = { initCampaignEmailWorker };
