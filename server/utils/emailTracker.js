const crypto = require('crypto');
const EmailLog = require('../models/EmailLog');
const {
  resolveTrackingApiBaseUrl,
  buildUnsubscribePageUrl,
  shouldSkipClickWrap
} = require('./trackingUrls');

const prepareCampaignHTML = async (rawHtml, campaignId, leadEmail, baseUrl, options = {}) => {
  const pixelId = crypto.randomBytes(16).toString('hex');

  await EmailLog.create({ campaignId, leadEmail, pixelId });

  const trackingBaseUrl = resolveTrackingApiBaseUrl();
  const unsubscribeUrl = buildUnsubscribePageUrl(campaignId, leadEmail, pixelId);

  let processedHtml = rawHtml || '';
  if (processedHtml.includes('{{unsubscribe_url}}')) {
    processedHtml = processedHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubscribeUrl);
  } else if (!options.skipAutoFooter && !processedHtml.includes('/unsubscribe')) {
    const unsubscribeFooter = `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; font-family: sans-serif;">
      <p style="margin: 4px 0;">You are receiving this email because you opted in at our website or events.</p>
      <p style="margin: 4px 0;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color: #ef4444; text-decoration: underline;">unsubscribe here</a>.</p>
    </div>`;
    processedHtml = processedHtml + unsubscribeFooter;
  }

  const trackingPixel = `<img src="${trackingBaseUrl}/api/track/open/${pixelId}.gif" width="1" height="1" alt="" style="display:none;" />`;
  processedHtml = processedHtml + trackingPixel;

  const ctaRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi;
  const linkClickIds = [];
  processedHtml = processedHtml.replace(ctaRegex, (match, originalUrl, rest) => {
    if (shouldSkipClickWrap(originalUrl)) return match;
    const linkClickId = crypto.randomBytes(16).toString('hex');
    linkClickIds.push(linkClickId);
    const trackingUrl = `${trackingBaseUrl}/api/track/click/${linkClickId}?redirect=${encodeURIComponent(originalUrl)}`;
    return `<a href="${trackingUrl}" ${rest}>`;
  });

  if (linkClickIds.length) {
    await EmailLog.insertMany(
      linkClickIds.map((clickId) => ({ campaignId, leadEmail, clickId }))
    );
  }

  return { processedHtml, pixelId, clickId: linkClickIds[0] || null };
};

module.exports = { prepareCampaignHTML };
