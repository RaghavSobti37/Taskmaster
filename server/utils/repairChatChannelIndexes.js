/**
 * Fix dmKey unique index: non-DM channels must not store dmKey:null (breaks non-sparse unique index).
 */
async function repairChatChannelIndexes() {
  const ChatChannel = require('../models/ChatChannel');
  const coll = ChatChannel.collection;

  const unset = await coll.updateMany(
    { type: { $ne: 'dm' } },
    { $unset: { dmKey: '' } }
  );

  try {
    await coll.dropIndex('dmKey_1');
  } catch {
    /* index may not exist or name differs */
  }

  await ChatChannel.syncIndexes();

  if (unset.modifiedCount > 0) {
    console.log(`[ChatChannel] Unset dmKey on ${unset.modifiedCount} non-DM channel(s)`);
  }
}

module.exports = { repairChatChannelIndexes };
