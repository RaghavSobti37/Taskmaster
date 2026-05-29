const extractFirstName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return '';
  return fullName.trim().split(/\s+/)[0] || '';
};

const buildRecipientValues = (recipient, leadDoc) => {
  const fullName = (recipient?.name || leadDoc?.name || leadDoc?.firstName || '').trim();
  const firstname = extractFirstName(fullName);
  return {
    firstname,
    first_name: firstname,
    name: fullName,
  };
};

const mapFallbacks = (fallbacks) => {
  if (!fallbacks) return {};
  if (fallbacks instanceof Map) return Object.fromEntries(fallbacks.entries());
  return { ...fallbacks };
};

/** Replace {{var}} and {{var|fallback}} using recipient data + stored fallbacks */
const applyMergeTags = (text, values = {}, fallbacks = {}) => {
  if (!text) return text;
  const fb = mapFallbacks(fallbacks);
  return text.replace(/\{\{(\w+)(?:\|([^}]*))?\}\}/g, (match, key, inlineFallback) => {
    const k = key.toLowerCase();
    if (k === 'unsubscribe_url') return match;
    const val = values[k] ?? values[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val);
    }
    if (inlineFallback !== undefined && inlineFallback !== '') return inlineFallback;
    if (fb[k] || fb[key]) return fb[k] || fb[key];
    return '';
  });
};

module.exports = {
  extractFirstName,
  buildRecipientValues,
  applyMergeTags,
};
