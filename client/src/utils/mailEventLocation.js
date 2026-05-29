export const isValidDisplayCity = (name) => {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || /^unknown(\s+city)?$/i.test(t)) return false;
  if (/^[A-Z]{2}$/.test(t)) return false;
  return true;
};

export const isEmailImageProxy = (userAgent = '') =>
  /GoogleImageProxy|ggpht\.com|YahooMailProxy/i.test(userAgent);

export const eventCityLabel = (evt) => {
  if (evt?.eventType === 'Open' && isEmailImageProxy(evt.userAgent)) return null;

  const candidates = [];
  if (evt?.location?.city) candidates.push(evt.location.city);
  if (evt?.metadata?.city) candidates.push(evt.metadata.city);
  if (typeof evt?.metadata?.location === 'string') {
    candidates.push(evt.metadata.location.split(',')[0].trim());
  }

  for (const c of candidates) {
    if (isValidDisplayCity(c)) return c.trim();
  }
  return null;
};
