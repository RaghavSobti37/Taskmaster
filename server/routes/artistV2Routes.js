const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Workspace = require('../models/Workspace');
const ConnectedProfile = require('../models/ConnectedProfile');
const { getCache, setCache } = require('../services/cacheService');
const axios = require('axios');

// GET /api/v2/artists/:id/stats
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const cacheKey = `songstats:${workspaceId}`;
    
    // Check Cache (Phase 2 - Implement Redis Caching)
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Fetch Connected Profiles
    const profiles = await ConnectedProfile.find({ workspace: workspaceId, status: 'active' }).select('+accessToken');
    if (!profiles || profiles.length === 0) {
      return res.json({ error: 'No profiles connected', data: null });
    }

    // Find songstats profile or fallback to spotify/youtube ids
    let ssProfile = profiles.find(p => p.platform === 'songstats');
    let spotifyProfile = profiles.find(p => p.platform === 'spotify');

    let responseData = {
      spotify: null,
      youtube: null,
      meta: null
    };

    if (ssProfile) {
      // Mocking songstats API call using their proxy endpoint
      // Replace with actual implementation and API keys
      try {
        const ssUrl = `https://api.songstats.com/api/v1/artists/stats?artist_id=${ssProfile.platformId}`;
        const ssRes = await axios.get(ssUrl, { headers: { 'x-api-key': process.env.SONGSTATS_API_KEY } });
        responseData = ssRes.data;
      } catch (err) {
        console.error('Songstats API Error', err.message);
        // Graceful degradation (N/A Handling)
        responseData = { error: 'Failed to fetch from Songstats', spotify: null, youtube: null, meta: null };
      }
    } else {
      // Dummy response for fallback mapping
      responseData = {
        spotify: { followers: null, monthly_listeners: null },
        youtube: { subscribers: null, views: null }
      };
    }

    // Set Cache for 6 hours (21600 seconds)
    await setCache(cacheKey, responseData, 21600);

    res.json(responseData);
  } catch (error) {
    console.error('Stats Proxy Error:', error);
    res.status(500).json({ error: 'Internal Server Error', data: null });
  }
});

// GET /api/v2/shared/artist/:sharedTokenId (Phase 4 - Public Links)
router.get('/shared/:sharedTokenId', async (req, res) => {
  try {
    const { sharedTokenId } = req.params;
    const workspace = await Workspace.findOne({ 'settings.publicShareToken': sharedTokenId, 'settings.isPublicShared': true });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Invalid or expired share link' });
    }

    // Fetch cached stats for public view without auth
    const cacheKey = `songstats:${workspace._id}`;
    let stats = await getCache(cacheKey);
    
    // Return clean read-only dashboard payload
    res.json({
      workspace: { name: workspace.name, description: workspace.description },
      stats: stats || { spotify: null, youtube: null, meta: null },
      readOnly: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
