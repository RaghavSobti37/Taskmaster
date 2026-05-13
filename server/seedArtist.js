const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Artist = require('./models/Artist');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const seedArtist = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding artist...');

    const artistData = {
      name: 'Harshad & Duhita',
      bio: 'The Harshad & Duhita Collective is a premier musical ensemble that redefines the experience of Indian music. Led by the powerhouse duo of Harshad and Duhita Golesar, the collective brings a rare combination of academic excellence and mainstream stardom to the stage.',
      profileImage: '/artists/hnd-posing.jpeg',
      socials: {
        youtube: 'https://www.youtube.com/watch?v=IcknSFj2rys',
        instagram: 'https://www.instagram.com/harshad_golesar/',
        spotify: 'https://open.spotify.com/artist/6L88xirodmbWYoZuvseUnc'
      },
      analytics: {
        spotify: { followers: 15400, monthlyListeners: 85000 },
        youtube: { views: 2400000, subscribers: 12000 },
        instagram: { followers: 45000 }
      },
      events: [
        { date: '2024-05-10', venue: 'IGT Stage', audience: 'National TV', title: 'Season 11 Golden Buzzer' },
        { date: '2024-08-20', venue: 'Mumbai', audience: 'Viral Release', title: 'Gananayaka Launch' },
        { date: '2023-11-15', venue: 'Studio', audience: 'Film Score', title: 'Raudra OST Recording' }
      ],
      discography: [
        { title: "Gananayaka", type: "Devotional", spotify: "https://open.spotify.com/track/1utLt90yMwsYKYGAFqWOB5" },
        { title: "Param Gahan Ish Kam", type: "Soundtrack", spotify: "https://open.spotify.com/track/3es2nsPDv6vOGc5sDMpCCS" },
        { title: "Mere Bhole Bhandari", type: "Devotional", spotify: "https://open.spotify.com/track/0tgoY5Jz0Aa4QMDLSzoWNq" }
      ]
    };

    await Artist.findOneAndUpdate(
      { name: artistData.name },
      artistData,
      { upsert: true, new: true }
    );

    console.log('Artist Harshad & Duhita seeded/updated successfully.');
    process.exit();
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedArtist();
