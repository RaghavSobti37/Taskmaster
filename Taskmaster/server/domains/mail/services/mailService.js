const logger = require('../../../utils/logger');

function movedToAutoMailerMailResult() {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return {
    success: false,
    service: 'auto-mailer',
    url: origin.endsWith('/campaigns') ? origin : `${origin}/campaigns`,
    message: 'Campaign email dispatch moved to Auto-Mailer',
  };
}

const sendCampaign = async (campaignId) => {
  logger.warn('mailService', 'Blocked CoreKnot campaign send; use Auto-Mailer', {
    campaignId: String(campaignId || ''),
  });
  return movedToAutoMailerMailResult();
};

const scanBounces = async () => {
  logger.warn('mailService', 'Blocked CoreKnot bounce scan; use Auto-Mailer');
  return [];
};

const updateEmailTags = async () => {
  logger.warn('mailService', 'Blocked CoreKnot campaign tag mutation; use Auto-Mailer');
};

const sendTestEmail = async () => {
  logger.warn('mailService', 'Blocked CoreKnot test email send; use Auto-Mailer');
  return movedToAutoMailerMailResult();
};

module.exports = {
  sendCampaign,
  scanBounces,
  updateEmailTags,
  movedToAutoMailerMailResult,
  sendTestEmail,
};
