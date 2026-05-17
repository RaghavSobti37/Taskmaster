const axios = require('axios');
const { getSpotifyAccessToken } = require('./spotifyTokenManager');

const fetchLiveAnalytics = async (artist) => {
  const spotifyArtistId = artist.oauthCredentials?.spotify?.artistId || '6L88xirodmbWYoZuvseUnc';
  const youtubeChannelId = artist.oauthCredentials?.youtube?.channelId || 'UCgRciTp6cVLeuHWe3jte_aQ';
  const metaAccountId = artist.oauthCredentials?.meta?.igAccountId || '78345277076';

  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID || "a00df9460cd5450b9e5fa6b672ddd458";
  const youtubeApiKey = process.env.YOUTUBE_API_KEY || "AIzaSyBT6YIoVSa0HKdHn9s3ZyYgMlutT2dzrGc";
  const metaUserToken = process.env.META_USER_TOKEN || "1681483182978051|THl2_o8w5ZadHDCpYBJDO2UsOrE";

  const [spotifyRes, youtubeRes, metaRes] = await Promise.allSettled([
    // 1. Spotify Web API Pipeline
    (async () => {
      const token = await getSpotifyAccessToken();
      let artistInfo = {};
      let tracks = [];

      try {
        const infoRes = await axios.get(`https://api.spotify.com/v1/artists/${spotifyArtistId}`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000
        });
        artistInfo = infoRes.data;
      } catch (err) {
        console.error('Spotify artist info fetch error:', err.message);
      }

      try {
        const searchRes = await axios.get(`https://api.spotify.com/v1/search`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: `artist:${artist.name || 'Harshad'}`, type: 'track', limit: 10 },
          timeout: 10000
        });
        tracks = searchRes.data?.tracks?.items || [];
      } catch (err) {
        console.error('Spotify track search fetch error:', err.message);
      }

      return { artistInfo, tracks };
    })(),

    // 2. YouTube Data API v3 Pipeline
    (async () => {
      if (!youtubeApiKey) throw new Error("YouTube API key unconfigured");
      const { data } = await axios.get(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${youtubeChannelId}&key=${youtubeApiKey}`,
        { timeout: 10000 }
      );
      if (!data.items?.length) throw new Error("YouTube Channel not found");
      const channel = data.items[0];
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
      let videoList = [];
      let externalVideoList = [];

      if (uploadsPlaylistId) {
        try {
          const playlistItems = await axios.get(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10&key=${youtubeApiKey}`,
            { timeout: 10000 }
          );
          const vidIds = playlistItems.data.items.map(item => item.contentDetails?.videoId).filter(Boolean);
          if (vidIds.length) {
            const vids = await axios.get(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${vidIds.join(',')}&key=${youtubeApiKey}`,
              { timeout: 10000 }
            );
            videoList = vids.data.items || [];
          }
        } catch (vidErr) {
          console.error("YouTube playlist items/videos error:", vidErr.message);
        }
      }

      // Batch fetch for tracked external videos
      const externalVidIds = (artist.trackedVideos || []).filter(v => !v.isNative).map(v => v.videoId).filter(Boolean);
      if (externalVidIds.length) {
        try {
          const batchIds = externalVidIds.slice(0, 50).join(',');
          const extVids = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batchIds}&key=${youtubeApiKey}`,
            { timeout: 10000 }
          );
          externalVideoList = extVids.data?.items || [];
        } catch (extErr) {
          console.error("YouTube external videos batch fetch error:", extErr.message);
        }
      }

      return { channel, videoList, externalVideoList };
    })(),

    // 3. Meta Graph API Pipeline
    (async () => {
      if (!metaUserToken) throw new Error("Meta access token unconfigured");
      let mediaData = [];
      let followersCount = null;

      try {
        const mediaRes = await axios.get(
          `https://graph.facebook.com/v19.0/${metaAccountId}/media?fields=id,caption,media_type,like_count,comments_count,shares,saves,permalink&access_token=${metaUserToken}`,
          { timeout: 10000 }
        );
        mediaData = mediaRes.data;
      } catch (err) {
        console.error('Meta media fetch error:', err?.response?.data?.error || err.message);
      }

      try {
        const infoRes = await axios.get(
          `https://graph.facebook.com/v19.0/${metaAccountId}?fields=followers_count&access_token=${metaUserToken}`,
          { timeout: 5000 }
        );
        if (infoRes.data?.followers_count != null) followersCount = infoRes.data.followers_count;
      } catch (err) {
        console.error('Meta account info fetch error:', err?.response?.data?.error || err.message);
      }

      return { media: mediaData, followers: followersCount };
    })()
  ]);

  return { spotifyRes, youtubeRes, metaRes };
};

module.exports = { fetchLiveAnalytics };
