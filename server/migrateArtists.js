require('dotenv').config();
const mongoose = require('mongoose');
const Artist = require('./models/Artist');
const ArtistMetrics = require('./models/ArtistMetrics');
const ArtistAuth = require('./models/ArtistAuth');

async function migrateArtists() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const artists = await db.collection('artists').find({}).toArray();

  let metricsCount = 0;
  let authCount = 0;

  for (const artist of artists) {
    // Migrate Metrics
    if (artist.analytics || artist.trackedVideos || artist.history || artist.analyticsHistory) {
      await ArtistMetrics.updateOne(
        { artistId: artist._id },
        { 
          $set: {
            artistId: artist._id,
            analytics: artist.analytics,
            trackedVideos: artist.trackedVideos,
            history: artist.history,
            analyticsHistory: artist.analyticsHistory
          }
        },
        { upsert: true }
      );
      metricsCount++;
    }

    // Migrate Auth
    if (artist.oauthCredentials || artist.isSynced !== undefined) {
      await ArtistAuth.updateOne(
        { artistId: artist._id },
        {
          $set: {
            artistId: artist._id,
            oauthCredentials: artist.oauthCredentials,
            isSynced: artist.isSynced || false
          }
        },
        { upsert: true }
      );
      authCount++;
    }

    // Optionally cleanup old keys from artist document
    // await db.collection('artists').updateOne({ _id: artist._id }, { $unset: { analytics: "", trackedVideos: "", history: "", analyticsHistory: "", oauthCredentials: "", isSynced: "" } });
  }

  console.log(`Migrated ${metricsCount} metrics profiles and ${authCount} auth profiles.`);
  process.exit(0);
}

migrateArtists().catch(console.error);
