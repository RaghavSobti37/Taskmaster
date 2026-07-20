const autoMailerTrackingUrl = () => {
  const origin = String(process.env.AUTO_MAILER_URL || 'https://auto-mailer-blue.vercel.app').replace(/\/+$/, '');
  return origin.endsWith('/analytics') ? origin : `${origin}/analytics`;
};

/** Historical helper retained for preview compatibility; CoreKnot no longer injects tracking pixels. */
const injectOpenPixel = (html) => html || '';

const prepareCampaignHTML = async (rawHtml) => ({
  processedHtml: rawHtml || '',
  pixelId: null,
  clickId: null,
  moved: true,
  service: 'auto-mailer',
  url: autoMailerTrackingUrl(),
  message: 'Campaign tracking moved to Auto-Mailer',
});

module.exports = { prepareCampaignHTML, injectOpenPixel };
