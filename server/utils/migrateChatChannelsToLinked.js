const ChatChannel = require('../models/ChatChannel');
const Project = require('../models/Project');
const { mergeProjectMembersIntoChannel, toId } = require('./chatAccess');
const { repairChatChannelIndexes } = require('./repairChatChannelIndexes');

async function migrateChatChannelsToLinked() {
  const projectChannels = await ChatChannel.find({ type: 'project' });
  let migrated = 0;

  for (const channel of projectChannels) {
    const pid = channel.projectId;
    channel.type = 'group';
    channel.linkedProjectIds = pid ? [pid] : [];
    if (pid) {
      const project = await Project.findById(pid).select('owner members').lean();
      if (project) mergeProjectMembersIntoChannel(channel, [project]);
    }
    channel.projectId = undefined;
    channel.markModified('linkedProjectIds');
    channel.markModified('members');
    await channel.save();
    migrated += 1;
  }

  const groupsWithLegacy = await ChatChannel.find({
    type: 'group',
    projectId: { $ne: null },
  });

  for (const channel of groupsWithLegacy) {
    const pid = channel.projectId;
    if (!pid) continue;
    const existing = new Set((channel.linkedProjectIds || []).map(toId));
    existing.add(toId(pid));
    channel.linkedProjectIds = [...existing].filter(Boolean);
    const project = await Project.findById(pid).select('owner members').lean();
    if (project) mergeProjectMembersIntoChannel(channel, [project]);
    channel.projectId = undefined;
    await channel.save();
    migrated += 1;
  }

  await ChatChannel.updateMany(
    { projectId: { $ne: null } },
    { $unset: { projectId: '' } }
  );

  try {
    const coll = ChatChannel.collection;
    const indexes = await coll.indexes();
    if (indexes.some((i) => i.name === 'type_1_projectId_1')) {
      await coll.dropIndex('type_1_projectId_1');
    }
  } catch (err) {
    console.warn('[migrateChatChannels] Index drop skipped:', err.message);
  }

  await repairChatChannelIndexes();

  if (migrated > 0) {
    console.log(`[migrateChatChannels] Migrated ${migrated} channel(s) to linkedProjectIds`);
  }

  return migrated;
}

module.exports = { migrateChatChannelsToLinked };
