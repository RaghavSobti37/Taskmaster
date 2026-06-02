/**
 * Deletes all group channels and their messages (keeps DMs).
 * Run: node server/scripts/clearChatGroupChannels.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ChatChannel = require('../models/ChatChannel');
const ChatMessage = require('../models/ChatMessage');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI or MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const groups = await ChatChannel.find({ type: { $in: ['group', 'project'] } }).select('_id').lean();
  const ids = groups.map((c) => c._id);
  const msgResult = await ChatMessage.deleteMany({ channelId: { $in: ids } });
  const chResult = await ChatChannel.deleteMany({ _id: { $in: ids } });

  console.log(`[clearChatGroupChannels] Deleted ${chResult.deletedCount} channel(s), ${msgResult.deletedCount} message(s). DMs kept.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
