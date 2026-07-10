const jwt = require('jsonwebtoken');
const axios = require('axios');
const Artist = require('../../../models/Artist');
const { upsertConnection } = require('../services/connectionService');
const { byId } = require('../../../config/integrations.config');
const logger = require('../../../utils/logger');

const { resolveClientUrl, resolveOAuthRedirectUri } = require('../../../utils/oauthEnv');

function signOAuthState(artistId, provider) {
  return jwt.sign({ artistId, provider, purpose: 'oauth_connect' }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function verifyOAuthState(state) {
  return jwt.verify(state, process.env.JWT_SECRET);
}

function spotifyRedirectUri(req) {
  return resolveOAuthRedirectUri(req, {
    envVar: 'SPOTIFY_OAUTH_REDIRECT_URI',
    path: '/api/artists/auth/callback/spotify',
  });
}

function youtubeRedirectUri(req) {
  return resolveOAuthRedirectUri(req, {
    envVar: 'YOUTUBE_OAUTH_REDIRECT_URI',
    prodEnvVar: 'YOUTUBE_REDIRECT_URI_PROD',
    path: '/api/artists/auth/callback/youtube',
  });
}

const SPOTIFY_SCOPES = [
  'user-read-private', 'user-read-email', 'user-top-read',
  'user-read-recently-played', 'user-follow-read',
  'playlist-read-private', 'playlist-read-collaborative',
].join(' ');

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'profile', 'email',
].join(' ');

/** POST /api/auth/connect/:provider — returns auth URL */
exports.initiateConnect = async (req, res) => {
  try {
    const { provider } = req.params;
    const { artistId } = req.body;
    if (!artistId) return res.status(400).json({ message: 'artistId required' });

    const artist = await Artist.findById(artistId);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const config = byId(provider === 'meta' ? 'instagram' : provider);
    if (!config?.hasOAuth) {
      return res.status(400).json({ message: `Provider ${provider} does not support OAuth yet` });
    }

    const state = signOAuthState(artistId, provider);
    let authUrl;

    if (provider === 'spotify') {
      const clientId = process.env.SPOTIFY_CLIENT_ID?.replace(/['"]/g, '').trim();
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: SPOTIFY_SCOPES,
        redirect_uri: spotifyRedirectUri(req),
        state,
        show_dialog: 'true',
      });
      authUrl = `https://accounts.spotify.com/authorize?${params}`;
    } else if (provider === 'youtube') {
      const clientId = process.env.YOUTUBE_CLIENT_ID?.replace(/['"]/g, '').trim();
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: youtubeRedirectUri(req),
        scope: YOUTUBE_SCOPES,
        state,
        access_type: 'offline',
        prompt: 'consent',
      });
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else if (provider === 'instagram' || provider === 'meta') {
      const appId = (process.env.META_APP_ID || '').replace(/['"]/g, '').trim();
      if (!appId) {
        return res.status(503).json({ message: 'META_APP_ID not configured' });
      }
      const redirectUri = `${resolveClientUrl()}/oauth/meta/callback`;
      const scope = [
        'pages_show_list',
        'pages_read_engagement',
        'instagram_manage_insights',
        'instagram_basic',
        'business_management',
      ].join(',');
      authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${artistId}`;
      return res.json({ authUrl, provider: 'instagram', state: artistId });
    } else {
      return res.status(400).json({ message: 'Unsupported provider' });
    }

    res.json({ authUrl, provider, state });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** GET /api/auth/callback/:provider */
exports.handleCallback = async (req, res) => {
  const { provider } = req.params;
  const { code, state, error } = req.query;
  const front = resolveClientUrl();

  if (error) {
    return res.redirect(`${front}/artists?connect_error=${encodeURIComponent(error)}`);
  }

  let artistId;
  try {
    const decoded = verifyOAuthState(state);
    artistId = decoded.artistId;
  } catch {
    artistId = state;
  }

  try {
    if (provider === 'spotify') await handleSpotifyCallback(req, artistId, code);
    else if (provider === 'youtube') await handleYouTubeCallback(req, artistId, code);
    else return res.status(400).json({ message: 'Unsupported callback provider' });

    try {
      const { syncArtistStats } = require('./artistAnalyticsController');
      await syncArtistStats(
        { params: { id: artistId }, body: {} },
        { json: () => {}, status: () => ({ json: () => {} }) }
      );
    } catch (syncErr) {
      logger.warn('connectionAuth', 'Post-connect sync warning', { error: syncErr.message });
    }

    res.redirect(`${front}/artists/${artistId}?connected=${provider}`);
  } catch (err) {
    logger.error('connectionAuth', 'Callback failed', { error: err.message });
    res.redirect(`${front}/artists/${artistId}?connect_error=${encodeURIComponent(err.message)}`);
  }
};

async function handleSpotifyCallback(req, artistId, code) {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.replace(/['"]/g, '').trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.replace(/['"]/g, '').trim();
  const redirectUri = spotifyRedirectUri(req);

  const tokenRes = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
    }
  );

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  const profileRes = await axios.get('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = profileRes.data;

  const ArtistConnection = require('../../../models/ArtistConnection');
  const raw = await Artist.collection.findOne({ _id: artistId });
  const existingConn = await ArtistConnection.findOne({ artistId, provider: 'spotify' });
  const existingArtistId =
    existingConn?.accountHandle ||
    existingConn?.metadata?.artistId ||
    raw?.oauthCredentials?.spotify?.artistId ||
    '';

  await upsertConnection({
    artistId,
    provider: 'spotify',
    accountHandle: existingArtistId,
    accountLabel: profile.display_name || 'Spotify',
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(Date.now() + expires_in * 1000),
    metadata: {
      spotifyUserId: profile.id,
      displayName: profile.display_name,
      artistId: existingArtistId,
    },
  });
}

async function handleYouTubeCallback(req, artistId, code) {
  const clientId = process.env.YOUTUBE_CLIENT_ID?.replace(/['"]/g, '').trim();
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.replace(/['"]/g, '').trim();
  const redirectUri = youtubeRedirectUri(req);

  const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  const channelRes = await axios.get(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    { headers: { Authorization: `Bearer ${access_token}` } }
  );
  const channel = channelRes.data.items?.[0];
  if (!channel) throw new Error('No YouTube channel found');

  await upsertConnection({
    artistId,
    provider: 'youtube',
    accountHandle: channel.id,
    accountLabel: channel.snippet?.title || 'YouTube',
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresAt: new Date(Date.now() + expires_in * 1000),
    metadata: {
      channelId: channel.id,
      channelTitle: channel.snippet?.title,
    },
  });
}

/** Legacy redirect shims */
exports.legacySpotifyRedirect = (req, res) => {
  req.body = { artistId: req.params.id };
  req.params.provider = 'spotify';
  exports.initiateConnect(req, {
    json: ({ authUrl }) => res.redirect(authUrl),
    status: (c) => ({ json: (b) => res.status(c).json(b) }),
  });
};

exports.legacyYoutubeRedirect = (req, res) => {
  req.body = { artistId: req.params.id };
  req.params.provider = 'youtube';
  exports.initiateConnect(req, {
    json: ({ authUrl }) => res.redirect(authUrl),
    status: (c) => ({ json: (b) => res.status(c).json(b) }),
  });
};
