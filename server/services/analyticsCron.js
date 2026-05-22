const Artist = require('../models/Artist');
const { fetchLiveAnalytics } = require('./analyticsService');

async function syncArtistAnalyticsJob() {
  const artists = await Artist.find({ 
    $or: [
      { 'oauthCredentials.youtube.channelId': { $exists: true } },
      { 'oauthCredentials.spotify.artistId': { $exists: true } }
    ]
  });

  for (const artist of artists) {
    try {
      const { spotifyRes, youtubeRes, metaRes } = await fetchLiveAnalytics(artist);

      const dailySnapshot = {
        timestamp: new Date(),
        platform: 'overall',
        metrics: {
          youtube: youtubeRes?.status === 'fulfilled' ? youtubeRes.value : null,
          spotify: spotifyRes?.status === 'fulfilled' ? spotifyRes.value : null,
          meta: metaRes?.status === 'fulfilled' ? metaRes.value : null
        }
      };

      await Artist.findByIdAndUpdate(artist._id, {
        $push: { analyticsHistory: dailySnapshot },
        $set: { 
          'analytics.youtube.subscribers': youtubeRes?.value?.channel?.statistics?.subscriberCount || 0,
          'analytics.spotify.followers': spotifyRes?.value?.artistInfo?.followers?.total || 0,
        }
      });
    } catch (err) {
      console.error(`Sync failed for artist ${artist._id}:`, err);
    }
  }
}

module.exports = { syncArtistAnalyticsJob };
