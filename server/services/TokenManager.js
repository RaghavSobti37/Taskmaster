const { Mutex } = require('async-mutex');
const ConnectedProfile = require('../models/ConnectedProfile');
const axios = require('axios');

const mutexes = new Map();

async function refreshPlatformToken(platform, refreshToken) {
  if (platform === 'spotify') {
    const res = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        }
      }
    );
    return { newAccessToken: res.data.access_token, newRefreshToken: res.data.refresh_token, expiresIn: res.data.expires_in };
  } else if (platform === 'youtube') {
    const res = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.YOUTUBE_CLIENT_ID,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    return { newAccessToken: res.data.access_token, newRefreshToken: res.data.refresh_token, expiresIn: res.data.expires_in };
  }
  throw new Error(`Unsupported platform for refresh: ${platform}`);
}

async function getValidAccessToken(artistId, platform) {
  const profile = await ConnectedProfile.findOne({ artistId, platform });
  if (!profile) throw new Error(`Profile not found for artist ${artistId} and platform ${platform}`);
  
  if (profile.tokenExpiry > Date.now() + 300000) {
    return profile.getAccessToken(); // Assume model method decrypts
  }

  const lockKey = `${artistId}-${platform}`;
  if (!mutexes.has(lockKey)) mutexes.set(lockKey, new Mutex());
  const mutex = mutexes.get(lockKey);

  const release = await mutex.acquire();
  try {
    const freshProfile = await ConnectedProfile.findOne({ artistId, platform });
    if (freshProfile.tokenExpiry > Date.now() + 300000) {
      return freshProfile.getAccessToken();
    }

    const { newAccessToken, newRefreshToken, expiresIn } = await refreshPlatformToken(platform, freshProfile.getRefreshToken());
    
    freshProfile.accessToken = newAccessToken; // pre-save will encrypt
    if (newRefreshToken) freshProfile.refreshToken = newRefreshToken;
    freshProfile.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));
    await freshProfile.save();

    return newAccessToken;
  } finally {
    release();
  }
}

module.exports = { getValidAccessToken };
