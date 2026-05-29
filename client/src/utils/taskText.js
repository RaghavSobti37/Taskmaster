/** Plain-text preview for task descriptions (markdown-ish bug reports, notes). */
export function taskDescriptionPlainText(description) {
  if (!description || typeof description !== 'string') return '';

  return description
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/\*(.*?)\*/gs, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`+/g, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .trim();
}

export function taskDescriptionPreview(description, maxLength = 140) {
  const plain = taskDescriptionPlainText(description)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' · ');

  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}…`;
}

export const PROJECT_ROLE_OPTIONS = [
  { value: 'owner', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'User' },
];

/** Suggest project hierarchy role from user profile role. */
export function suggestProjectRole(profileRole) {
  const normalized = String(profileRole || '').toLowerCase();
  if (normalized === 'admin') return 'owner';
  if (['ops', 'operations', 'artist_management', 'sales'].includes(normalized)) return 'manager';
  return 'member';
}
