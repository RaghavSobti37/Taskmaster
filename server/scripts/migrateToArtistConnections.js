require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Artist = require('../models/Artist');
const ArtistMetrics = require('../models/ArtistMetrics');
const ArtistAuth = require('../models/ArtistAuth');
const { migrateAllFromArtistAuth, migrateAuthDocToConnections } = require('../services/connectionService');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const authMigrated = await migrateAllFromArtistAuth();
  console.log(`Migrated ${authMigrated} ArtistAuth docs → ArtistConnection`);

  const artists = await mongoose.connection.db.collection('artists').find({}).toArray();
  let legacyConn = 0;
  let metricsEnsured = 0;

  for (const artist of artists) {
    const existingConn = await mongoose.connection.db.collection('artistconnections').countDocuments({ artistId: artist._id });
    if (existingConn === 0 && artist.oauthCredentials) {
      await migrateAuthDocToConnections(artist._id, { oauthCredentials: artist.oauthCredentials });
      legacyConn += 1;
    }

    const existing = await ArtistMetrics.findOne({ artistId: artist._id });
    if (!existing) {
      await ArtistMetrics.create({
        artistId: artist._id,
        analytics: artist.analytics || {},
        trackedVideos: artist.trackedVideos || [],
        history: artist.history || [],
        analyticsHistory: artist.analyticsHistory || [],
      });
      metricsEnsured += 1;
    }
  }

  console.log(`Migrated ${legacyConn} legacy embedded oauthCredentials → ArtistConnection`);
  console.log(`Ensured ArtistMetrics for ${metricsEnsured} new artists`);
  console.log('Migration complete.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
