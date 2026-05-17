const crypto = require('crypto');
const EmailLog = require('../models/EmailLog');

const prepareCampaignHTML = async (rawHtml, campaignId, leadEmail, baseUrl) => {
  const pixelId = crypto.randomBytes(16).toString('hex');
  const clickId = crypto.randomBytes(16).toString('hex');

  // Create matching logs
  await EmailLog.create({ campaignId, leadEmail, pixelId, clickId });

  const cleanBaseUrl = (process.env.APP_BASE_URL || baseUrl || 'http://localhost:5000').replace(/\/+$/, '');

  // Inject transparent 1x1 base64 layout tracker before closing body tag
  const trackingPixel = `<img src="${cleanBaseUrl}/api/track/open/${pixelId}.gif" width="1" height="1" alt="" style="display:none;" />`;
  let processedHtml = (rawHtml || '') + trackingPixel;

  // Regex match CTA anchors and inject click router proxy 
  const ctaRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
  processedHtml = processedHtml.replace(ctaRegex, (match, originalUrl, rest) => {
    if (originalUrl.includes('/api/track/')) return match;
    const trackingUrl = `${cleanBaseUrl}/api/track/click/${clickId}?redirect=${encodeURIComponent(originalUrl)}`;
    return `<a href="${trackingUrl}" ${rest}>`;
  });

  return { processedHtml, pixelId, clickId };
};

module.exports = { prepareCampaignHTML };
