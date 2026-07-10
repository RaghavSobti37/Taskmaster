const MAX_PUSH_SUBSCRIPTIONS = 5;

/** Normalize userAgent into a stable bucket (OS + browser family). */
const normalizeUserAgentBucket = (userAgent = '') => {
  const ua = String(userAgent).toLowerCase();

  let browser = 'unknown';
  if (ua.includes('edg/')) browser = 'edge';
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'chrome';
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/') && !ua.includes('crios/')) browser = 'safari';

  let os = 'unknown';
  if (ua.includes('android')) os = 'android';
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'ios';
  else if (ua.includes('windows')) os = 'windows';
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'mac';
  else if (ua.includes('linux')) os = 'linux';

  return `${os}:${browser}`;
};

const sortByNewest = (subs) =>
  [...subs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

/** Keep newest subscription per userAgent bucket, then hard-cap total. */
const dedupePushSubscriptions = (subscriptions = []) => {
  const sorted = sortByNewest(subscriptions);
  const bucketMap = new Map();
  const kept = [];

  for (const sub of sorted) {
    const bucket = normalizeUserAgentBucket(sub.userAgent);
    if (bucketMap.has(bucket)) continue;
    bucketMap.set(bucket, true);
    kept.push(sub);
  }

  return kept.slice(0, MAX_PUSH_SUBSCRIPTIONS);
};

/** Add/replace a subscription and prune stale duplicates. */
const prunePushSubscriptions = (existing = [], newSub) => {
  const withoutEndpoint = existing.filter((s) => s.endpoint !== newSub.endpoint);
  return dedupePushSubscriptions([...withoutEndpoint, newSub]);
};

module.exports = {
  MAX_PUSH_SUBSCRIPTIONS,
  normalizeUserAgentBucket,
  dedupePushSubscriptions,
  prunePushSubscriptions,
};
