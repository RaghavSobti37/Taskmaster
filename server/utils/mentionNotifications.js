const User = require('../models/User');
const { extractUserMentionLabels, extractUserMentionLabelsFromFields, resolveUserByLabel } = require('../../shared/mentionTokens');
const { buildTaskActionUrl } = require('./notificationActionUrl');

const normalizeLabel = (value) => String(value || '').trim().toLowerCase();

const labelsAddedSince = (nextText, previousText) => {
  const prev = new Set(extractUserMentionLabels(previousText || '').map(normalizeLabel));
  return extractUserMentionLabels(nextText).filter((label) => !prev.has(normalizeLabel(label)));
};

/** Resolve @mention labels in task title/description to user ids. */
const resolveMentionedUserIds = async (title, description) => {
  const labels = extractUserMentionLabelsFromFields(title, description);
  if (!labels.length) return new Set();

  const users = await User.find({}).select('name email').lean();
  const ids = new Set();
  for (const label of labels) {
    const mentioned = resolveUserByLabel(label, users);
    if (mentioned?._id) ids.add(mentioned._id.toString());
  }
  return ids;
};

const isMentionOnlyUser = (userId, assigneeIds, mentionedUserIds) => {
  const uid = userId?.toString?.();
  if (!uid || !mentionedUserIds?.has(uid)) return false;
  const assigneeSet = new Set((assigneeIds || []).map((id) => id?.toString()).filter(Boolean));
  return !assigneeSet.has(uid);
};

/**
 * Build in-app notification payloads for newly @mentioned users.
 * Skips actor, task assignees (they already get assignment notifications), and unresolved names.
 */
const buildMentionNotifications = async ({
  text,
  previousText = '',
  actor,
  assigneeIds = [],
  task = null,
  asset = null,
}) => {
  if (!text || !actor?._id) return [];

  const addedLabels = labelsAddedSince(text, previousText);
  if (!addedLabels.length) return [];

  const users = await User.find({}).select('name email').lean();
  const assigneeSet = new Set(assigneeIds.map((id) => id?.toString()).filter(Boolean));
  const actorId = actor._id.toString();
  const notified = new Set();
  const payloads = [];

  for (const label of addedLabels) {
    const mentioned = resolveUserByLabel(label, users);
    if (!mentioned) continue;

    const recipientId = mentioned._id.toString();
    if (recipientId === actorId) continue;
    if (task && assigneeSet.has(recipientId)) continue;
    if (notified.has(recipientId)) continue;
    notified.add(recipientId);

    if (task) {
      payloads.push({
        recipientId,
        title: 'Mentioned in Task',
        message: `${actor.name} mentioned you in "${task.title}"`,
        category: 'task',
        type: 'system',
        relatedTaskId: task._id,
        relatedProjectId: task.projectId,
        actionUrl: buildTaskActionUrl(task),
        actorId: actor._id,
        iconType: 'user',
      });
      continue;
    }

    if (asset) {
      payloads.push({
        recipientId,
        title: 'Mentioned in Asset',
        message: `${actor.name} mentioned you in notes for "${asset.name}"`,
        category: 'task',
        type: 'system',
        actionUrl: `/assets?highlight=${asset._id}`,
        actorId: actor._id,
        iconType: 'user',
      });
      continue;
    }
  }

  return payloads;
};

module.exports = {
  buildMentionNotifications,
  labelsAddedSince,
  resolveMentionedUserIds,
  isMentionOnlyUser,
};
