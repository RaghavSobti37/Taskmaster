const mongoose = require('mongoose');
const Artist = require('./models/Artist');
require('dotenv').config();

const update = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const artistData = {
      name: 'Harshad Golesar',
      bio: 'Harshad Golesar is a visionary artist and part of the Harshaduhita Collective, pushing the boundaries of classical fusion and contemporary soundscapes.',
      profileImage: '/hnd-posing.jpeg',
      socials: {
        instagram: 'https://www.instagram.com/harshad_golesar/',
        instagramCollective: 'https://www.instagram.com/harshaduhita_collective/',
        spotify: 'https://open.spotify.com/artist/6L88xirodmbWYoZuvseUnc',
        youtube: 'https://www.youtube.com/@HarshadGolesar'
      },
      analytics: {
        youtube: {
          subscribers: 144,
          views: 12500,
          watchTime: 450,
          avd: '2:15',
          trafficSources: { suggested: 40, search: 60 },
          returningViewers: 45
        },
        instagram: {
          followers: 27000,
          reelsPerformance: { views: 8500, saves: 320, shares: 150 },
          followerVelocity: 5,
          audienceQuality: 92,
          profileVisitRatio: 0.08
        },
        spotify: {
          monthlyListeners: 112,
          followers: 85,
          streamsPerListener: 3.1,
          playlistAdditions: 45,
          mal: 112,
          triggerCities: ['Mumbai', 'Pune', 'Nashik']
        },
        facebook: {
          ctr: 1.2,
          topFanEngagement: 8,
          postReach: { organic: 1200, paid: 0 }
        }
      },
      events: [
        {
          date: '2026-06-15',
          venue: 'Royal Albert Hall',
          audience: '5000+',
          title: 'Classical Fusion Night',
          description: 'A grand performance featuring new compositions.',
          status: 'planned'
        }
      ]
    };

    const artist = await Artist.findOneAndUpdate(
      { name: 'Harshad Golesar' },
      artistData,
      { upsert: true, new: true }
    );
    
    console.log('Artist updated:', artist.name);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

update();
