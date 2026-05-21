/**
 * YouTube OAuth flow for artist channels.
 * Uses Google OAuth 2.0 with YouTube Data API v3 scopes.
 *
 * Flow:
 *   1. GET  /api/artists/:id/auth/youtube        → redirect to Google login
 *   2. GET  /api/artists/auth/callback/youtube   → exchange code → save token
 */

const axios = require('axios');
const Artist = require('../models/Artist');

const CLIENT_ID     = process.env.YOUTUBE_CLIENT_ID?.replace(/['"]/g, '').trim();
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET?.replace(/['"]/g, '').trim();
const getRedirectUri = (req) => {
  if (process.env.YOUTUBE_OAUTH_REDIRECT_URI) return process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  // Handle production vs local fallback
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `http://${host}/api/artists/auth/callback/youtube`;
  }
  return `https://${host}/api/artists/auth/callback/youtube`;
};

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'profile',
  'email'
].join(' ');

/** Step 1: Redirect to Google auth */
exports.initiateYouTubeAuth = (req, res) => {
  const { id } = req.params;
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: id,
    access_type: 'offline',
    prompt: 'consent'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

/** Step 2: Google redirects back with ?code=...&state=artistId */
exports.youTubeAuthCallback = async (req, res) => {
  const { code, state: artistId, error } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL || (req.headers.host.includes('localhost') ? 'http://localhost:5173' : `https://${req.headers.host}`);
  const redirectUri = getRedirectUri(req);

  if (error) {
    console.error('❌ [YouTube OAuth] Error:', error);
    return res.redirect(`${CLIENT_URL}/artists/${artistId}?youtube_error=${error}`);
  }
  if (!code || !artistId) {
    return res.redirect(`${CLIENT_URL}/artists?youtube_error=missing_params`);
  }

  try {
    const artist = await Artist.findById(artistId);
    if (!artist) return res.redirect(`${CLIENT_URL}/artists?youtube_error=artist_not_found`);

    console.log(`⚡ [YouTube OAuth] Exchanging code for tokens for artist: ${artist.name}`);

    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch the YouTube channel to get channelId
    const channelRes = await axios.get(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const channel = channelRes.data.items?.[0];
    if (!channel) throw new Error('No YouTube channel found for this Google account');

    const channelId = channel.id;
    const channelTitle = channel.snippet?.title;
    console.log(`✅ [YouTube OAuth] Connected channel: ${channelTitle} (${channelId})`);
    console.log(`   Subscribers: ${channel.statistics?.subscriberCount} | Videos: ${channel.statistics?.videoCount}`);

    // Save to artist
    if (!artist.oauthCredentials) artist.oauthCredentials = {};
    artist.oauthCredentials.youtube = {
      ...artist.oauthCredentials.youtube,
      channelId,
      channelTitle,
      accessToken: access_token,
      refreshToken: refresh_token,
      tokenExpiry: new Date(Date.now() + expires_in * 1000),
      connectedAt: new Date()
    };

    artist.markModified('oauthCredentials');
    await artist.save();

    console.log(`🎉 [YouTube OAuth] Artist ${artist.name} YouTube connected! Triggering sync...`);

    // Auto-sync
    try {
      const { syncArtistStats } = require('./artistAnalyticsController');
      await syncArtistStats(
        { params: { id: artistId }, body: {} },
        { json: () => {}, status: () => ({ json: () => {} }) }
      );
    } catch (syncErr) {
      console.warn('[YouTube OAuth] Auto-sync warning:', syncErr.message);
    }

    res.redirect(`${CLIENT_URL}/artists/${artistId}?youtube_connected=true`);
  } catch (err) {
    console.error('❌ [YouTube OAuth] Error:', err?.response?.data || err.message);
    res.redirect(`${CLIENT_URL}/artists/${artistId}?youtube_error=${encodeURIComponent(err.message)}`);
  }
};
