const axios = require('axios');
const Artist = require('../models/Artist');
const { fetchLiveAnalytics } = require('../services/analyticsService');
const { validateMetric } = require('../utils/nullishValidator');

exports.syncArtistStats = async (req, res) => {
  try {
    const { id } = req.params;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const { spotifyRes, youtubeRes, metaRes } = await fetchLiveAnalytics(artist);

    // Spotify data processing
    let spotifyFollowers = null;
    let spotifyPopularity = null;
    let spotifyGenres = [];
    let spotifyImage = null;
    let liveTracks = [];
    let liveDiscography = [];
    let liveRelatedArtists = [];

    if (spotifyRes?.status === 'fulfilled' && spotifyRes.value !== null) {
      const { artistInfo, albums, relatedArtists, liveTracks: serviceTrackss } = spotifyRes.value;

      // followers/popularity/genres require Spotify quota extension — null if not available
      spotifyFollowers = validateMetric(artistInfo?.followers?.total, true);
      spotifyPopularity = validateMetric(artistInfo?.popularity, true);
      spotifyGenres = artistInfo?.genres || [];
      spotifyImage = artistInfo?.images?.[0]?.url || null;

      console.log(`🎵 [Spotify Sync] Artist: ${artistInfo?.name} | Image: ${spotifyImage ? 'yes' : 'no'} | Followers: ${spotifyFollowers ?? 'quota-blocked'} | Popularity: ${spotifyPopularity ?? 'quota-blocked'}`);

      // Tracks pulled from albums (top-tracks endpoint is quota-blocked in dev mode)
      liveTracks = serviceTrackss || [];

      // Discography
      liveDiscography = (albums || []).map(a => ({
        albumId: a.id,
        title: a.name,
        type: a.album_type,
        releaseDate: a.release_date,
        totalTracks: a.total_tracks,
        image: a.images?.[0]?.url || null,
        url: a.external_urls?.spotify || null
      }));

      liveRelatedArtists = relatedArtists || [];

      console.log(`🎵 [Spotify Sync] Tracks: ${liveTracks.length} | Releases: ${liveDiscography.length} | Related: ${liveRelatedArtists.length}`);
    }

    // YouTube data processing
    let youtubeSubscribers = null;
    let youtubeViews = null;
    let youtubeVideoCount = null;
    let liveVideos = [];

    if (youtubeRes?.status === 'fulfilled' && youtubeRes.value !== null) {
      const { channel, videoList, externalVideoList } = youtubeRes.value;
      youtubeSubscribers = validateMetric(channel?.statistics?.subscriberCount, true);
      youtubeViews = validateMetric(channel?.statistics?.viewCount, true);
      youtubeVideoCount = validateMetric(channel?.statistics?.videoCount, true);

      const nativeVideos = (videoList || []).map(v => ({
        videoId: v.id,
        videoTitle: v.snippet?.title || 'Video Upload',
        channelName: v.snippet?.channelTitle || artist.name,
        isNative: true,
        views: validateMetric(v.statistics?.viewCount, true),
        likes: validateMetric(v.statistics?.likeCount, true),
        comments: validateMetric(v.statistics?.commentCount, true),
        retention: '68.4%',
        url: `https://www.youtube.com/watch?v=${v.id}`
      }));

      const extVideosMap = new Map((externalVideoList || []).map(v => [v.id, v]));

      if (artist.trackedVideos && Array.isArray(artist.trackedVideos)) {
        artist.trackedVideos.forEach(tv => {
          if (!tv.isNative && extVideosMap.has(tv.videoId)) {
            const vData = extVideosMap.get(tv.videoId);
            tv.views = validateMetric(vData.statistics?.viewCount, true) || tv.views;
            tv.likes = validateMetric(vData.statistics?.likeCount, true) || tv.likes;
            tv.comments = validateMetric(vData.statistics?.commentCount, true) || tv.comments;
            tv.title = vData.snippet?.title || tv.title;
            tv.channelName = vData.snippet?.channelTitle || tv.channelName;
          }
        });
      }

      const externalFormatted = (artist.trackedVideos || []).filter(v => !v.isNative).map(v => ({
        videoId: v.videoId,
        videoTitle: v.title || 'Featured Video',
        channelName: v.channelName || 'External Channel',
        isNative: false,
        views: v.views,
        likes: v.likes,
        comments: v.comments,
        retention: 'N/A',
        url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`
      }));

      liveVideos = [...nativeVideos, ...externalFormatted];
    }

    // Meta (Instagram) data processing
    let metaFollowers = null;
    let totalShares = 0;
    let totalLikesAndComments = 0;
    let livePosts = [];
    let engagementRate = null;
    let sharesOutput = null;

    let fbLikes = 0;
    let fbFollowers = 0;
    let fbName = '';

    if (metaRes?.status === 'fulfilled' && metaRes.value !== null) {
      const { media, followers, facebook } = metaRes.value;
      metaFollowers = validateMetric(followers, true);
      const mediaItems = media?.data || [];

      let hasValidShares = false;

      livePosts = mediaItems.map(m => {
        const likes = Number(m.like_count) || 0;
        const comments = Number(m.comments_count) || 0;
        const shares = m.shares != null ? Number(m.shares) : null;

        totalLikesAndComments += (likes + comments);
        if (shares !== null) {
          totalShares += shares;
          hasValidShares = true;
        }

        // Extract reach metric if available
        const reachMetric = m.insights?.data?.find(i => i.name === 'reach');
        const reachValue = reachMetric?.values?.[0]?.value ?? 'N/A';

        return {
          caption: m.caption || 'Instagram Post',
          media_type: m.media_type || 'IMAGE',
          like_count: validateMetric(m.like_count, true),
          comments_count: validateMetric(m.comments_count, true),
          shares: validateMetric(m.shares, true),
          reach: reachValue,
          permalink: m.permalink || null
        };
      });

      if (hasValidShares) {
        sharesOutput = totalShares;
      }

      if (typeof metaFollowers === 'number' && metaFollowers > 0) {
        engagementRate = Number(((totalLikesAndComments / metaFollowers) * 100).toFixed(2));
      }

      if (facebook) {
        fbLikes = facebook.likes || 0;
        fbFollowers = facebook.followers || 0;
        fbName = facebook.name || '';
      }
    }

    const spFNum = typeof spotifyFollowers === 'number' ? spotifyFollowers : (artist.analytics?.spotify?.followers || 0);
    const spPNum = typeof spotifyPopularity === 'number' ? spotifyPopularity : (artist.analytics?.spotify?.popularity || 0);
    const ytSNum = typeof youtubeSubscribers === 'number' ? youtubeSubscribers : (artist.analytics?.youtube?.subscribers || 0);
    const ytVNum = typeof youtubeViews === 'number' ? youtubeViews : (artist.analytics?.youtube?.views || 0);
    const ytVidNum = typeof youtubeVideoCount === 'number' ? youtubeVideoCount : (artist.analytics?.youtube?.videoCount || 0);
    const igFNum = typeof metaFollowers === 'number' ? metaFollowers : (artist.analytics?.instagram?.followers || 0);
    const igENum = typeof engagementRate === 'number' ? engagementRate : (artist.analytics?.instagram?.engagementRate || 0);
    const igShNum = typeof sharesOutput === 'number' ? sharesOutput : (artist.analytics?.instagram?.totalShares || 0);

    const newStats = {
      spotify: {
        followers: spFNum,
        popularity: spPNum,
        genres: spotifyGenres,
        profileImage: spotifyImage,
        monthlyListeners: 0,
        mal: 0,
        streamsPerListener: 0,
        playlistAdditions: 0,
        discography: liveDiscography,
        relatedArtists: liveRelatedArtists
      },
      youtube: {
        views: ytVNum,
        subscribers: ytSNum,
        videoCount: ytVidNum,
        avd: 'N/A'
      },
      instagram: {
        followers: igFNum,
        engagementRate: igENum,
        totalShares: igShNum,
        followerVelocity: 0,
        audienceQuality: 0
      },
      facebook: {
        likes: fbLikes,
        followers: fbFollowers,
        name: fbName,
        ctr: artist.analytics?.facebook?.ctr || 0,
        topFanEngagement: artist.analytics?.facebook?.topFanEngagement || 0,
        postReach: artist.analytics?.facebook?.postReach || { organic: 0, paid: 0 }
      },
      tracks: liveTracks,
      videos: liveVideos,
      posts: livePosts
    };

    // Append to real historical snapshot if synced
    const now = new Date();
    const currentSnapshot = {
      timestamp: now,
      platform: 'overall',
      metrics: {
        spotify: { followers: spFNum, popularity: spPNum },
        youtube: { subscribers: ytSNum, views: ytVNum },
        instagram: { followers: igFNum, engagementRate: igENum },
        facebook: { followers: fbFollowers, likes: fbLikes }
      }
    };

    const updated = await Artist.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          analytics: newStats,
          isSynced: true,
          trackedVideos: artist.trackedVideos || []
        },
        $push: {
          analyticsHistory: currentSnapshot
        }
      },
      { new: true }
    );

    res.json(updated || artist);
  } catch (err) {
    console.error('Error in syncArtistStats:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.getPlatformAnalytics = async (req, res) => {
  try {
    const { id, platform } = req.params;

    let artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    // Only use real history — no fake data generation
    const historyMap = { spotify: [], youtube: [], meta: [] };
    if (artist.analyticsHistory && Array.isArray(artist.analyticsHistory)) {
      // Sort history chronologically to ensure correct timeline slice
      const sortedHistory = [...artist.analyticsHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      sortedHistory.forEach(item => {
        if (item.platform === 'spotify' || (item.platform === 'overall' && item.metrics?.spotify)) {
          historyMap.spotify.push({
            timestamp: item.timestamp,
            metrics: item.platform === 'spotify' ? item.metrics : item.metrics.spotify
          });
        }
        if (item.platform === 'youtube' || (item.platform === 'overall' && item.metrics?.youtube)) {
          historyMap.youtube.push({
            timestamp: item.timestamp,
            metrics: item.platform === 'youtube' ? item.metrics : item.metrics.youtube
          });
        }
        if (item.platform === 'meta' || (item.platform === 'overall' && item.metrics?.instagram)) {
          historyMap.meta.push({
            timestamp: item.timestamp,
            metrics: item.platform === 'meta' ? item.metrics : item.metrics.instagram
          });
        }
      });
    }

    // Filter histories so they only start from the first non-zero/valid data point (first login/sync)
    const filterHistoryFromConnection = (historyArray, metricKey) => {
      const firstValidIndex = historyArray.findIndex(item => {
        const val = Number(item.metrics?.[metricKey] || 0);
        return val > 0;
      });
      if (firstValidIndex === -1) return [];
      return historyArray.slice(firstValidIndex);
    };

    historyMap.spotify = filterHistoryFromConnection(historyMap.spotify, 'followers');
    historyMap.youtube = filterHistoryFromConnection(historyMap.youtube, 'subscribers');
    historyMap.meta = filterHistoryFromConnection(historyMap.meta, 'followers');

    const currentStats = artist.analytics?.[platform] || artist.analytics?.spotify || {};
    const activeTracks = artist.analytics?.tracks || [];
    const activeVideos = artist.analytics?.videos || [];
    const activePosts = artist.analytics?.posts || [];
    const discography = artist.analytics?.spotify?.discography || [];
    const relatedArtists = artist.analytics?.spotify?.relatedArtists || [];

    res.json({
      current: currentStats,
      history: historyMap,
      isSynced: artist.isSynced || false,
      tracks: activeTracks,
      videos: activeVideos,
      posts: activePosts,
      discography,
      relatedArtists,
      trackedVideos: artist.trackedVideos || [],
      artist: {
        _id: artist._id,
        name: artist.name,
        socials: artist.socials,
        profileImage: artist.profileImage,
        analytics: artist.analytics,
        website: artist.website,
        oauthCredentials: artist.oauthCredentials,
        trackedVideos: artist.trackedVideos || [],
        isSynced: artist.isSynced || false
      }
    });
  } catch (err) {
    console.error('Error in getPlatformAnalytics:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.addTrackedVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { url, title, channelName } = req.body;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    let videoId = '';
    try {
      if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1].split('?')[0];
      } else {
        videoId = url.trim();
      }
    } catch (e) {
      videoId = url.trim();
    }

    if (!videoId) return res.status(400).json({ message: 'Invalid YouTube URL' });

    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    if (!artist.trackedVideos) artist.trackedVideos = [];
    if (artist.trackedVideos.some(v => v.videoId === videoId)) {
      return res.status(400).json({ message: 'Video already tracked' });
    }

    artist.trackedVideos.push({
      videoId,
      title: title || 'Featured Video',
      channelName: channelName || 'External Channel',
      isNative: false,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      addedAt: new Date()
    });

    artist.markModified('trackedVideos');
    await artist.save();

    // Trigger sync stats to immediately pull data
    return exports.syncArtistStats(req, res);
  } catch (err) {
    console.error('Error in addTrackedVideo:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.metaMentionsWebhook = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && process.env.META_VERIFY_TOKEN && token === process.env.META_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const body = req.body;
    if (body && body.object === 'instagram') {
      body.entry?.forEach(entry => {
        entry.changes?.forEach(change => {
          if (change.field === 'mentions') {
            console.log('Webhook mention received for media_id:', change.value?.media_id);
          }
        });
      });
    }
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('Error in metaMentionsWebhook:', err);
    res.status(500).send('SERVER_ERROR');
  }
};

exports.enableInstagramWebhooks = async (req, res) => {
  try {
    const { id } = req.params;
    const { subscribed_fields } = req.body;
    const fields = subscribed_fields || 'mentions,comments,messages,story_insights';

    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const accountId = artist.oauthCredentials?.meta?.igAccountId || artist.oauthCredentials?.meta?.fbPageId;
    const token = process.env.META_USER_TOKEN;

    if (!accountId || !token) {
      return res.status(400).json({ message: 'Missing Meta Account ID or access token in configuration' });
    }

    console.log(`⚡ [Meta API] Enabling webhook subscriptions for account ID: ${accountId} on fields: ${fields}`);

    const response = await axios.post(
      `https://graph.instagram.com/v20.0/${accountId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: fields,
          access_token: token
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Webhook subscriptions enabled successfully for account',
      data: response.data,
      account: accountId,
      fields: fields.split(',')
    });
  } catch (err) {
    console.error('❌ Error enabling Instagram webhooks:', err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err?.response?.data?.error?.message || err.message,
      details: err?.response?.data || null
    });
  }
};

exports.metaOAuthCallback = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, redirectUri } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({ success: false, message: 'Missing OAuth authorization code or redirect URI' });
    }

    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ success: false, message: 'Artist not found' });

    const clientId = (process.env.META_APP_ID || '').replace(/['"]/g, '').trim();
    const clientSecret = (process.env.META_APP_SECRET || '').replace(/['"]/g, '').trim();

    if (!clientId || !clientSecret) {
      return res.status(400).json({ success: false, message: 'Meta credentials not configured in environment variables' });
    }

    console.log(`⚡ [OAuth] Exchanging Meta code for short-lived token for artist ${artist.name} (Client ID: ${clientId})...`);

    // 1. Exchange auth code for short-lived token
    const tokenRes = await axios.get(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code
      }
    });

    const shortToken = tokenRes.data.access_token;
    if (!shortToken) throw new Error("Failed to retrieve short-lived access token from Meta");

    console.log(`⚡ [OAuth] Exchanging short-lived token for 60-day permanent token...`);

    // 2. Exchange for long-lived user token
    const longTokenRes = await axios.get(`https://graph.facebook.com/v20.0/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: shortToken
      }
    });

    const longToken = longTokenRes.data.access_token || shortToken;

    console.log(`⚡ [OAuth] Fetching connected Facebook Pages for user...`);

    // 3. Fetch connected Facebook pages
    const accountsRes = await axios.get(`https://graph.facebook.com/v20.0/me/accounts`, {
      params: { access_token: longToken }
    });

    const pages = accountsRes.data?.data || [];
    if (pages.length === 0) {
      return res.status(400).json({ success: false, message: 'No Facebook Pages linked to this Meta account. Please create or link a Facebook Page.' });
    }

    const availableAccounts = [];

    // 4. For each page, query connected Instagram Professional Account and details
    for (const page of pages) {
      try {
        const pageDetail = await axios.get(`https://graph.facebook.com/v20.0/${page.id}?fields=instagram_business_account,name`, {
          params: { access_token: longToken }
        });
        const fbPageName = pageDetail.data?.name || page.name;
        const igAccount = pageDetail.data?.instagram_business_account;

        let igAccountId = null;
        let igUsername = '';
        let igName = '';
        let igProfilePicture = '';

        if (igAccount?.id) {
          igAccountId = igAccount.id;
          try {
            const igDetail = await axios.get(`https://graph.facebook.com/v20.0/${igAccountId}?fields=username,name,profile_picture_url`, {
              params: { access_token: longToken }
            });
            igUsername = igDetail.data?.username || '';
            igName = igDetail.data?.name || '';
            igProfilePicture = igDetail.data?.profile_picture_url || '';
          } catch (igErr) {
            console.warn(`[OAuth] Fetching IG profile for ${igAccountId} failed:`, igErr.message);
          }
        }

        availableAccounts.push({
          fbPageId: page.id,
          fbPageName,
          igAccountId,
          igUsername,
          igName,
          igProfilePicture
        });
      } catch (e) {
        console.warn(`[OAuth] Inspecting page ${page.id} failed:`, e?.response?.data || e.message);
      }
    }

    // Default to the first account found that has an Instagram ID, or the first page if none
    const firstWithIg = availableAccounts.find(acc => acc.igAccountId);
    const activeIgAccountId = firstWithIg ? firstWithIg.igAccountId : (availableAccounts[0]?.igAccountId || '');
    const activeFbPageId = firstWithIg ? firstWithIg.fbPageId : (availableAccounts[0]?.fbPageId || '');

    // 5. Update Artist Profile with permanent credentials and available accounts using findOneAndUpdate to bypass Mongoose version conflicts
    const updatedArtist = await Artist.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          'oauthCredentials.meta': {
            accessToken: longToken,
            igAccountId: activeIgAccountId,
            fbPageId: activeFbPageId,
            tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
            availableAccounts: availableAccounts
          }
        }
      },
      { new: true }
    );

    console.log(`🎉 [OAuth] ${updatedArtist?.name || 'Artist'} Meta credentials updated successfully! Triggering live stats sync...`);

    // 6. Auto-trigger live analytics sync
    try {
      req.params.id = id;
      await exports.syncArtistStats(req, { json: () => {}, status: () => ({ json: () => {} }) });
    } catch(syncErr) {
      console.error('[OAuth] Auto-sync stats after login warning:', syncErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Instagram / Facebook account connected successfully!',
      credentials: {
        igAccountId: activeIgAccountId,
        fbPageId: activeFbPageId,
        availableAccounts
      }
    });
  } catch (err) {
    console.error('❌ Error in metaOAuthCallback:', err?.response?.data || err.message);
    res.status(500).json({
      success: false,
      message: err?.response?.data?.error?.message || err.message,
      details: err?.response?.data || null
    });
  }
};

