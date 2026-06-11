import { geoLookup } from './legacy-bridge';

const {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  extractClientIp,
  lookupGeoAsync,
  lookupGeoSync,
  lookupGeoForClick,
} = geoLookup;

/** Express-compatible req shape for locked `extractClientIp`. */
export interface TrackingRequestLike {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}

export function buildTrackingRequestLike(job: {
  clientIp?: string;
  userAgent: string;
  forwardedFor?: string;
  realIp?: string;
}): TrackingRequestLike {
  return {
    ip: job.clientIp,
    headers: {
      'user-agent': job.userAgent,
      'x-forwarded-for': job.forwardedFor,
      'x-real-ip': job.realIp,
    },
  };
}

export function isAntiSpamBot(userAgent: string): boolean {
  if (!userAgent) return false;
  if (isEmailImageProxy(userAgent)) return false;
  if (/AppleMail/i.test(userAgent)) return false;
  return isEmailLinkScanner(userAgent);
}

export async function buildEventLocation(
  req: TrackingRequestLike,
  userAgent: string,
  options: {
    skipProxyGeo?: boolean;
    enrich?: boolean;
    clickGeo?: boolean;
  } = {},
) {
  const ip = extractClientIp(req);

  if (options.clickGeo && isEmailLinkScanner(userAgent)) {
    return { city: null, region: null, country: null, ip, untrusted: true };
  }

  let raw = options.clickGeo
    ? await lookupGeoForClick(ip)
    : options.enrich
      ? await lookupGeoAsync(ip)
      : lookupGeoSync(ip);

  if (options.skipProxyGeo && isEmailImageProxy(userAgent)) {
    return {
      city: null,
      region: raw.region,
      country: raw.country,
      ip: raw.ip,
    };
  }
  if (raw.untrusted) {
    return {
      city: null,
      region: raw.region,
      country: raw.country,
      ip: raw.ip,
    };
  }
  if (raw.city && !isValidDisplayCity(raw.city)) {
    return { ...raw, city: null };
  }
  return raw;
}

export function mailEventGeoPayload(location: {
  city?: string | null;
  country?: string | null;
  ip?: string;
}) {
  const city = isValidDisplayCity(location?.city)
    ? String(location.city).trim()
    : undefined;
  const country = location?.country || undefined;
  return {
    ipAddress: location?.ip || undefined,
    location: city || country ? { city, country } : undefined,
  };
}

export function locationIncForCity(
  city: string | null | undefined,
  field: string,
): Record<string, number> {
  if (!isValidDisplayCity(city)) return {};
  const cleanCity = String(city).replace(/\./g, '');
  return { [`locationBreakdown.${cleanCity}.${field}`]: 1 };
}

export function isGmailProxyOpen(
  req: TrackingRequestLike,
  userAgent: string,
): boolean {
  return (
    isEmailImageProxy(userAgent) ||
    isGoogleInfrastructureIp(extractClientIp(req))
  );
}

export {
  isValidDisplayCity,
  isEmailImageProxy,
  isEmailLinkScanner,
  isGoogleInfrastructureIp,
  extractClientIp,
};
