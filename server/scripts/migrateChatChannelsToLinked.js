require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { migrateChatChannelsToLinked } = require('../utils/migrateChatChannelsToLinked');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI or MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);
  await migrateChatChannelsToLinked();
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
