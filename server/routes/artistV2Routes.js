const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Workspace = require('../models/Workspace');
const ArtistConnection = require('../models/ArtistConnection');
const { getCache, setCache } = require('../services/cacheService');
const axios = require('axios');

// GET /api/v2/artists/:id/stats
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const artistId = req.params.id;
    const cacheKey = `songstats:${artistId}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const connections = await ArtistConnection.find({ artistId, status: 'active' });
    if (!connections.length) {
      return res.json({ error: 'No connections linked', data: null });
    }

    const spotifyConn = connections.find((c) => c.provider === 'spotify');
    const responseData = {
      spotify: null,
      youtube: null,
      meta: null,
    };

    const SONGSTATS_KEY = process.env.SONGSTATS_API_KEY;
    if (!SONGSTATS_KEY) {
      return res.status(503).json({ error: 'Songstats API key not configured', data: null });
    }

    if (spotifyConn?.metadata?.platformId || spotifyConn?.accountHandle) {
      try {
        const spotifyArtistId = spotifyConn.metadata?.platformId || spotifyConn.accountHandle;
        const ssUrl = `https://api.songstats.com/enterprise/v1/artists/stats?source=spotify&spotify_artist_id=${spotifyArtistId}`;
        const ssRes = await axios.get(ssUrl, { headers: { apikey: SONGSTATS_KEY } });
        const stats = ssRes.data?.stats?.[0]?.data || {};
        responseData.spotify = {
          followers: stats.followers_total || null,
          monthly_listeners: stats.monthly_listeners_current || null,
          popularity: stats.popularity_current || null,
          streams: stats.streams_total || null,
        };
      } catch (err) {
        console.error('Songstats API Error', err.response?.data || err.message);
        responseData.spotify = { error: 'Failed to fetch from Songstats', followers: null, monthly_listeners: null };
      }
    }

    await setCache(cacheKey, responseData, 21600);
    res.json(responseData);
  } catch (error) {
    console.error('Stats Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error', data: null });
  }
});

router.get('/shared/:sharedTokenId', async (req, res) => {
  try {
    const { sharedTokenId } = req.params;
    const workspace = await Workspace.findOne({ 'settings.publicShareToken': sharedTokenId, 'settings.isPublicShared': true });

    if (!workspace) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }

    const cacheKey = `songstats:${workspace._id}`;
    const stats = await getCache(cacheKey);

    res.json({
      workspace: { name: workspace.name, description: workspace.description },
      stats: stats || { spotify: null, youtube: null, meta: null },
      readOnly: true,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
