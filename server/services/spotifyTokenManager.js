const axios = require('axios');

let cachedToken = null;
let tokenExpiry = null;

const getSpotifyAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const clientId = (process.env.SPOTIFY_CLIENT_ID || "a00df9460cd5450b9e5fa6b672ddd458").replace(/['"]/g, '').trim();
  const clientSecret = (process.env.SPOTIFY_CLIENT_SECRET || "6960f8bf9fa74f069b78d3719c9ce433").replace(/['"]/g, '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Spotify API credentials unconfigured.');
  }

  const authBuffer = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  
  try {
    const res = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
      grant_type: 'client_credentials'
    }).toString(), {
      headers: {
        'Authorization': `Basic ${authBuffer}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    cachedToken = res.data.access_token;
    // Cache for 50 minutes (50 * 60 * 1000 ms)
    tokenExpiry = now + (50 * 60 * 1000);
    return cachedToken;
  } catch (err) {
    console.error('Error fetching Spotify access token:', err?.response?.data || err.message);
    throw new Error('Failed to obtain Spotify access token');
  }
};

module.exports = { getSpotifyAccessToken };
