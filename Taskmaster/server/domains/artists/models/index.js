/** artists domain models — canonical re-exports from server/models */
module.exports = {
  Artist: require('../../../models/Artist'),
  ArtistAuth: require('../../../models/ArtistAuth'),
  ArtistConnection: require('../../../models/ArtistConnection'),
  ArtistMembership: require('../../../models/ArtistMembership'),
  ArtistMetrics: require('../../../models/ArtistMetrics'),
  ArtistPathResponse: require('../../../models/ArtistPathResponse'),
  ArtistSocialProfile: require('../../../models/ArtistSocialProfile'),
  ArtistAsset: require('../../../models/ArtistAsset'),
  ArtistReleaseCampaign: require('../../../models/ArtistReleaseCampaign'),
  ArtistRevenueSource: require('../../../models/ArtistRevenueSource'),
  ArtistAudienceSnapshot: require('../../../models/ArtistAudienceSnapshot'),
};
