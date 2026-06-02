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

    const SONGSTATS_KEY = process.env.SONGSTATS_API_KEY;
    if (!SONGSTATS_KEY) {
      return res.status(503).json({ error: 'Songstats API key not configured', data: null });
    }
    
    if (spotifyProfile || ssProfile) {
      try {
        let ssUrl = 'https://api.songstats.com/enterprise/v1/artists/stats?source=spotify';
        if (ssProfile) {
          ssUrl += `&songstats_artist_id=${ssProfile.platformId}`;
        } else if (spotifyProfile) {
          ssUrl += `&spotify_artist_id=${spotifyProfile.platformId}`;
        }
        
        const ssRes = await axios.get(ssUrl, { headers: { 'apikey': SONGSTATS_KEY } });
        
        // Map songstats enterprise response to our format
        const stats = ssRes.data?.stats?.[0]?.data || {};
        
        responseData.spotify = {
          followers: stats.followers_total || null,
          monthly_listeners: stats.monthly_listeners_current || null,
          popularity: stats.popularity_current || null,
          streams: stats.streams_total || null
        };
      } catch (err) {
        console.error('Songstats API Error', err.response?.data || err.message);
        responseData.spotify = { error: 'Failed to fetch from Songstats', followers: null, monthly_listeners: null };
      }
    } else {
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
