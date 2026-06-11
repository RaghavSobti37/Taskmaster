/** 1×1 transparent GIF — same bytes as locked `server/routes/track.js`. */
export const TRACKING_PIXEL_GIF_BASE64 =
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

export const TRACKING_PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
} as const;
