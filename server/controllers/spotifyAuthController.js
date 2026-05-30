/**
 * Spotify OAuth flow for artist accounts.
 * Scope: user-read-private (profile), user-top-read (top tracks),
 *        user-read-recently-played, playlist-read-private
 *
 * Flow:
 *   1. GET  /api/artists/:id/auth/spotify        → redirect to Spotify login
 *   2. GET  /api/artists/auth/callback/spotify   → exchange code → save token
 */

const axios = require('axios');
const Artist = require('../models/Artist');
const { upsertConnection } = require('../services/connectionService');
const { Mutex } = require('async-mutex');
const logger = require('../utils/logger');

const tokenMutexes = new Map();

const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID?.replace(/['"]/g, '').trim();
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET?.replace(/['"]/g, '').trim();
const getRedirectUri = (req) => {
  if (process.env.SPOTIFY_OAUTH_REDIRECT_URI) return process.env.SPOTIFY_OAUTH_REDIRECT_URI;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  // Handle production vs local fallback
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `http://${host}/api/artists/auth/callback/spotify`;
  }
  return `https://${host}/api/artists/auth/callback/spotify`;
};

// Scopes — everything available to free Developer API
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-read-recently-played',
  'user-follow-read',
  'playlist-read-private',
  'playlist-read-collaborative'
].join(' ');

/** Step 1: Redirect artist browser to Spotify auth screen */
exports.initiateSpotifyAuth = (req, res) => {
  const { id } = req.params;  // artist MongoDB ID passed as state
  const redirectUri = getRedirectUri(req);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state: id,
    show_dialog: 'true'
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
};

/** Step 2: Spotify redirects back here with ?code=...&state=artistId */
exports.spotifyAuthCallback = async (req, res) => {
  const { code, state: artistId, error } = req.query;
  const CLIENT_URL = process.env.CLIENT_URL || (req.headers.host.includes('localhost') ? 'http://localhost:5173' : `https://${req.headers.host}`);
  const redirectUri = getRedirectUri(req);

  if (error) {
    logger.error('Spotify OAuth', '❌ [Spotify OAuth] User denied or ', { error: error.message || error });
    return res.redirect(`${CLIENT_URL}/artists/${artistId}?spotify_error=${error}`);
  }

  if (!code || !artistId) {
    return res.redirect(`${CLIENT_URL}/artists?spotify_error=missing_params`);
  }

  try {
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.redirect(`${CLIENT_URL}/artists?spotify_error=artist_not_found`);
    }

    // Exchange code for tokens
    logger.info('Spotify OAuth', '⚡ [Spotify OAuth] Exchanging code for tokens for artist: ${artist.name}');
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch the Spotify user profile to verify + get their artistId
    const profileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const profile = profileRes.data;
    logger.info('Spotify OAuth', `✅ Connected: ${profile.display_name} (${profile.id})`);

    const raw = await Artist.collection.findOne({ _id: artistId });
    const existingArtistId = raw?.oauthCredentials?.spotify?.artistId || '';

    await upsertConnection({
      artistId,
      provider: 'spotify',
      accountHandle: existingArtistId,
      accountLabel: profile.display_name || 'Spotify',
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      metadata: { spotifyUserId: profile.id, displayName: profile.display_name, artistId: existingArtistId },
    });

    logger.info('Spotify OAuth', `🎉 Artist ${artist.name} Spotify connected — syncing...`);

    // Auto-trigger sync
    try {
      const { syncArtistStats } = require('./artistAnalyticsController');
      await syncArtistStats(
        { params: { id: artistId }, body: {} },
        { json: () => {}, status: () => ({ json: () => {} }) }
      );
    } catch (syncErr) {
      logger.warn('Spotify OAuth', 'Auto-sync warning', { error: syncErr.message });
    }

    // Redirect back to artist page
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/artists/${artistId}?spotify_connected=true`);
  } catch (err) {
    logger.error('Spotify OAuth', 'Error', { error: err?.response?.data || err.message });
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/artists/${artistId}?spotify_error=${encodeURIComponent(err.message)}`);
  }
};

/** Refresh token if expired (Mutex Locked) */
exports.refreshSpotifyToken = async (artist) => {
  const refreshToken = artist.oauthCredentials?.spotify?.refreshToken;
  if (!refreshToken) throw new Error('No Spotify refresh token stored');

  const artistIdStr = artist._id.toString();
  if (!tokenMutexes.has(artistIdStr)) {
    tokenMutexes.set(artistIdStr, new Mutex());
  }
  const mutex = tokenMutexes.get(artistIdStr);
  const release = await mutex.acquire();

  try {
    // 1. Double check inside lock in case a concurrent request already refreshed it
    const freshArtist = await Artist.findById(artistIdStr).select('oauthCredentials');
    if (freshArtist.oauthCredentials?.spotify?.tokenExpiry > new Date(Date.now() + 60000)) {
      return freshArtist.oauthCredentials.spotify.accessToken;
    }

    // 2. Perform the actual refresh API call
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );

    const { access_token, expires_in } = res.data;
    artist.oauthCredentials.spotify.accessToken = access_token;
    artist.oauthCredentials.spotify.tokenExpiry = new Date(Date.now() + expires_in * 1000);
    artist.markModified('oauthCredentials');
    await artist.save();
    return access_token;
  } finally {
    release();
  }
};
