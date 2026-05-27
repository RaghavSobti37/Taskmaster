const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const migrateArtists = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const db = mongoose.connection.db;
  const artistsCol = db.collection('artists');
  const metricsCol = db.collection('artistmetrics');
  const authCol = db.collection('artistauths');

  const artists = await artistsCol.find({}).toArray();

  for (const artist of artists) {
    const metricsPayload = {};
    const authPayload = {};
    let hasMetrics = false;
    let hasAuth = false;

    // Migrate analytics
    if (artist.analytics || artist.history || artist.analyticsHistory || artist.trackedVideos) {
      metricsPayload.analytics = artist.analytics || {};
      metricsPayload.history = artist.history || [];
      metricsPayload.analyticsHistory = artist.analyticsHistory || [];
      metricsPayload.trackedVideos = artist.trackedVideos || [];
      hasMetrics = true;
    }

    // Migrate auth
    if (artist.oauthCredentials || artist.isSynced !== undefined) {
      authPayload.oauthCredentials = artist.oauthCredentials || {};
      authPayload.isSynced = artist.isSynced || false;
      hasAuth = true;
    }

    if (hasMetrics) {
      await metricsCol.updateOne(
        { artistId: artist._id },
        { $set: { ...metricsPayload, artistId: artist._id } },
        { upsert: true }
      );
    }
    
    if (hasAuth) {
      await authCol.updateOne(
        { artistId: artist._id },
        { $set: { ...authPayload, artistId: artist._id } },
        { upsert: true }
      );
    }

    // Unset deprecated fields
    await artistsCol.updateOne(
      { _id: artist._id },
      { 
        $unset: { 
          analytics: "", 
          history: "", 
          analyticsHistory: "", 
          trackedVideos: "", 
          oauthCredentials: "", 
          isSynced: "" 
        } 
      }
    );
  }

  console.log('Migration complete');
  process.exit(0);
};

migrateArtists().catch(console.error);
