const geoip = require('geoip-lite');

const IP_API_FIELDS = 'status,city,regionName,countryCode,proxy,hosting,mobile';

const isValidDisplayCity = (name) => {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (!t || /^unknown(\s+city|location)?$/i.test(t)) return false;
  if (/^[A-Z]{2}$/.test(t)) return false;
  return true;
};

const isEmailImageProxy = (userAgent = '') =>
  /GoogleImageProxy|ggpht\.com|YahooMailProxy/i.test(userAgent);

/** Enterprise link scanners / bots — not the recipient's browser. */
const isEmailLinkScanner = (userAgent = '') => {
  if (!userAgent || userAgent === 'Unknown') return false;
  if (isEmailImageProxy(userAgent)) return true;
  return /safelinks|proofpoint|mimecast|barracuda|zscaler|url.?scan|linkpreview|microsoft office|outlook-ios|exchangewebservices|curl\/|wget\/|python-requests|go-http-client|java\/|okhttp|headlesschrome|phantomjs|\b(bot|bingpreview|facebookexternalhit)\b|crawl|spider|slurp|avast|eset|symantec|messagelabs|fireeye|forcepoint|ironport|spamhaus|bitdefender|trend micro|sophos|mcafee|cloudmark|mailguard|ess\.barracuda|protection\.outlook/i.test(userAgent);
};

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
  if (req?.ip) {
    const fromExpress = normalizeIp(req.ip);
    if (fromExpress && fromExpress !== '127.0.0.1' && fromExpress !== '::1') {
      return fromExpress;
    }
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = normalizeIp(forwarded);
    if (first) return first;
  }
  const alt = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'];
  if (alt) return normalizeIp(alt);
  return normalizeIp(req.ip || req.socket?.remoteAddress || '');
};

const fetchIpApi = async (normalized, fields = IP_API_FIELDS) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=${fields}`,
      { signal: ctrl.signal }
    );
    const data = await res.json();
    return data?.status === 'success' ? data : null;
  } finally {
    clearTimeout(timer);
  }
};

const lookupGeoSync = (ip) => {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1') {
    return { city: null, region: null, country: null, ip: normalized || '127.0.0.1' };
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
    const data = await fetchIpApi(normalized, 'status,city,regionName,countryCode');
    if (data?.city) {
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

/**
 * Click geo — always consult ip-api hosting/proxy flags.
 * geoip-lite alone maps datacenter IPs (Boardman, Palo Alto, etc.) to misleading cities.
 */
const lookupGeoForClick = async (ip) => {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1') {
    return { city: null, region: null, country: null, ip: normalized || '127.0.0.1', untrusted: true };
  }
  if (isGoogleInfrastructureIp(normalized)) {
    return { city: null, region: null, country: null, ip: normalized, untrusted: true };
  }

  try {
    const data = await fetchIpApi(normalized);
    if (data) {
      const untrusted = Boolean(data.hosting || data.proxy);
      const city = untrusted ? null : (data.city || null);
      return {
        city: isValidDisplayCity(city) ? city : null,
        region: data.regionName || null,
        country: data.countryCode || null,
        ip: normalized,
        untrusted,
      };
    }
  } catch {
    /* fall through */
  }

  return { city: null, region: null, country: null, ip: normalized, untrusted: true };
};

const eventIp = (evt) => evt?.ipAddress || evt?.metadata?.ip || null;

/** Resolve city for Open/Click — uses stored city, metadata string, or IP re-lookup. */
const resolveMailEventCity = (evt) => {
  const ip = eventIp(evt);
  if (evt?.eventType === 'Open' && (isEmailImageProxy(evt.userAgent) || isGoogleInfrastructureIp(ip))) {
    return null;
  }

  // Click stored cities may be datacenter geo — validated asynchronously only.
  if (evt?.eventType !== 'Click') {
    const stored = evt?.location?.city;
    if (isValidDisplayCity(stored)) return stored.trim();

    if (isValidDisplayCity(evt?.metadata?.city)) return String(evt.metadata.city).trim();

    if (typeof evt?.metadata?.location === 'string') {
      const first = evt.metadata.location.split(',')[0].trim();
      if (isValidDisplayCity(first)) return first;
    }
  }

  if (ip && evt?.eventType !== 'Click') {
    const geo = lookupGeoSync(ip);
    if (isValidDisplayCity(geo.city)) return geo.city.trim();
  }

  return null;
};

const resolveClickEventCity = async (evt, ipCache = new Map()) => {
  if (isEmailLinkScanner(evt.userAgent)) return null;
  const ip = eventIp(evt);
  if (!ip || isGoogleInfrastructureIp(ip)) return null;

  const cacheKey = `click:${normalizeIp(ip)}`;
  if (!ipCache.has(cacheKey)) ipCache.set(cacheKey, lookupGeoForClick(ip));
  const geo = await ipCache.get(cacheKey);
  if (geo.untrusted) return null;
  return isValidDisplayCity(geo?.city) ? geo.city.trim() : null;
};

const resolveMailEventCityAsync = async (evt, ipCache = new Map(), clickCityByEmail = null) => {
  if (evt?.eventType === 'Click') {
    return resolveClickEventCity(evt, ipCache);
  }

  const sync = resolveMailEventCity(evt);
  if (sync) return sync;

  if (evt?.eventType === 'Open') {
    const email = evt?.email?.toLowerCase()?.trim();
    if (email && clickCityByEmail?.get(email)) {
      return clickCityByEmail.get(email);
    }
    return null;
  }

  const ip = eventIp(evt);
  if (!ip || isGoogleInfrastructureIp(ip)) return null;

  if (!ipCache.has(ip)) ipCache.set(ip, lookupGeoAsync(ip));
  const geo = await ipCache.get(ip);
  return isValidDisplayCity(geo?.city) ? geo.city.trim() : null;
};

/** Resolve click cities per recipient email (used to infer Gmail open locations). */
const buildClickCityByEmail = async (events, ipCache = new Map()) => {
  const clicksByEmail = new Map();
  for (const evt of events) {
    if (evt.eventType !== 'Click' || !evt.email) continue;
    const email = evt.email.toLowerCase().trim();
    if (!clicksByEmail.has(email)) clicksByEmail.set(email, []);
    clicksByEmail.get(email).push(evt);
  }

  const map = new Map();
  for (const [email, clicks] of clicksByEmail) {
    for (const evt of clicks) {
      const city = await resolveClickEventCity(evt, ipCache);
      if (city) {
        map.set(email, city);
        break;
      }
    }
  }
  return map;
};

const FORBIDDEN_BREAKDOWN_LABELS = new Set(['unknown', 'unknown city', 'unknown location', 'unlocated']);

const normalizePlaceLabel = (raw) =>
  String(raw || '')
    .toLowerCase()
    .replace(/[().,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isForbiddenBreakdownLabel = (label) => {
  if (!label || typeof label !== 'string') return true;
  const normalized = normalizePlaceLabel(label);
  return !normalized || FORBIDDEN_BREAKDOWN_LABELS.has(normalized);
};

const capitalizePlaceLabel = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const formatBreakdownPlaceLabel = (geo) => {
  if (!geo) return null;
  if (isValidDisplayCity(geo.city)) return capitalizePlaceLabel(geo.city);
  const region = geo.region && String(geo.region).trim();
  const country = geo.country && String(geo.country).trim();
  if (region && country) {
    const combo = `${region}, ${country}`;
    if (!isForbiddenBreakdownLabel(combo)) return combo;
  }
  if (country && !isForbiddenBreakdownLabel(country)) {
    return country.length === 2 ? country.toUpperCase() : capitalizePlaceLabel(country);
  }
  return null;
};

const lookupPlaceLabelForBreakdown = async (ip, ipCache = new Map()) => {
  const normalized = normalizeIp(ip);
  if (!normalized || normalized === '127.0.0.1' || normalized === '::1') return null;

  const key = `bd:${normalized}`;
  if (!ipCache.has(key)) {
    ipCache.set(key, (async () => {
      try {
        const data = await fetchIpApi(normalized);
        if (data?.status === 'success') {
          const label = formatBreakdownPlaceLabel({
            city: data.city,
            region: data.regionName,
            country: data.countryCode,
          });
          if (label) return label;
        }
      } catch {
        /* fall through to geoip-lite */
      }
      return formatBreakdownPlaceLabel(lookupGeoSync(normalized));
    })());
  }
  return ipCache.get(key);
};

const storedCityFromEvent = (evt) => {
  if (isValidDisplayCity(evt?.location?.city)) return capitalizePlaceLabel(evt.location.city);
  if (isValidDisplayCity(evt?.metadata?.city)) return capitalizePlaceLabel(evt.metadata.city);
  if (typeof evt?.metadata?.location === 'string') {
    const first = evt.metadata.location.split(',')[0].trim();
    if (isValidDisplayCity(first)) return capitalizePlaceLabel(first);
  }
  return null;
};

/**
 * Resolve display city for campaign breakdown — IP geo first, never "Unknown".
 */
const resolveEventCityForBreakdown = async (evt, {
  crmCityMap = new Map(),
  clickCityByEmail = new Map(),
  ipPlaceMap = new Map(),
  ipCache = new Map(),
} = {}) => {
  const email = evt?.email?.toLowerCase()?.trim();
  const ip = normalizeIp(eventIp(evt));

  const stored = storedCityFromEvent(evt);
  if (stored && !isForbiddenBreakdownLabel(stored)) return stored;

  if (ip && ipPlaceMap.has(ip)) {
    const fromMap = ipPlaceMap.get(ip);
    if (fromMap && !isForbiddenBreakdownLabel(fromMap)) return fromMap;
  }

  if (ip) {
    const fromIp = await lookupPlaceLabelForBreakdown(ip, ipCache);
    if (fromIp && !isForbiddenBreakdownLabel(fromIp)) return fromIp;
  }

  if (evt?.eventType === 'Open' && email && clickCityByEmail.has(email)) {
    const inferred = clickCityByEmail.get(email);
    if (inferred && !isForbiddenBreakdownLabel(inferred)) return inferred;
  }

  if (email && crmCityMap.has(email)) {
    const crm = crmCityMap.get(email);
    if (crm && !isForbiddenBreakdownLabel(crm)) return crm;
  }

  const country = evt?.location?.country || evt?.metadata?.country;
  if (country) {
    const label = String(country).trim();
    if (label.length === 2) return label.toUpperCase();
    if (!isForbiddenBreakdownLabel(label)) return capitalizePlaceLabel(label);
  }

  if (ip) {
    const fallback = formatBreakdownPlaceLabel(lookupGeoSync(ip));
    if (fallback && !isForbiddenBreakdownLabel(fallback)) return fallback;
  }

  return 'Global';
};

const buildClickCityByEmailForBreakdown = async (events, ipPlaceMap, ipCache = new Map()) => {
  const map = new Map();
  for (const evt of events) {
    if (evt.eventType !== 'Click' || !evt.email) continue;
    const email = evt.email.toLowerCase().trim();
    if (map.has(email)) continue;
    const city = await resolveEventCityForBreakdown(evt, { ipPlaceMap, ipCache });
    if (city && !isForbiddenBreakdownLabel(city)) map.set(email, city);
  }
  return map;
};

const buildIpPlaceMap = async (events, ipCache = new Map()) => {
  const ips = new Set();
  for (const evt of events) {
    const ip = normalizeIp(eventIp(evt));
    if (ip && ip !== '127.0.0.1' && ip !== '::1') ips.add(ip);
  }

  const map = new Map();
  const list = [...ips];
  const BATCH = 15;
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const labels = await Promise.all(chunk.map((ip) => lookupPlaceLabelForBreakdown(ip, ipCache)));
    chunk.forEach((ip, idx) => {
      if (labels[idx]) map.set(ip, labels[idx]);
    });
    if (i + BATCH < list.length) {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  }
  return map;
};

module.exports = {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  normalizeIp,
  extractClientIp,
  eventIp,
  lookupGeoSync,
  lookupGeoAsync,
  lookupGeoForClick,
  resolveMailEventCity,
  resolveMailEventCityAsync,
  resolveClickEventCity,
  buildClickCityByEmail,
  isForbiddenBreakdownLabel,
  formatBreakdownPlaceLabel,
  lookupPlaceLabelForBreakdown,
  resolveEventCityForBreakdown,
  buildClickCityByEmailForBreakdown,
  buildIpPlaceMap,
  storedCityFromEvent,
};
