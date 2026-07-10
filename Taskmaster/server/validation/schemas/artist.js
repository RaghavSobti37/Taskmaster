const { z } = require('zod');
const { isSafePrimitive, isSafeShallowRecord } = require('./safeValues');

const isSafeOAuthCreds = (value) => (
  typeof value === 'object'
  && value !== null
  && !Array.isArray(value)
  && Object.values(value).every((entry) => isSafeShallowRecord(entry) || isSafePrimitive(entry))
);

const isSafeJsonArray = (value) => (
  Array.isArray(value)
  && value.every((item) => (
    typeof item === 'object'
    && item !== null
    && !Array.isArray(item)
    && Object.values(item).every(isSafePrimitive)
  ))
);

const artistBody = z.record(z.unknown()).refine(
  (body) => Object.entries(body).every(([key, value]) => {
    if (key === 'socials' || key === 'metadata') return isSafeShallowRecord(value);
    if (key === 'oauthCredentials') return isSafeOAuthCreds(value);
    if (key === 'events' || key === 'discography' || key === 'trackedVideos') return isSafeJsonArray(value);
    if (key === 'tags' || key === 'members') {
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
    }
    return isSafePrimitive(value);
  }),
  { message: 'Invalid input format' },
);

const artistEventBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every(isSafePrimitive),
  { message: 'Invalid input format' },
);

const artistConnectionParams = z.object({
  id: z.string().min(1),
  connectionId: z.string().min(1),
});

const trackedVideoBody = z.record(z.unknown()).refine(
  (body) => Object.values(body).every(isSafePrimitive),
  { message: 'Invalid input format' },
);

module.exports = {
  createArtistBody: artistBody,
  updateArtistBody: artistBody,
  injectEventBody: artistEventBody,
  artistConnectionParams,
  trackedVideoBody,
};
