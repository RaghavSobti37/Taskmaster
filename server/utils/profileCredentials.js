const mergeProviderCredentials = (existingMap, incoming) => {
  if (!incoming || typeof incoming !== 'object') return existingMap;
  const map = existingMap instanceof Map ? existingMap : new Map(Object.entries(existingMap || {}));
  for (const [key, cred] of Object.entries(incoming)) {
    if (!cred || typeof cred !== 'object') continue;
    const prev = map.get(key) || {};
    const merged = {
      smtpUser: cred.smtpUser?.trim() || prev.smtpUser || '',
      smtpPass: cred.smtpPass?.trim() || prev.smtpPass || '',
      enabled: cred.enabled !== false,
    };
    if (!merged.smtpPass) continue;
    map.set(key, merged);
  }
  return map;
};

module.exports = { mergeProviderCredentials };
