const juice = require('juice');
const logger = require('./logger');
const { normalizeOutboundEmailHtml, wrapEmailShell } = require('./normalizeOutboundEmailHtml');
const { appendSignatureIfMissing } = require('./emailSignature');
const { stripUnsubscribe } = require('./emailContentUtils');
const { prepareCampaignHTML } = require('./emailTracker');
const { applyIndexedVariables } = require('./indexedTemplateVariables');
const { applyMergeTags, buildRecipientValues } = require('./mergeTags');
const { resolveTrackingApiBaseUrl, buildStaticUnsubscribePageUrl } = require('./trackingUrls');

const JUICE_RESET_CSS = `
  body, div, p, blockquote, h1, h2, h3, h4, h5, h6, span, td, th, table {
    margin: 0 !important;
    padding: 0 !important;
    padding-left: 0 !important;
    margin-left: 0 !important;
    text-indent: 0 !important;
    border-left: 0 !important;
  }
  ul, ol { margin: 0 !important; padding-left: 1.5em !important; }
`;

const inlineCss = (html) => {
  const hasNonQuillStyles = /<style[\s>]/i.test(html) && !/\.ql-|quill/i.test(html);
  if (!hasNonQuillStyles) return html;
  try {
    return juice(html, {
      extraCss: JUICE_RESET_CSS,
      applyStyleTags: true,
      removeStyleTags: true,
      preserveImportant: true,
    });
  } catch (err) {
    logger.warn('buildFinalEmailHtml', 'CSS inlining failed', { error: err.message });
    return html;
  }
};

const personalizeEmailContent = ({
  html,
  subject,
  recipient,
  leadDoc,
  variableMapping = {},
  variableFallbacks = {},
}) => {
  const mergeValues = buildRecipientValues(recipient, leadDoc);
  const fallbacks = variableFallbacks instanceof Map
    ? Object.fromEntries(variableFallbacks.entries())
    : (variableFallbacks || {});
  const mapping = variableMapping instanceof Map
    ? Object.fromEntries(variableMapping.entries())
    : (variableMapping || {});

  let htmlOut = applyMergeTags(html || '', mergeValues, fallbacks);
  let subjectOut = applyMergeTags(subject || '', mergeValues, fallbacks);

  if (Object.keys(mapping).length > 0) {
    const { resolveRowValues } = require('./indexedTemplateVariables');
    const indexedValues = resolveRowValues(recipient, mapping);
    htmlOut = applyIndexedVariables(htmlOut, indexedValues);
    subjectOut = applyIndexedVariables(subjectOut, indexedValues);
  }

  return { html: htmlOut, subject: subjectOut };
};

/**
 * Single pipeline: normalize → optional juice (raw HTML only) → normalize → signature → footer → tracking.
 */
const buildFinalEmailHtml = async ({
  html,
  includeSignature = true,
  signature = '',
  removeUnsubscribe = false,
  mode = 'preview',
  campaignId,
  leadEmail,
  trackingBaseUrl,
}) => {
  let out = html || '';

  if (removeUnsubscribe) {
    out = stripUnsubscribe(out);
  }

  out = normalizeOutboundEmailHtml(out);
  out = inlineCss(out);
  out = normalizeOutboundEmailHtml(out);

  if (includeSignature && signature) {
    const sig = normalizeOutboundEmailHtml(signature);
    out = appendSignatureIfMissing(out, sig);
    out = normalizeOutboundEmailHtml(out);
  }

  if (!removeUnsubscribe && !out.includes('/unsubscribe')) {
    const unsubscribeUrl = buildStaticUnsubscribePageUrl();
    const unsubscribeFooter = `<div style="margin:16px 0 0 0;padding:0;border-top:1px solid #eee;font-size:12px;color:#777;text-align:center;font-family:sans-serif;">
<p style="margin:4px 0;padding:0;">You are receiving this email because you opted in at our website or events.</p>
<p style="margin:4px 0;padding:0;">If you no longer wish to receive these emails, you can <a href="${unsubscribeUrl}" style="color:#ef4444;text-decoration:underline;">unsubscribe here</a>.</p>
</div>`;
    out = `${out}${unsubscribeFooter}`;
  }

  if (mode === 'live' && campaignId && leadEmail) {
    const baseUrl = trackingBaseUrl || resolveTrackingApiBaseUrl();
    const { processedHtml } = await prepareCampaignHTML(out, campaignId, leadEmail, baseUrl, {
      skipAutoFooter: true,
    });
    out = normalizeOutboundEmailHtml(processedHtml);
  } else {
    out = normalizeOutboundEmailHtml(out);
  }

  return wrapEmailShell(out);
};

const wrapPreviewDocument = (bodyHtml, { theme = 'light' } = {}) => {
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const color = theme === 'dark' ? '#f8fafc' : '#0f172a';
  const inner = (bodyHtml || '').trim();
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    body{margin:0;padding:16px;background:${bg};color:${color};}
  </style></head><body>${inner}</body></html>`;
};

module.exports = {
  buildFinalEmailHtml,
  personalizeEmailContent,
  wrapPreviewDocument,
  inlineCss,
};
