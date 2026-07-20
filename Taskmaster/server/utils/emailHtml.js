const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

function textToHtml(value = '') {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br />');
}

function safeHref(value = '', fallback = '#') {
  const raw = String(value || fallback || '').trim();
  const safeFallback = String(fallback || '#').trim() || '#';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return escapeHtml(safeFallback);
    return escapeHtml(url.toString());
  } catch (error) {
    return escapeHtml(safeFallback);
  }
}

module.exports = {
  escapeHtml,
  textToHtml,
  safeHref,
};
