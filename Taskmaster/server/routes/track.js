const deprecatedAutoMailerRoutes = require('./deprecatedAutoMailerRoutes');

const escapeHtmlAttr = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char]));

const decodeRedirectParam = (value) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || !raw.trim()) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const resolveSafeTrackedRedirectUrl = (destinationUrl, fallbackRedirect) => {
  const fallback = (() => {
    try {
      const parsed = new URL(fallbackRedirect || 'http://localhost:5173');
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : 'http://localhost:5173/';
    } catch {
      return 'http://localhost:5173/';
    }
  })();

  const decoded = decodeRedirectParam(destinationUrl).trim();
  if (!decoded) return fallback;

  try {
    const parsed = new URL(decoded, fallback);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : fallback;
  } catch {
    return fallback;
  }
};

module.exports = deprecatedAutoMailerRoutes;
module.exports.__private = {
  decodeRedirectParam,
  escapeHtmlAttr,
  resolveSafeTrackedRedirectUrl,
};
