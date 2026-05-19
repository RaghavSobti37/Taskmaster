require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const Artist = require('../models/Artist');
  const axios = require('axios');

  const artists = await Artist.find({}).lean();
  console.log(`\n📋 All artists (${artists.length} total):\n`);

  for (const a of artists) {
    const spToken = a.oauthCredentials?.spotify?.accessToken;
    const spId = a.oauthCredentials?.spotify?.artistId;
    const spExpiry = a.oauthCredentials?.spotify?.tokenExpiry;
    const ytChannel = a.oauthCredentials?.youtube?.channelId;

    console.log(`🎤 ${a.name}`);
    console.log(`   Spotify Artist ID : ${spId || '(not set)'}`);
    console.log(`   Spotify OAuth     : ${spToken ? `✅ Token expires ${new Date(spExpiry).toLocaleString()}` : '❌ Not connected'}`);
    console.log(`   YouTube Channel   : ${ytChannel || '(not set)'}`);

    // If OAuth token is valid, test a live Spotify call
    if (spToken && new Date(spExpiry) > new Date() && spId) {
      try {
        const r = await axios.get(`https://api.spotify.com/v1/artists/${spId}`, {
          headers: { Authorization: `Bearer ${spToken}` }
        });
        console.log(`   ✅ Spotify LIVE    : followers=${r.data.followers?.total}, popularity=${r.data.popularity}, genres=[${(r.data.genres || []).join(', ')}]`);
      } catch (err) {
        console.log(`   ❌ Spotify API err : ${err.response?.data?.error?.message || err.message}`);
      }
    } else if (spToken && spId) {
      console.log(`   ⚠️  Token expired — need reconnect`);
    }
    console.log('');
  }

  await mongoose.disconnect();
})().catch(console.error);
