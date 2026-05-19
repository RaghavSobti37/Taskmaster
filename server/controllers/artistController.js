const Artist = require('../models/Artist');

let cachedSpotifyToken = null;
let spotifyTokenExpiry = null;

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
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });

    // Update general fields
    if (req.body.name !== undefined) artist.name = req.body.name;
    if (req.body.bio !== undefined) artist.bio = req.body.bio;
    if (req.body.profileImage !== undefined) artist.profileImage = req.body.profileImage;
    if (req.body.website !== undefined) artist.website = req.body.website;
    if (req.body.socials !== undefined) {
      artist.socials = { ...artist.socials, ...req.body.socials };
    }
    
    // Update oauthCredentials IDs safely without wiping out OAuth tokens
    if (req.body.oauthCredentials) {
      if (!artist.oauthCredentials) artist.oauthCredentials = {};
      
      if (req.body.oauthCredentials.spotify) {
        if (!artist.oauthCredentials.spotify) artist.oauthCredentials.spotify = {};
        if (req.body.oauthCredentials.spotify.artistId !== undefined) {
          artist.oauthCredentials.spotify.artistId = req.body.oauthCredentials.spotify.artistId;
        }
        if (req.body.oauthCredentials.spotify.chartmetricId !== undefined) {
          artist.oauthCredentials.spotify.chartmetricId = req.body.oauthCredentials.spotify.chartmetricId;
        }
      }

      if (req.body.oauthCredentials.youtube) {
        if (!artist.oauthCredentials.youtube) artist.oauthCredentials.youtube = {};
        if (req.body.oauthCredentials.youtube.channelId !== undefined) {
          artist.oauthCredentials.youtube.channelId = req.body.oauthCredentials.youtube.channelId;
        }
      }

      if (req.body.oauthCredentials.meta) {
        if (!artist.oauthCredentials.meta) artist.oauthCredentials.meta = {};
        if (req.body.oauthCredentials.meta.igAccountId !== undefined) {
          artist.oauthCredentials.meta.igAccountId = req.body.oauthCredentials.meta.igAccountId;
        }
        if (req.body.oauthCredentials.meta.fbPageId !== undefined) {
          artist.oauthCredentials.meta.fbPageId = req.body.oauthCredentials.meta.fbPageId;
        }
      }
    }

    if (req.body.trackedVideos !== undefined) artist.trackedVideos = req.body.trackedVideos;
    if (req.body.events !== undefined) artist.events = req.body.events;
    if (req.body.discography !== undefined) artist.discography = req.body.discography;

    const savedArtist = await artist.save();
    res.json(savedArtist);
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


