const models = require('./models');
const { enrichArtistById, enrichAllArtists } = require('./services/artistEnrichmentService');
const {
  upsertConnection,
  getCredentialsForSync,
  getConnectionsForArtist,
} = require('./services/connectionService');
const { getSpotifyAccessToken } = require('./services/spotifyTokenManager');
const { processArtistEnquiryLogic } = require('./services/artistEnquiryService');
const { INTEGRATIONS } = require('../../config/integrations.config');

/** Cross-domain artist entry points. Prefer these over direct model imports outside domains/artists. */
module.exports = {
  ...models,
  enrichArtistById,
  enrichAllArtists,
  upsertConnection,
  getCredentialsForSync,
  getConnectionsForArtist,
  getSpotifyAccessToken,
  processArtistEnquiryLogic,
  INTEGRATIONS,
};
