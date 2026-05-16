const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Artist = require('./models/Artist');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const seedAdditionalArtists = async () => {
  try {
    const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB for roster cleanup and seeding...');

    // 1. Remove test artist "Harshad Golesar" if present
    await Artist.deleteMany({ name: 'Harshad Golesar' });
    console.log('Removed test artist Harshad Golesar.');

    // 2. Seed Yugm
    const yugmData = {
      name: 'Yugm',
      bio: 'Yugm is an extraordinary musical force blending raw folk traditions with contemporary storytelling. Known for deeply emotive live performances and resonant acoustic arrangements.',
      profileImage: '/hnd-posing.jpeg', // Dummy picture as requested
      website: 'https://www.instagram.com/yugmofficial/',
      socials: {
        instagram: 'https://www.instagram.com/yugmofficial/',
        facebook: 'https://www.facebook.com/yugmofficial/',
        spotify: 'https://open.spotify.com/artist/43uEANXUn0eOJrYKfjq2DL',
        youtube: 'https://www.youtube.com/@yugmofficial5231'
      },
      oauthCredentials: {
        youtube: { channelId: 'UCyugmofficial5231' },
        meta: { igAccountId: '17841458291039201', fbPageId: '109281928392019' },
        spotify: { artistId: '43uEANXUn0eOJrYKfjq2DL', chartmetricId: '82910' }
      },
      isSynced: false,
      analytics: {},
      analyticsHistory: [],
      events: [
        { date: '2026-07-20', venue: 'Jaipur Amphitheatre', audience: '2,500+', title: 'Folk Fusion Symphony', status: 'planned', description: 'Headline acoustic showcase.' }
      ],
      discography: [
        { title: "Kabeera", type: "Folk", spotify: "https://open.spotify.com/artist/43uEANXUn0eOJrYKfjq2DL" }
      ]
    };

    await Artist.findOneAndUpdate(
      { name: 'Yugm' },
      yugmData,
      { upsert: true, new: true }
    );
    console.log('Artist Yugm seeded successfully.');

    // 3. Seed Mohit Shankar
    const mohitData = {
      name: 'Mohit Shankar',
      bio: 'Mohit Shankar is a dynamic composer and vocalist creating captivating soundscapes that bridge traditional melodies and immersive cinematic production.',
      profileImage: '/hnd-posing.jpeg', // Dummy picture as requested
      website: 'https://www.instagram.com/mohit.shankar_/',
      socials: {
        instagram: 'https://www.instagram.com/mohit.shankar_/',
        spotify: 'https://open.spotify.com/artist/1tvQA0pzSsbwcDGJrt9RXt',
        youtube: 'https://www.youtube.com/channel/UCWtslmKHX8dly9BWdfnazFA'
      },
      oauthCredentials: {
        youtube: { channelId: 'UCWtslmKHX8dly9BWdfnazFA' },
        meta: { igAccountId: '17841458291048302', fbPageId: '109281928394028' },
        spotify: { artistId: '1tvQA0pzSsbwcDGJrt9RXt', chartmetricId: '91028' }
      },
      isSynced: false,
      analytics: {},
      analyticsHistory: [],
      events: [
        { date: '2026-08-10', venue: 'NCPA Mumbai', audience: '1,200+', title: 'Echoes of the Soul', status: 'planned', description: 'Intimate vocal recital.' }
      ],
      discography: [
        { title: "Rahguzar", type: "Classical Fusion", spotify: "https://open.spotify.com/artist/1tvQA0pzSsbwcDGJrt9RXt" }
      ]
    };

    await Artist.findOneAndUpdate(
      { name: 'Mohit Shankar' },
      mohitData,
      { upsert: true, new: true }
    );
    console.log('Artist Mohit Shankar seeded successfully.');

    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedAdditionalArtists();
