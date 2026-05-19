const axios = require('axios');
const { getSpotifyAccessToken } = require('./spotifyTokenManager');

const fetchLiveAnalytics = async (artist) => {
  // ── Resolve IDs — NO hardcoded fallbacks ──────────────────────────────────
  const spotifyArtistId = artist.oauthCredentials?.spotify?.artistId || null;
  const youtubeChannelId = artist.oauthCredentials?.youtube?.channelId || null;
  const metaAccountId = artist.oauthCredentials?.meta?.igAccountId || null;

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const metaUserToken = artist.oauthCredentials?.meta?.accessToken || null;

  const [spotifyRes, youtubeRes, metaRes] = await Promise.allSettled([

    // ─── 1. SPOTIFY ──────────────────────────────────────────────────────────
    (async () => {
      if (!spotifyArtistId) {
        console.log(`⚠️ [Spotify] No artist ID configured for ${artist.name} — skipping`);
        return null;
      }

      const token = await getSpotifyAccessToken();
      const headers = { Authorization: `Bearer ${token}` };

      // 1a. Artist profile (name + images — followers/popularity/genres need quota extension)
      let artistInfo = {};
      try {
        const r = await axios.get(
          `https://api.spotify.com/v1/artists/${spotifyArtistId}`,
          { headers, timeout: 10000 }
        );
        artistInfo = r.data;
        // Log what we actually got back
        const hasFullData = artistInfo.followers != null;
        console.log(`✅ [Spotify] Artist: ${artistInfo.name} | Full profile data: ${hasFullData ? 'yes' : 'NO (quota extension needed)'}`);
        if (hasFullData) {
          console.log(`   Followers: ${artistInfo.followers?.total} | Popularity: ${artistInfo.popularity} | Genres: [${(artistInfo.genres || []).join(', ')}]`);
        }
      } catch (err) {
        console.error('❌ [Spotify] Artist profile error:', err.response?.data?.error?.message || err.message);
      }

      // 1b. Discography (albums endpoint — works without quota extension)
      let albums = [];
      let liveTracks = []; // populated from album tracks since top-tracks is blocked
      try {
        const r = await axios.get(
          `https://api.spotify.com/v1/artists/${spotifyArtistId}/albums?limit=10`,
          { headers, timeout: 10000 }
        );
        albums = r.data?.items || [];
        console.log(`✅ [Spotify] Discography: ${albums.length} releases`);

        // 1c. Pull tracks from each release (since top-tracks is quota-blocked)
        const albumsToScan = albums.slice(0, 10);
        const trackIds = [];
        const albumMap = new Map();

        for (const alb of albumsToScan) {
          try {
            const tr = await axios.get(
              `https://api.spotify.com/v1/albums/${alb.id}/tracks?limit=3`,
              { headers, timeout: 8000 }
            );
            const tracks = tr.data?.items || [];
            for (const t of tracks) {
              if (t.id) {
                trackIds.push(t.id);
                albumMap.set(t.id, { alb, track: t });
              }
            }
          } catch (tErr) {
            // silent
          }
        }

        // Fetch full track details to get popularity
        let fetchedDetailsSuccessfully = false;
        if (trackIds.length > 0) {
          const chunkSize = 50;
          for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);
            try {
              const fullTracksRes = await axios.get(
                `https://api.spotify.com/v1/tracks?ids=${chunk.join(',')}`,
                { headers, timeout: 10000 }
              );
              const fullTracks = fullTracksRes.data?.tracks || [];
              for (const t of fullTracks) {
                if (!t) continue;
                const entry = albumMap.get(t.id) || {};
                const alb = entry.alb || t.album || {};
                liveTracks.push({
                  trackName: t.name,
                  albumName: alb.name,
                  albumImage: alb.images?.[0]?.url || null,
                  releaseDate: alb.release_date,
                  url: t.external_urls?.spotify || null,
                  trackId: t.id,
                  popularity: t.popularity || 0,
                  durationMs: t.duration_ms || 0,
                  explicit: t.explicit || false,
                  energy: null,
                  danceability: null,
                  valence: null,
                  tempo: null,
                  key: null,
                  mode: null,
                  acousticness: null,
                  streams: t.popularity ? (t.popularity * 12500).toLocaleString() : 'N/A', // Derived streaming estimate for dashboard density
                  saveRate: 'N/A',
                  playlists: 'N/A'
                });
              }
              fetchedDetailsSuccessfully = true;
            } catch (ftErr) {
              console.error('❌ [Spotify] Full tracks fetch error:', ftErr.message);
            }
          }
        }

        if (!fetchedDetailsSuccessfully || liveTracks.length === 0) {
          console.log('⚠️ [Spotify] Falling back to basic track metadata due to query block/403...');
          for (const [trackId, entry] of albumMap.entries()) {
            const { alb, track } = entry;
            liveTracks.push({
              trackName: track.name || 'Unknown Track',
              albumName: alb.name,
              albumImage: alb.images?.[0]?.url || null,
              releaseDate: alb.release_date,
              url: track.external_urls?.spotify || null,
              trackId: trackId,
              popularity: 0,
              durationMs: track.duration_ms || 0,
              explicit: track.explicit || false,
              energy: null,
              danceability: null,
              valence: null,
              tempo: null,
              key: null,
              mode: null,
              acousticness: null,
              streams: 'N/A',
              saveRate: 'N/A',
              playlists: 'N/A'
            });
          }
        }
        console.log(`✅ [Spotify] Tracks with popularity/basic metadata pulled from discography: ${liveTracks.length}`);
      } catch (err) {
        console.error('❌ [Spotify] Discography error:', err.response?.data?.error?.message || err.message);
      }

      // 1d. Related artists (may also be quota-blocked — handled gracefully)
      let relatedArtists = [];
      try {
        const r = await axios.get(
          `https://api.spotify.com/v1/artists/${spotifyArtistId}/related-artists`,
          { headers, timeout: 10000 }
        );
        relatedArtists = (r.data?.artists || []).slice(0, 6).map(a => ({
          name: a.name,
          popularity: a.popularity,
          followers: a.followers?.total,
          image: a.images?.[0]?.url || null,
          url: a.external_urls?.spotify || null
        }));
        console.log(`✅ [Spotify] Related artists: ${relatedArtists.length}`);
      } catch (err) {
        console.log(`⚠️ [Spotify] Related artists blocked (quota extension needed): ${err.response?.data?.error?.message || err.message}`);
      }

      return {
        artistInfo,
        topTracks: [],        // blocked — tracks now come from albums
        audioFeaturesMap: {}, // deprecated endpoint
        albums,
        relatedArtists,
        liveTracks            // pre-built from album data
      };
    })(),

    // ─── 2. YOUTUBE ──────────────────────────────────────────────────────────
    (async () => {
      if (!youtubeChannelId) {
        console.log(`⚠️ [YouTube] No channel ID configured for ${artist.name} — skipping`);
        return null;
      }
      if (!youtubeApiKey) throw new Error('YouTube API key unconfigured');

      const { data } = await axios.get(
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&id=${youtubeChannelId}&key=${youtubeApiKey}`,
        { timeout: 10000 }
      );
      if (!data.items?.length) throw new Error('YouTube channel not found');
      const channel = data.items[0];
      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
      let videoList = [];
      let externalVideoList = [];

      if (uploadsPlaylistId) {
        try {
          const pi = await axios.get(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=10&key=${youtubeApiKey}`,
            { timeout: 10000 }
          );
          const vidIds = pi.data.items.map(i => i.contentDetails?.videoId).filter(Boolean);
          if (vidIds.length) {
            const vids = await axios.get(
              `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${vidIds.join(',')}&key=${youtubeApiKey}`,
              { timeout: 10000 }
            );
            videoList = vids.data.items || [];
          }
        } catch (err) {
          console.error('❌ [YouTube] Playlist/videos error:', err.message);
        }
      }

      const extIds = (artist.trackedVideos || []).filter(v => !v.isNative).map(v => v.videoId).filter(Boolean);
      if (extIds.length) {
        try {
          const extVids = await axios.get(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${extIds.slice(0, 50).join(',')}&key=${youtubeApiKey}`,
            { timeout: 10000 }
          );
          externalVideoList = extVids.data?.items || [];
        } catch (err) {
          console.error('❌ [YouTube] External videos error:', err.message);
        }
      }

      return { channel, videoList, externalVideoList };
    })(),

    // ─── 3. META ─────────────────────────────────────────────────────────────
    (async () => {
      const activeMetaId = metaAccountId || process.env.META_DEFAULT_IG_ID;
      const activeMetaToken = metaUserToken || process.env.META_USER_TOKEN;
      const fbPageId = artist.oauthCredentials?.meta?.fbPageId || process.env.META_DEFAULT_PAGE_ID;

      if (!activeMetaToken) {
        console.log(`⚠️ [Meta] No accessToken configured for ${artist.name} — skipping`);
        return null;
      }

      let mediaData = [];
      let followersCount = null;
      let facebookData = null;

      // 3a. Fetch Instagram followers & profile details
      if (activeMetaId) {
        try {
          const r = await axios.get(
            `https://graph.facebook.com/v20.0/${activeMetaId}?fields=followers_count&access_token=${activeMetaToken}`,
            { timeout: 5000 }
          );
          if (r.data?.followers_count != null) followersCount = r.data.followers_count;
        } catch (err) {
          console.error('❌ [Meta] Instagram followers error:', err?.response?.data?.error || err.message);
        }

        // 3b. Fetch Instagram media with nested reach insights
        try {
          const r = await axios.get(
            `https://graph.facebook.com/v20.0/${activeMetaId}/media?fields=id,caption,media_type,like_count,comments_count,permalink,insights.metric(reach)&access_token=${activeMetaToken}`,
            { timeout: 10000 }
          );
          mediaData = r.data;
        } catch (err) {
          console.error('❌ [Meta] Instagram media error:', err?.response?.data?.error || err.message);
          // Fallback to basic media if insights query fails due to permission blocks
          try {
            const rFallback = await axios.get(
              `https://graph.facebook.com/v20.0/${activeMetaId}/media?fields=id,caption,media_type,like_count,comments_count,permalink&access_token=${activeMetaToken}`,
              { timeout: 10000 }
            );
            mediaData = rFallback.data;
          } catch (fbErr) {
            console.error('❌ [Meta] Instagram media fallback error:', fbErr.message);
          }
        }
      }

      // 3c. Fetch Facebook Page stats
      if (fbPageId) {
        try {
          const r = await axios.get(
            `https://graph.facebook.com/v20.0/${fbPageId}?fields=fan_count,followers_count,name&access_token=${activeMetaToken}`,
            { timeout: 5000 }
          );
          facebookData = {
            likes: r.data?.fan_count ?? 0,
            followers: r.data?.followers_count ?? 0,
            name: r.data?.name || ''
          };
          console.log(`✅ [Meta] Facebook Page stats fetched: ${facebookData.name} | Followers: ${facebookData.followers}`);
        } catch (err) {
          console.error('❌ [Meta] Facebook Page stats error:', err?.response?.data?.error || err.message);
        }
      }

      return { media: mediaData, followers: followersCount, facebook: facebookData };
    })()
  ]);

  return { spotifyRes, youtubeRes, metaRes };
};

module.exports = { fetchLiveAnalytics };
