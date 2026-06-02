const mongoose = require('mongoose');
const Project = require('../models/Project');
const ChatChannel = require('../models/ChatChannel');

const toId = (id) => (id?.toString?.() || String(id));

const normalizeWorkspace = (name) => String(name || 'GENERAL').toUpperCase().trim();

const isProjectMember = (project, userId) => {
  const uid = toId(userId);
  if (!project || !uid) return false;
  if (toId(project.owner) === uid) return true;
  return (project.members || []).some((m) => toId(m) === uid || toId(m?._id) === uid);
};

const collectProjectMemberIds = (project) => {
  const memberIds = new Set();
  if (project?.owner) memberIds.add(toId(project.owner));
  (project?.members || []).forEach((m) => memberIds.add(toId(m)));
  return memberIds;
};

const mergeProjectMembersIntoChannel = (channel, projects = []) => {
  const existing = new Map((channel.members || []).map((m) => [toId(m.user), m]));
  const creatorId = toId(channel.createdBy);

  for (const project of projects) {
    for (const uid of collectProjectMemberIds(project)) {
      if (!uid) continue;
      if (!existing.has(uid)) {
        existing.set(uid, {
          user: uid,
          role: uid === creatorId ? 'admin' : 'member',
          lastReadAt: null,
        });
      }
    }
  }

  channel.members = [...existing.values()];
};

const assertProjectsInWorkspace = async (projectIds, workspace, userId) => {
  const ws = normalizeWorkspace(workspace);
  const ids = [...new Set((projectIds || []).map(toId).filter(Boolean))];
  if (!ids.length) return { ok: true, projects: [] };

  const projects = await Project.find({ _id: { $in: ids } })
    .select('owner members workspace name')
    .lean();

  if (projects.length !== ids.length) {
    return { ok: false, status: 404, message: 'One or more projects not found' };
  }

  for (const project of projects) {
    if (normalizeWorkspace(project.workspace) !== ws) {
      return {
        ok: false,
        status: 400,
        message: 'All linked projects must belong to the channel workspace',
      };
    }
    if (!isProjectMember(project, userId)) {
      return { ok: false, status: 403, message: 'Not a member of one or more linked projects' };
    }
  }

  return { ok: true, projects };
};

const buildDmKey = (userIdA, userIdB) => {
  const ids = [toId(userIdA), toId(userIdB)].sort();
  return `${ids[0]}:${ids[1]}`;
};

const isChannelMember = (channel, userId) => {
  const uid = toId(userId);
  return (channel.members || []).some((m) => toId(m.user) === uid);
};

const assertChannelAccess = async (user, channel) => {
  if (!channel) return { ok: false, status: 404, message: 'Channel not found' };

  if (!isChannelMember(channel, user._id)) {
    return { ok: false, status: 403, message: 'Not authorized for this channel' };
  }

  return { ok: true };
};

const assertChannelAccessById = async (user, channelId) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return { ok: false, status: 400, message: 'Invalid channel id' };
  }
  const channel = await ChatChannel.findById(channelId);
  if (!channel) return { ok: false, status: 404, message: 'Channel not found' };
  const access = await assertChannelAccess(user, channel);
  if (!access.ok) return { ...access, channel: null };
  return { ...access, channel };
};

const getMemberEntry = (channel, userId) =>
  (channel.members || []).find((m) => toId(m.user) === toId(userId));

const computeUnreadCount = (channel, userId) => {
  const entry = getMemberEntry(channel, userId);
  const lastRead = entry?.lastReadAt ? new Date(entry.lastReadAt).getTime() : 0;
  const lastMsg = channel.lastMessageAt ? new Date(channel.lastMessageAt).getTime() : 0;
  if (!lastMsg) return 0;
  return lastRead < lastMsg ? 1 : 0;
};

const channelLinksProject = (channel, projectId) => {
  const pid = toId(projectId);
  if (!pid) return false;
  const linked = (channel.linkedProjectIds || []).map(toId);
  if (linked.includes(pid)) return true;
  if (channel.projectId && toId(channel.projectId) === pid) return true;
  return false;
};

module.exports = {
  toId,
  normalizeWorkspace,
  isProjectMember,
  collectProjectMemberIds,
  mergeProjectMembersIntoChannel,
  assertProjectsInWorkspace,
  buildDmKey,
  isChannelMember,
  assertChannelAccess,
  assertChannelAccessById,
  getMemberEntry,
  computeUnreadCount,
  channelLinksProject,
};
