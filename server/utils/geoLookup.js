const geoip = require('geoip-lite');

const isValidDisplayCity = (name) => {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || /^unknown(\s+city)?$/i.test(t)) return false;
  if (/^[A-Z]{2}$/.test(t)) return false;
  return true;
};

const isEmailImageProxy = (userAgent = '') =>
  /GoogleImageProxy|ggpht\.com|YahooMailProxy/i.test(userAgent);

const normalizeIp = (ip = '') => {
  let value = ip;
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.startsWith('::ffff:')) value = value.substring(7);
  return value;
};

const lookupGeoSync = (ip) => {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1') {
    return { city: 'Mumbai', region: 'MH', country: 'IN', ip: normalized || '127.0.0.1' };
  }
  const geo = geoip.lookup(normalized);
  return {
    city: geo?.city || null,
    region: geo?.region || null,
    country: geo?.country || null,
    ip: normalized,
  };
};

/** ipwho.is fallback when geoip-lite has no city (clicks only — real browser IP). */
const lookupGeoAsync = async (ip) => {
  const sync = lookupGeoSync(ip);
  if (sync.city) return sync;

  const normalized = sync.ip;
  if (!normalized || normalized === '127.0.0.1') return sync;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`https://ipwho.is/${normalized}`, { signal: ctrl.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data?.success && data.city) {
      return {
        city: data.city,
        region: data.region_code || data.region || null,
        country: data.country_code || null,
        ip: normalized,
      };
    }
  } catch {
    /* keep sync result */
  }
  return sync;
};

/** City for click events — re-resolves from IP when stored city is bad (e.g. "IN"). Opens: null. */
const resolveMailEventCity = (evt) => {
  if (evt?.eventType !== 'Click') return null;

  const stored = evt?.location?.city || evt?.metadata?.city;
  if (isValidDisplayCity(stored)) return stored.trim();

  if (typeof evt?.metadata?.location === 'string') {
    const first = evt.metadata.location.split(',')[0].trim();
    if (isValidDisplayCity(first)) return first;
  }

  if (evt?.ipAddress) {
    const geo = lookupGeoSync(evt.ipAddress);
    if (isValidDisplayCity(geo.city)) return geo.city.trim();
  }

  return null;
};

module.exports = {
  isValidDisplayCity,
  isEmailImageProxy,
  normalizeIp,
  lookupGeoSync,
  lookupGeoAsync,
  resolveMailEventCity,
};
