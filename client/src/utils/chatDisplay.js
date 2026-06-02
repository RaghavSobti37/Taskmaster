import { DEFAULT_WORKSPACE_COLOR } from './workspaceColors';
import { formatLastActivity } from './formatLastActivity';
import { format, isToday, isYesterday, isThisYear } from 'date-fns';

export function getChatHeaderStyle(channel) {
  const accent = channel?.workspaceColor || channel?.projectColor || DEFAULT_WORKSPACE_COLOR;
  return {
    background: `color-mix(in srgb, ${accent} 14%, var(--color-bg-surface))`,
    borderBottom: `1px solid var(--color-bg-border)`,
  };
}

export function isImageAttachment(att) {
  const t = String(att?.type || '').toLowerCase();
  const n = String(att?.name || att?.url || '').toLowerCase();
  return (
    t.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?|$)/i.test(n)
  );
}

export function formatChatListTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  if (isThisYear(d)) return format(d, 'MMM d');
  return format(d, 'dd/MM/yyyy');
}

export function formatMessageTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'HH:mm');
}

export function formatDateDivider(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMMM d, yyyy');
}

export function getDmOtherUserId(channel, currentUserId) {
  if (!channel || channel.type !== 'dm') return null;
  const uid = String(currentUserId || '');
  const other = (channel.members || []).find((m) => {
    const id = String(m.user?._id || m.user || '');
    return id && id !== uid;
  });
  return other ? String(other.user?._id || other.user) : null;
}

export function getChannelListAvatar(channel) {
  const name = channel?.displayName || channel?.name || '?';
  if (channel?.type === 'dm' && channel?.displayAvatar) {
    return { src: channel.displayAvatar, initials: name.charAt(0).toUpperCase(), isGroup: false };
  }
  if (channel?.type === 'dm') {
    return { src: null, initials: name.charAt(0).toUpperCase(), isGroup: false };
  }
  return { src: null, initials: name.slice(0, 2).toUpperCase(), isGroup: true };
}

export function getHeaderStatus(channel, users = [], currentUserId) {
  if (!channel) return '';
  if (channel.type === 'dm') {
    const otherId = getDmOtherUserId(channel, currentUserId);
    const other = users.find((u) => String(u._id) === otherId);
    if (other?.online) return 'Online';
    return 'Offline';
  }
  const count = channel.members?.length || 0;
  if (count > 0) return `${count} member${count === 1 ? '' : 's'}`;
  return 'Channel';
}

export function isUserOnlineInList(users, userId) {
  if (!userId) return false;
  const u = users.find((x) => String(x._id) === String(userId));
  return Boolean(u?.online);
}

/** Resolve channel.members[] to profiles (server-populated user or user directory fallback). */
export function getChannelMembers(channel, usersDirectory = []) {
  const raw = channel?.members || [];
  const byId = new Map((usersDirectory || []).map((u) => [String(u._id), u]));

  const resolved = raw
    .map((m) => {
      const embedded =
        m.user && typeof m.user === 'object' && (m.user.name || m.user.email) ? m.user : null;
      const uid = String(embedded?._id || m.user || '');
      if (!uid) return null;
      const fromDir = byId.get(uid);
      const profile = embedded || fromDir || null;
      return {
        _id: uid,
        role: m.role || 'member',
        name: profile?.name || profile?.email || 'Unknown',
        email: profile?.email || null,
        avatar: profile?.avatar || null,
        online: Boolean(profile?.online),
        lastOnline: profile?.lastOnline || null,
      };
    })
    .filter(Boolean);

  return resolved.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function formatMemberPresence(member) {
  if (!member) return '';
  if (member.online) return 'Online';
  return formatLastActivity(member.lastOnline);
}

/** User records eligible for @mentions in this channel (excludes self optional — include all members). */
export function getChannelMentionUsers(channel, usersDirectory = [], currentUserId = null) {
  const members = getChannelMembers(channel, usersDirectory);
  if (!members.length) return [];
  const uid = currentUserId ? String(currentUserId) : null;
  return members
    .filter((m) => !uid || m._id !== uid)
    .map((m) => ({
      _id: m._id,
      name: m.name,
      email: m.email,
      avatar: m.avatar,
      online: m.online,
      lastOnline: m.lastOnline,
      role: m.role,
    }));
}

export function groupMessagesWithDates(messages = []) {
  const items = [];
  let lastDay = null;
  for (const msg of messages) {
    if (!msg?.createdAt) {
      items.push({ type: 'message', key: msg._id, message: msg });
      continue;
    }
    const dayKey = format(new Date(msg.createdAt), 'yyyy-MM-dd');
    if (dayKey !== lastDay) {
      lastDay = dayKey;
      items.push({
        type: 'date',
        key: `date-${dayKey}`,
        label: formatDateDivider(msg.createdAt),
      });
    }
    items.push({ type: 'message', key: msg._id, message: msg });
  }
  return items;
}
