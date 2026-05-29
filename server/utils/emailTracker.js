const crypto = require('crypto');
const EmailLog = require('../models/EmailLog');

const prepareCampaignHTML = async (rawHtml, campaignId, leadEmail, baseUrl) => {
  const pixelId = crypto.randomBytes(16).toString('hex');
  const clickId = crypto.randomBytes(16).toString('hex');

  // Create matching logs
  await EmailLog.create({ campaignId, leadEmail, pixelId, clickId });

  let cleanBaseUrl = process.env.APP_BASE_URL || baseUrl || 'https://tsccoreknot.com';
  const useLocalTracking = process.env.TRACKING_USE_LOCAL === 'true';
  if (!useLocalTracking && (cleanBaseUrl.includes('localhost') || cleanBaseUrl.includes('127.0.0.1'))) {
    cleanBaseUrl = 'https://taskmaster-api.onrender.com';
  }
  cleanBaseUrl = cleanBaseUrl.replace(/\/$/, '');
  const unsubscribeUrl = `${cleanBaseUrl}/unsubscribe?email=${encodeURIComponent(leadEmail)}&campaignId=${campaignId}&recipientId=${pixelId}`;

  // Replace manual placeholders first, otherwise append a standard footer
  let processedHtml = rawHtml || '';
  if (processedHtml.includes('{{unsubscribe_url}}')) {
    processedHtml = processedHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
  } else if (!processedHtml.includes('/unsubscribe')) {
    const unsubscribeFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
      <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
      <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
    </div>`;
    processedHtml = processedHtml + unsubscribeFooter;
  }

  // Inject transparent 1x1 base64 open tracker pixel before closing body tag
  const trackingPixel = `<img src="${cleanBaseUrl}/api/track/open/${pixelId}.gif" width="1" height="1" alt="" style="display:none;" />`;
  processedHtml = processedHtml + trackingPixel;

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
