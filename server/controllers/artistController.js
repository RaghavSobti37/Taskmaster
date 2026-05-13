const Artist = require('../models/Artist');

exports.getArtists = async (req, res) => {
  try {
    const artists = await Artist.find();
    res.json(artists);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getArtistById = async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id);
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createArtist = async (req, res) => {
  try {
    const artist = new Artist(req.body);
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

    const axios = require('axios');
    const stats = { ...artist.analytics.toObject() };

    // Spotify Sync
    if (artist.socials.spotify) {
      try {
        const { data } = await axios.get(artist.socials.spotify, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const match = data.match(/(\d+(?:,\d+)*) monthly listeners/i);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ''));
          stats.spotify.monthlyListeners = count;
          stats.spotify.mal = count;
        }
      } catch (e) { console.error('Spotify sync fail', e.message); }
    }

    // Instagram Sync
    if (artist.socials.instagram) {
      try {
        const { data } = await axios.get(artist.socials.instagram, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const match = data.match(/content="(\d+(?:\.\d+)?[KM]?) Followers/i);
        if (match) {
          let val = match[1];
          let count = 0;
          if (val.endsWith('K')) count = parseFloat(val) * 1000;
          else if (val.endsWith('M')) count = parseFloat(val) * 1000000;
          else count = parseInt(val.replace(/,/g, ''));
          stats.instagram.followers = count;
        }
      } catch (e) { console.error('Insta sync fail', e.message); }
    }

    artist.analytics = stats;
    await artist.save();
    res.json(artist);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
