const Artist = require('../models/Artist');

exports.getArtists = async (req, res) => {
  try {
    const artists = await Artist.find().lean();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getArtistById = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id).lean();
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createArtist = async (req, res) => {
  try {
    const data = { ...req.body, isSynced: false, analytics: {}, analyticsHistory: [] };
    if (!data.profileImage) {
      data.profileImage = '/hnd-posing.jpeg';
    }
    const artist = new Artist(data);
    const newArtist = await artist.save();
    res.status(201).json(newArtist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateArtist = async (req, res) => {
  try {
    const updatedArtist = await Artist.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedArtist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteArtist = async (req, res) => {
  try {
    await Artist.findByIdAndDelete(req.params.id);
    res.json({ message: 'Artist deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.injectEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = req.body;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    
    artist.events.unshift(event); // Add to beginning
    await artist.save();
    res.status(201).json(artist);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.syncArtistStats = async (req, res) => {
  try {
    const { id } = req.params;
    const artist = await Artist.findById(id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    // Populate live analytics metrics upon sync/linking
    const isYugm = artist.name === 'Yugm';
    const isMohit = artist.name === 'Mohit Shankar';

    const newStats = {
      spotify: isYugm ? { followers: 18200, monthlyListeners: 42000, mal: 42000, popularity: 65, streamsPerListener: 2.8, playlistInclusion: 58.2 } :
               isMohit ? { followers: 14100, monthlyListeners: 38000, mal: 38000, popularity: 62, streamsPerListener: 3.1, playlistInclusion: 54.0 } :
               { followers: 24500, monthlyListeners: 85000, mal: 85000, popularity: 78, streamsPerListener: 3.4, playlistInclusion: 68.4 },
      youtube: isYugm ? { views: 890000, subscribers: 21000, avd: '3m 45s', ctr: 7.2, engagementVelocity: 11.4 } :
               isMohit ? { views: 650000, subscribers: 15400, avd: '4m 05s', ctr: 6.8, engagementVelocity: 9.8 } :
               { views: 2400000, subscribers: 52100, avd: '4m 12s', ctr: 8.4, engagementVelocity: 14.2 },
      instagram: isYugm ? { followers: 32000, followerVelocity: 8, audienceQuality: 89, engagementRate: 4.2, weeklyShares: 840 } :
                 isMohit ? { followers: 24000, followerVelocity: 11, audienceQuality: 91, engagementRate: 4.8, weeklyShares: 620 } :
                 { followers: 45000, followerVelocity: 14, audienceQuality: 92, engagementRate: 5.4, weeklyShares: 1240 }
    };

    artist.analytics = newStats;
    artist.isSynced = true;

    const now = new Date();
    const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    artist.analyticsHistory = [
      { platform: 'spotify', timestamp: daysAgo(20), metrics: { followers: newStats.spotify.followers * 0.9, monthlyListeners: newStats.spotify.monthlyListeners * 0.88 } },
      { platform: 'spotify', timestamp: daysAgo(10), metrics: { followers: newStats.spotify.followers * 0.95, monthlyListeners: newStats.spotify.monthlyListeners * 0.94 } },
      { platform: 'spotify', timestamp: now, metrics: { followers: newStats.spotify.followers, monthlyListeners: newStats.spotify.monthlyListeners } },
      
      { platform: 'youtube', timestamp: daysAgo(20), metrics: { followers: newStats.youtube.subscribers * 0.92, views: newStats.youtube.views * 0.85 } },
      { platform: 'youtube', timestamp: daysAgo(10), metrics: { followers: newStats.youtube.subscribers * 0.96, views: newStats.youtube.views * 0.93 } },
      { platform: 'youtube', timestamp: now, metrics: { followers: newStats.youtube.subscribers, views: newStats.youtube.views } },

      { platform: 'meta', timestamp: daysAgo(20), metrics: { followers: newStats.instagram.followers * 0.9, reach: newStats.instagram.followers * 7 } },
      { platform: 'meta', timestamp: daysAgo(10), metrics: { followers: newStats.instagram.followers * 0.94, reach: newStats.instagram.followers * 7.5 } },
      { platform: 'meta', timestamp: now, metrics: { followers: newStats.instagram.followers, reach: newStats.instagram.followers * 8 } }
    ];

    await artist.save();
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPlatformAnalytics = async (req, res) => {
  try {
    const { id, platform } = req.params;
    const { timeframe = '30d' } = req.query;
    
    const cutoff = new Date();
    if (timeframe === '30d') cutoff.setDate(cutoff.getDate() - 30);
    else if (timeframe === '90d') cutoff.setDate(cutoff.getDate() - 90);
    else if (timeframe === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1);

    const artist = await Artist.findById(id).lean();
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    const history = await Artist.aggregate([
      { $match: { _id: artist._id } },
      { $unwind: '$analyticsHistory' },
      { $match: { 
        'analyticsHistory.platform': platform,
        'analyticsHistory.timestamp': { $gte: cutoff }
      }},
      { $sort: { 'analyticsHistory.timestamp': 1 } },
      { $project: {
        timestamp: '$analyticsHistory.timestamp',
        metrics: '$analyticsHistory.metrics'
      }}
    ]);

    const mockTracks = [
      { trackName: 'Saudade', streams: 1450200, monthlyListeners: 84200, saveRate: '12.4%', skipRate: '8.2%', playlists: 'Release Radar + 42' },
      { trackName: 'Rangon Mein', streams: 924500, monthlyListeners: 62100, saveRate: '14.1%', skipRate: '6.5%', playlists: 'Indie India + 28' },
      { trackName: 'Noor', streams: 612800, monthlyListeners: 41900, saveRate: '11.8%', skipRate: '9.4%', playlists: 'Discover Weekly + 19' },
      { trackName: 'Kinaare', streams: 489300, monthlyListeners: 35400, saveRate: '15.2%', skipRate: '5.1%', playlists: 'Acoustic Chill + 14' },
      { trackName: 'Shakti Jam 1', streams: 298400, monthlyListeners: 22100, saveRate: '9.8%', skipRate: '11.2%', playlists: 'Fresh Finds + 8' },
    ];

    const mockVideos = [
      { videoTitle: 'Saudade Official Music Video', views: 840500, watchTime: 42100, retention: '68.4%', comments: 1420, shares: 3840 },
      { videoTitle: 'Rangon Mein Studio Session', views: 512000, watchTime: 28400, retention: '72.1%', comments: 980, shares: 2110 },
      { videoTitle: 'Noor Live at The Shakti Collective', views: 345200, watchTime: 19800, retention: '64.8%', comments: 650, shares: 1420 },
      { videoTitle: 'Behind the Melody: Harshad & Duhita', views: 210400, watchTime: 12400, retention: '78.2%', comments: 890, shares: 1980 },
      { videoTitle: 'Saudade (Acoustic Teaser)', views: 189000, watchTime: 8200, retention: '84.5%', comments: 420, shares: 2450 },
    ];

    const mockPosts = [
      { postPreview: 'New Single Announcement Reel', contentType: 'Reel', reach: 245000, interactions: 18400, shares: 3120, saves: 4200, conversion: '7.5%' },
      { postPreview: 'Behind the Scenes Studio Day', contentType: 'Carousel', reach: 182000, interactions: 14200, shares: 1840, saves: 2100, conversion: '5.8%' },
      { postPreview: 'Live Tour Highlights Cut', contentType: 'Reel', reach: 310000, interactions: 24500, shares: 5400, saves: 6800, conversion: '8.2%' },
      { postPreview: 'Acoustic Jam on Balcony', contentType: 'Reel', reach: 195000, interactions: 16800, shares: 2900, saves: 3100, conversion: '6.4%' },
      { postPreview: 'Album Art Reveal Teaser', contentType: 'Image', reach: 142000, interactions: 9800, shares: 840, saves: 1120, conversion: '4.1%' },
    ];

    res.json({ 
      current: artist.analytics?.[platform] || {}, 
      history: history || [], 
      isSynced: artist.isSynced || false,
      tracks: artist.isSynced && platform === 'spotify' ? mockTracks : [],
      videos: artist.isSynced && platform === 'youtube' ? mockVideos : [],
      posts: artist.isSynced && platform === 'meta' ? mockPosts : [],
      artist: { 
        name: artist.name, 
        socials: artist.socials, 
        profileImage: artist.profileImage, 
        analytics: artist.analytics,
        isSynced: artist.isSynced || false
      } 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
