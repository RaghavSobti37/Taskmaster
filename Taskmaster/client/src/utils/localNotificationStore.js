const MAX_NOTIFICATIONS = 50;
const storageKey = (userId) => `coreknot_inbox_${userId}`;

const ALLOWED_CATEGORIES = [
  'all',
  'task',
  'review',
  'crm',
  'attendance',
  'announcement',
  'department',
  'system',
];

export const loadNotifications = (userId) => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveNotifications = (userId, notifications) => {
  if (!userId) return [];
  const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(trimmed));
  } catch (_) {}
  return trimmed;
};

export const addNotification = (userId, notification) => {
  if (!userId || !notification) return loadNotifications(userId);
  const existing = loadNotifications(userId);
  const id = notification._id || notification.id || crypto.randomUUID();
  const entry = {
    ...notification,
    _id: id,
    read: Boolean(notification.read),
    createdAt: notification.createdAt || new Date().toISOString(),
  };
  const deduped = existing.filter((n) => n._id !== id);
  return saveNotifications(userId, [entry, ...deduped]);
};

export const markNotificationRead = (userId, id) => {
  const list = loadNotifications(userId).map((n) =>
    n._id === id ? { ...n, read: true } : n
  );
  return saveNotifications(userId, list);
};

export const markAllNotificationsRead = (userId) => {
  const list = loadNotifications(userId).map((n) => ({ ...n, read: true }));
  return saveNotifications(userId, list);
};

export const clearAllNotifications = (userId) => {
  saveNotifications(userId, []);
  return [];
};

export const getUnreadCounts = (notifications = []) => {
  const byCategory = {};
  let unread = 0;
  for (const n of notifications) {
    if (n.read) continue;
    unread += 1;
    if (n.category) {
      byCategory[n.category] = (byCategory[n.category] || 0) + 1;
    }
  }
  return { unread, byCategory };
};

export const getNotificationsPayload = (userId, departmentSlug = '') => ({
  notifications: loadNotifications(userId),
  allowedCategories: ALLOWED_CATEGORIES,
  departmentSlug,
});
