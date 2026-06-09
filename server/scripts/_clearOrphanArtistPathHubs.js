require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const PersonHubView = require('../models/PersonHubView');

const useProd = process.argv.includes('--prod');

(async () => {
  const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const r = await PersonHubView.updateMany(
    { inArtistPath: true, artistPathResponseCount: { $lte: 0 } },
    { $set: { inArtistPath: false } }
  ).setOptions({ bypassTenant: true });
  const count = await PersonHubView.countDocuments({ inArtistPath: true }).setOptions({ bypassTenant: true });
  console.log(mongoose.connection.db.databaseName, 'cleared', r.modifiedCount, 'inArtistPath', count);
  await mongoose.disconnect();
})();
