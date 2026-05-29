const geoip = require('geoip-lite');

const isValidDisplayCity = (name) => {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || /^unknown(\s+city|location)?$/i.test(t)) return false;
  if (/^[A-Z]{2}$/.test(t)) return false;
  return true;
};

const isEmailImageProxy = (userAgent = '') =>
  /GoogleImageProxy|ggpht\.com|YahooMailProxy/i.test(userAgent);

/** Gmail/open pixel loads from Google infrastructure — not reader location. */
const isGoogleInfrastructureIp = (ip = '') => {
  const n = normalizeIp(ip);
  return /^(66\.249\.|64\.233\.|72\.14\.|209\.85\.|216\.239\.|172\.217\.|142\.250\.)/.test(n);
};

const normalizeIp = (ip = '') => {
  if (!ip) return '';
  let value = String(ip);
  if (value.includes(',')) value = value.split(',')[0].trim();
  if (value.startsWith('::ffff:')) value = value.substring(7);
  return value;
};

/** Best-effort client IP from Express req (Render, proxies, local). */
const extractClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = normalizeIp(forwarded);
    if (first) return first;
  }
  const alt = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'];
  if (alt) return normalizeIp(alt);
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
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

const lookupGeoAsync = async (ip) => {
  const sync = lookupGeoSync(ip);
  if (sync.city) return sync;

  const normalized = sync.ip;
  if (!normalized || normalized === '127.0.0.1') return sync;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=status,city,regionName,countryCode`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    if (data?.status === 'success' && data.city) {
      return {
        city: data.city,
        region: data.regionName || null,
        country: data.countryCode || null,
        ip: normalized,
      };
    }
  } catch {
    /* keep sync result */
  }
  return sync;
};

const eventIp = (evt) => evt?.ipAddress || evt?.metadata?.ip || null;

/** Resolve city for Open/Click — uses stored city, metadata string, or IP re-lookup. */
const resolveMailEventCity = (evt) => {
  const ip = eventIp(evt);
  if (evt?.eventType === 'Open' && (isEmailImageProxy(evt.userAgent) || isGoogleInfrastructureIp(ip))) {
    return null;
  }

  const stored = evt?.location?.city;
  if (isValidDisplayCity(stored)) return stored.trim();

  if (isValidDisplayCity(evt?.metadata?.city)) return String(evt.metadata.city).trim();

  if (typeof evt?.metadata?.location === 'string') {
    const first = evt.metadata.location.split(',')[0].trim();
    if (isValidDisplayCity(first)) return first;
  }

  if (ip) {
    const geo = lookupGeoSync(ip);
    if (isValidDisplayCity(geo.city)) return geo.city.trim();
  }

  return null;
};

const resolveMailEventCityAsync = async (evt, ipCache = new Map()) => {
  const sync = resolveMailEventCity(evt);
  if (sync) return sync;

  if (evt?.eventType === 'Open') return null;

  const ip = eventIp(evt);
  if (!ip || isGoogleInfrastructureIp(ip)) return null;

  if (!ipCache.has(ip)) ipCache.set(ip, lookupGeoAsync(ip));
  const geo = await ipCache.get(ip);
  return isValidDisplayCity(geo?.city) ? geo.city.trim() : null;
};

module.exports = {
  isValidDisplayCity,
  isEmailImageProxy,
  isGoogleInfrastructureIp,
  normalizeIp,
  extractClientIp,
  eventIp,
  lookupGeoSync,
  lookupGeoAsync,
  resolveMailEventCity,
  resolveMailEventCityAsync,
};
