/** Share link helpers for artist profile / workspace preview */

export function buildShareMessage(artistName, url) {
  const name = String(artistName || 'this artist').trim() || 'this artist';
  return `Check out ${name} on CoreKnot:\n${url}`;
}

export function buildWhatsAppShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export function buildEmailShareUrl(subject, body) {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Prefer public slug URL, then API token link, then bare preview path */
export function resolveArtistShareUrl({ origin, artistId, artistSlug, apiUrl }) {
  if (apiUrl) return apiUrl;
  const base = String(origin || '').replace(/\/$/, '');
  const slug = String(artistSlug || '').trim();
  if (slug) return `${base}/artist/${slug}`;
  if (artistId) return `${base}/preview/artist/${artistId}`;
  return base || '/';
}
