const mongoose = require('mongoose');
const ChatChannel = require('../models/ChatChannel');
const ChatMessage = require('../models/ChatMessage');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Asset = require('../models/Asset');
const {
  extractUserMentionLabels,
  extractAssetMentionLabels,
  resolveUserByLabel,
  resolveAssetByLabel,
} = require('../../shared/mentionTokens');
const { buildMentionNotifications } = require('../utils/mentionNotifications');
const { createNotification } = require('../services/notificationDispatcher');
const { broadcastRealtimeEvent } = require('../config/realtime');
const { isAdminUser } = require('../utils/departmentPermissions');
const {
  toId,
  normalizeWorkspace,
  buildDmKey,
  isChannelMember,
  assertChannelAccess,
  assertChannelAccessById,
  getMemberEntry,
  computeUnreadCount,
  mergeProjectMembersIntoChannel,
  assertProjectsInWorkspace,
  channelLinksProject,
} = require('../utils/chatAccess');

const USER_POPULATE = 'name email avatar online lastOnline';

const populateChannelMembers = async (members = []) => {
  const ids = [...new Set((members || []).map((m) => toId(m.user)).filter(Boolean))];
  if (!ids.length) return [];
  const profiles = await User.find({ _id: { $in: ids } }).select(USER_POPULATE).lean();
  const map = new Map(profiles.map((u) => [toId(u._id), u]));
  return (members || []).map((m) => {
    const uid = toId(m.user);
    return {
      user: map.get(uid) || { _id: uid },
      role: m.role || 'member',
      lastReadAt: m.lastReadAt,
    };
  });
};
const MESSAGE_POPULATE = [
  { path: 'senderId', select: USER_POPULATE },
  { path: 'mentions', select: 'name avatar' },
];

const buildWorkspaceColorMap = (workspaceDocs = []) => {
  const map = {};
  for (const w of workspaceDocs) {
    if (w?.name) map[normalizeWorkspace(w.name)] = w.color || '#64748b';
  }
  return map;
};

const resolveLinkedProjectIds = (doc) => {
  const fromArray = (doc.linkedProjectIds || []).map(toId).filter(Boolean);
  if (fromArray.length) return fromArray;
  if (doc.type === 'project' && doc.projectId) return [toId(doc.projectId)];
  if (doc.projectId) return [toId(doc.projectId)];
  return [];
};

const parseProjectIdsFromBody = (body) => {
  if (body.projectIds !== undefined) {
    return Array.isArray(body.projectIds)
      ? body.projectIds.filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
  }
  if (body.projectId !== undefined && body.projectId !== null && body.projectId !== '') {
    if (mongoose.Types.ObjectId.isValid(body.projectId)) return [body.projectId];
    return [];
  }
  return undefined;
};

const formatChannel = async (channel, currentUserId, workspaceColorMap = {}) => {
  const doc = channel.toObject ? channel.toObject() : { ...channel };
  const unreadCount = computeUnreadCount(doc, currentUserId);

  let displayName = doc.name || 'Chat';
  let displayAvatar = null;

  const linkedIds = resolveLinkedProjectIds(doc);
  let linkedProjects = [];

  if (linkedIds.length) {
    const projects = await Project.find({ _id: { $in: linkedIds } })
      .select('name color workspace')
      .lean();
    linkedProjects = projects.map((p) => ({
      _id: toId(p._id),
      name: p.name,
      color: p.color || null,
    }));
  }

  let projectWorkspace = doc.workspace ? normalizeWorkspace(doc.workspace) : null;
  const firstProject = linkedProjects[0];
  const projectName = linkedProjects.map((p) => p.name).filter(Boolean).join(', ') || null;
  const projectColor = firstProject?.color || null;
  const projectIdStr = firstProject?._id || null;

  if (doc.type === 'group' || doc.type === 'project') {
    displayName = String(doc.name || '').trim() || firstProject?.name || 'Channel';
    if (!projectWorkspace && firstProject) {
      const full = await Project.findById(firstProject._id).select('workspace').lean();
      if (full) projectWorkspace = normalizeWorkspace(full.workspace);
    }
    if (!projectWorkspace) projectWorkspace = 'GENERAL';
  } else if (doc.type === 'dm') {
    const otherId = (doc.members || [])
      .map((m) => toId(m.user))
      .find((id) => id !== toId(currentUserId));
    if (otherId) {
      const other = await User.findById(otherId).select(USER_POPULATE).lean();
      if (other) {
        displayName = other.name || 'Direct Message';
        displayAvatar = other.avatar || null;
      }
    }
  }

  const workspaceColor = workspaceColorMap[projectWorkspace] || projectColor || '#64748b';
  const members = await populateChannelMembers(doc.members || []);

  return {
    ...doc,
    members,
    displayName,
    displayAvatar,
    projectName,
    projectId: projectIdStr,
    linkedProjectIds: linkedIds,
    linkedProjects,
    projectWorkspace,
    projectColor,
    workspaceColor,
    unreadCount,
  };
};

const populateMessage = (query) =>
  query.populate(MESSAGE_POPULATE).lean();

const resolveMentionsFromContent = async (content) => {
  const users = await User.find({}).select('name email').lean();
  const assets = await Asset.find({}).select('name link').lean();

  const mentionIds = [];
  for (const label of extractUserMentionLabels(content || '')) {
    const u = resolveUserByLabel(label, users);
    if (u?._id) mentionIds.push(u._id);
  }

  const assetMentions = [];
  for (const label of extractAssetMentionLabels(content || '')) {
    const a = resolveAssetByLabel(label, assets);
    if (a?._id) assetMentions.push({ assetId: a._id, label: a.name || label });
  }

  return { mentionIds, assetMentions };
};

const notifyChatMentions = async ({ content, actor, channel }) => {
  const payloads = await buildMentionNotifications({
    text: content,
    previousText: '',
    actor,
    chat: { _id: channel._id, name: channel.name || 'Chat' },
  });

  for (const payload of payloads) {
    await createNotification(payload);
  }
};

const broadcastToChannelMembers = (channel, event, payload) => {
  const channelId = toId(channel._id);
  broadcastRealtimeEvent(`chat-${channelId}`, event, payload);
  for (const m of channel.members || []) {
    const uid = toId(m.user);
    if (uid) broadcastRealtimeEvent(`user-${uid}`, 'chat_inbox', { channelId, event });
  }
};

const buildInitialMembers = (creatorId, memberIds = []) => {
  const ids = new Set([toId(creatorId)]);
  for (const id of memberIds) {
    if (mongoose.Types.ObjectId.isValid(id)) ids.add(toId(id));
  }
  return [...ids].map((uid) => ({
    user: uid,
    role: uid === toId(creatorId) ? 'admin' : 'member',
    lastReadAt: uid === toId(creatorId) ? new Date() : null,
  }));
};

const listChannels = async (req, res) => {
  try {
    const userId = req.user._id;
    const { workspace, projectId } = req.query;
    const workspaceFilter = workspace ? normalizeWorkspace(workspace) : null;

    const channels = await ChatChannel.find({ 'members.user': userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const workspaceDocs = await Workspace.find({}).select('name color').lean();
    const workspaceColorMap = buildWorkspaceColorMap(workspaceDocs);

    const formatted = await Promise.all(
      channels.map((ch) => formatChannel(ch, userId, workspaceColorMap))
    );

    const filterList = (list) => {
      let out = list;
      if (workspaceFilter) {
        out = out.filter((c) => normalizeWorkspace(c.projectWorkspace) === workspaceFilter);
      }
      if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
        out = out.filter((c) => {
          const linked = (c.linkedProjectIds || []).map(toId);
          return linked.includes(toId(projectId)) || toId(c.projectId) === toId(projectId);
        });
      }
      return out;
    };

    const filtered = filterList(formatted);
    const dmChannels = filtered.filter((c) => c.type === 'dm');
    const teamChannels = filtered.filter((c) => c.type !== 'dm');

    const grouped = {
      project: [],
      dm: dmChannels,
      group: teamChannels,
    };

    res.json({
      success: true,
      data: grouped,
      channels: filtered,
      dms: dmChannels,
      groups: teamChannels,
    });
  } catch (error) {
    console.error('listChannels error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getChannel = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const workspaceDocs = await Workspace.find({}).select('name color').lean();
    const data = await formatChannel(
      access.channel,
      req.user._id,
      buildWorkspaceColorMap(workspaceDocs)
    );
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const cursor = req.query.cursor;

    const query = {
      channelId: access.channel._id,
      deletedAt: null,
    };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      query._id = { $lt: cursor };
    }

    const messages = await populateMessage(
      ChatMessage.find(query).sort({ createdAt: -1 }).limit(limit)
    );

    res.json({
      success: true,
      data: messages.reverse(),
      nextCursor: messages.length === limit ? messages[0]?._id : null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const { content = '', attachments = [] } = req.body;
    const trimmed = String(content || '').trim();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!trimmed && !hasAttachments) {
      return res.status(400).json({ success: false, message: 'Message content or attachments required' });
    }

    const { mentionIds, assetMentions } = await resolveMentionsFromContent(trimmed);

    const message = await ChatMessage.create({
      channelId: access.channel._id,
      senderId: req.user._id,
      content: trimmed,
      mentions: mentionIds,
      assetMentions,
      attachments: hasAttachments ? attachments : [],
    });

    const preview = trimmed || (hasAttachments ? '📎 Attachment' : '');
    const now = new Date();
    await ChatChannel.updateOne(
      { _id: access.channel._id },
      {
        $set: {
          lastMessageAt: now,
          lastMessagePreview: preview.slice(0, 120),
          'members.$[member].lastReadAt': now,
        },
      },
      { arrayFilters: [{ 'member.user': req.user._id }] }
    );

    const populated = await populateMessage(ChatMessage.findById(message._id));

    await notifyChatMentions({
      content: trimmed,
      actor: req.user,
      channel: access.channel,
    });

    broadcastToChannelMembers(access.channel, 'chat_message', { message: populated });

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('sendMessage error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const markRead = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const lastReadAt = new Date();
    await ChatChannel.updateOne(
      { _id: access.channel._id },
      { $set: { 'members.$[member].lastReadAt': lastReadAt } },
      { arrayFilters: [{ 'member.user': req.user._id }] }
    );

    broadcastRealtimeEvent(`chat-${toId(access.channel._id)}`, 'chat_read', {
      userId: toId(req.user._id),
      lastReadAt,
    });

    res.json({ success: true, lastReadAt });
  } catch (error) {
    console.error('markRead error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const openDm = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId required' });
    }
    if (toId(userId) === toId(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot DM yourself' });
    }

    const other = await User.findById(userId).select('_id name').lean();
    if (!other) return res.status(404).json({ success: false, message: 'User not found' });

    const dmKey = buildDmKey(req.user._id, userId);
    let channel = await ChatChannel.findOne({ dmKey });

    if (!channel) {
      try {
        channel = await ChatChannel.create({
          type: 'dm',
          dmKey,
          name: other.name || 'Direct Message',
          createdBy: req.user._id,
          members: [
            { user: req.user._id, role: 'member', lastReadAt: new Date() },
            { user: userId, role: 'member', lastReadAt: null },
          ],
        });
      } catch (err) {
        if (err?.code === 11000) {
          channel = await ChatChannel.findOne({ dmKey });
        } else {
          throw err;
        }
      }
    }

    const data = await formatChannel(channel, req.user._id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createGroupChannel = async (req, res) => {
  try {
    const { name, memberIds = [], workspace } = req.body;
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }

    const parsedProjectIds = parseProjectIdsFromBody(req.body);
    const projectIds = parsedProjectIds === undefined ? [] : parsedProjectIds;

    let ws = normalizeWorkspace(workspace || 'GENERAL');
    const projectCheck = await assertProjectsInWorkspace(projectIds, ws, req.user._id);
    if (!projectCheck.ok) {
      return res.status(projectCheck.status).json({ success: false, message: projectCheck.message });
    }
    if (projectCheck.projects.length) {
      ws = normalizeWorkspace(projectCheck.projects[0].workspace || ws);
    }

    const channelData = {
      type: 'group',
      name: trimmedName,
      workspace: ws,
      linkedProjectIds: projectCheck.projects.map((p) => p._id),
      createdBy: req.user._id,
      members: buildInitialMembers(req.user._id, memberIds),
    };

    mergeProjectMembersIntoChannel(channelData, projectCheck.projects);

    let channel;
    try {
      channel = await ChatChannel.create(channelData);
    } catch (err) {
      if (err?.code === 11000 && String(err.message || '').includes('dmKey')) {
        const { repairChatChannelIndexes } = require('../utils/repairChatChannelIndexes');
        await repairChatChannelIndexes();
        channel = await ChatChannel.create(channelData);
      } else {
        throw err;
      }
    }

    const workspaceDocs = await Workspace.find({}).select('name color').lean();
    const data = await formatChannel(channel, req.user._id, buildWorkspaceColorMap(workspaceDocs));
    res.status(201).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateChannel = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    const { channel } = access;
    if (channel.type === 'dm') {
      return res.status(400).json({ success: false, message: 'Direct messages cannot be renamed' });
    }

    const adminEntry = getMemberEntry(channel, req.user._id);
    const isAdmin = isAdminUser(req.user);
    if (!isAdmin && (!adminEntry || adminEntry.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Only channel admins can edit this channel' });
    }

    const { name, workspace } = req.body;
    const parsedProjectIds = parseProjectIdsFromBody(req.body);

    if (name !== undefined) {
      const trimmed = String(name || '').trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Channel name cannot be empty' });
      }
      channel.name = trimmed;
    }

    if (workspace !== undefined) {
      channel.workspace = normalizeWorkspace(workspace) || 'GENERAL';
    }

    if (parsedProjectIds !== undefined) {
      const ws = normalizeWorkspace(channel.workspace);
      const projectCheck = await assertProjectsInWorkspace(parsedProjectIds, ws, req.user._id);
      if (!projectCheck.ok) {
        return res.status(projectCheck.status).json({ success: false, message: projectCheck.message });
      }
      channel.linkedProjectIds = projectCheck.projects.map((p) => p._id);
      mergeProjectMembersIntoChannel(channel, projectCheck.projects);
    } else if (workspace !== undefined && (channel.linkedProjectIds || []).length) {
      const ws = normalizeWorkspace(channel.workspace);
      const ids = channel.linkedProjectIds.map(toId);
      const projectCheck = await assertProjectsInWorkspace(ids, ws, req.user._id);
      if (!projectCheck.ok) {
        return res.status(projectCheck.status).json({ success: false, message: projectCheck.message });
      }
    }

    await channel.save();

    const workspaceDocs = await Workspace.find({}).select('name color').lean();
    const data = await formatChannel(channel, req.user._id, buildWorkspaceColorMap(workspaceDocs));
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateChannelMembers = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    if (access.channel.type !== 'group') {
      return res.status(400).json({ success: false, message: 'Only group channels support member updates' });
    }

    const adminEntry = getMemberEntry(access.channel, req.user._id);
    if (!adminEntry || adminEntry.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only channel admins can manage members' });
    }

    const { add = [], remove = [] } = req.body;
    const memberMap = new Map(
      (access.channel.members || []).map((m) => [toId(m.user), m])
    );

    for (const id of remove) {
      if (!mongoose.Types.ObjectId.isValid(id)) continue;
      if (toId(id) === toId(req.user._id)) continue;
      memberMap.delete(toId(id));
    }

    for (const id of add) {
      if (!mongoose.Types.ObjectId.isValid(id)) continue;
      const uid = toId(id);
      if (!memberMap.has(uid)) {
        memberMap.set(uid, { user: uid, role: 'member', lastReadAt: null });
      }
    }

    access.channel.members = [...memberMap.values()];
    await access.channel.save();

    const data = await formatChannel(access.channel, req.user._id);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const emitTyping = async (req, res) => {
  try {
    const access = await assertChannelAccessById(req.user, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, message: access.message });

    broadcastRealtimeEvent(`chat-${toId(access.channel._id)}`, 'chat_typing', {
      userId: toId(req.user._id),
      name: req.user.name,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** Used by realtime join ACL */
const canJoinChatChannel = async (userId, channelId) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) return false;
  const channel = await ChatChannel.findById(channelId).lean();
  if (!channel) return false;
  const user = await User.findById(userId).select('_id').lean();
  if (!user) return false;
  const access = await assertChannelAccess({ _id: userId }, channel);
  return access.ok;
};

module.exports = {
  listChannels,
  getChannel,
  getMessages,
  sendMessage,
  markRead,
  openDm,
  createGroupChannel,
  updateChannel,
  updateChannelMembers,
  emitTyping,
  canJoinChatChannel,
};
