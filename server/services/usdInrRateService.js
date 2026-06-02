const axios = require('axios');
const { getCache, setCache } = require('./cacheService');

const CACHE_KEY = 'usd-inr-rate';
const CACHE_TTL_SECONDS = 3600;
const FRANKFURTER_URL = 'https://api.frankfurter.app/latest?from=USD&to=INR';

/** @type {{ data: object, expiresAt: number } | null} */
let memoryCache = null;
/** Last successful rate — kept for stale fallback after fetch failures */
let lastSuccessfulRate = null;

const getDevOverride = () => {
  const parsed = Number(process.env.USD_INR_RATE_OVERRIDE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const fetchFromFrankfurter = async () => {
  const res = await axios.get(FRANKFURTER_URL, { timeout: 10000 });
  const rate = res.data?.rates?.INR;
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid USD/INR rate from Frankfurter');
  }

  const asOf = res.data?.date
    ? new Date(`${res.data.date}T12:00:00.000Z`).toISOString()
    : new Date().toISOString();

  return { rate, asOf, source: 'frankfurter' };
};

const persistRate = async (payload) => {
  lastSuccessfulRate = payload;
  memoryCache = {
    data: payload,
    expiresAt: Date.now() + CACHE_TTL_SECONDS * 1000,
  };
  await setCache(CACHE_KEY, payload, CACHE_TTL_SECONDS);
};

const getUsdInrRate = async () => {
  const override = getDevOverride();
  if (override) {
    return {
      rate: override,
      asOf: new Date().toISOString(),
      source: 'override',
      cached: false,
      stale: false,
    };
  }

  const redisCached = await getCache(CACHE_KEY);
  if (redisCached?.rate) {
    return { ...redisCached, cached: true, stale: false };
  }

  if (memoryCache?.data?.rate && memoryCache.expiresAt > Date.now()) {
    return { ...memoryCache.data, cached: true, stale: false };
  }

  try {
    const fresh = await fetchFromFrankfurter();
    const payload = {
      rate: fresh.rate,
      asOf: fresh.asOf,
      source: fresh.source,
      fetchedAt: new Date().toISOString(),
    };
    await persistRate(payload);
    return { ...payload, cached: false, stale: false };
  } catch (error) {
    if (lastSuccessfulRate?.rate) {
      return { ...lastSuccessfulRate, cached: true, stale: true };
    }
    throw error;
  }
};

module.exports = { getUsdInrRate };
