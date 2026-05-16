const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Artist = require('./models/Artist');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const seedArtist = async () => {
  try {
    const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB for seeding Harshad & Duhita...');

    const artistData = {
      name: 'Harshad & Duhita',
      bio: 'The Harshad & Duhita Collective is a premier musical ensemble that redefines the experience of Indian classical fusion and mainstream contemporary soundscapes. Led by the powerhouse duo of Harshad and Duhita Golesar, the collective brings unparalleled energy and virtuosity to every stage.',
      profileImage: '/hnd-posing.jpeg',
      website: 'https://theshakticollective.in/harshad-duhita',
      socials: {
        youtube: 'https://www.youtube.com/channel/UCgRciTp6cVLeuHWe3jte_aQ',
        instagram: 'https://www.instagram.com/harshad_golesar/',
        instagramCollective: 'https://www.instagram.com/harshaduhita_collective/',
        spotify: 'https://open.spotify.com/artist/6L88xirodmbWYoZuvseUnc'
      },
      oauthCredentials: {
        youtube: { channelId: 'UCgRciTp6cVLeuHWe3jte_aQ' },
        meta: { igAccountId: '78345277076', fbPageId: '78345277076' },
        spotify: { artistId: '6L88xirodmbWYoZuvseUnc', chartmetricId: '291028' }
      },
      isSynced: true,
      analytics: {
        spotify: { followers: 18400, monthlyListeners: 24500, mal: 24500, popularity: 78, streamsPerListener: 3.4, playlistInclusion: 68.4 },
        youtube: { views: 53512, subscribers: 726, avd: '3m 42s', ctr: 8.4, engagementVelocity: 14.2 },
        instagram: { followers: 34900, followerVelocity: 14, audienceQuality: 88, engagementRate: 5.4, weeklyShares: 1240 }
      },
      analyticsHistory: [
        { platform: 'youtube', timestamp: new Date(), metrics: { followers: 726, views: 53512 } },
        { platform: 'spotify', timestamp: new Date(), metrics: { followers: 18400, monthlyListeners: 24500 } },
        { platform: 'meta', timestamp: new Date(), metrics: { followers: 34900, reach: 279200 } }
      ],
      events: [
        { date: '2026-06-15', venue: 'Royal Albert Hall', audience: '5,000+', title: 'Classical Fusion Night', status: 'planned', description: 'Grand live orchestration.' },
        { date: '2024-05-10', venue: 'IGT Stage', audience: 'National TV', title: 'Season 11 Golden Buzzer', status: 'completed', description: 'Viral national television performance.' },
        { date: '2024-08-20', venue: 'Mumbai', audience: 'Viral Release', title: 'Gananayaka Launch', status: 'completed', description: 'Festival release.' }
      ],
      discography: [
        { title: "Gananayaka", type: "Devotional", spotify: "https://open.spotify.com/track/1utLt90yMwsYKYGAFqWOB5" },
        { title: "Param Gahan Ish Kam", type: "Soundtrack", spotify: "https://open.spotify.com/track/3es2nsPDv6vOGc5sDMpCCS" },
        { title: "Mere Bhole Bhandari", type: "Devotional", spotify: "https://open.spotify.com/track/0tgoY5Jz0Aa4QMDLSzoWNq" }
      ]
    };

    const updated = await Artist.findOneAndUpdate(
      { name: 'Harshad & Duhita' },
      artistData,
      { upsert: true, new: true }
    );

    console.log('Artist Harshad & Duhita seeded/updated successfully with ID:', updated._id.toString());
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedArtist();
