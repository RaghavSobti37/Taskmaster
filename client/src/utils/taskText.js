import { ADMIN_SLUG, OPS_SLUG, SALES_SLUG, ARTIST_SLUG } from './departmentPermissions';

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

/** Suggest project hierarchy role from user department slug. */
export function suggestProjectRole(profileDepartmentSlug) {
  const normalized = String(profileDepartmentSlug || '').toLowerCase();
  if (normalized === ADMIN_SLUG) return 'admin';
  if ([OPS_SLUG, ARTIST_SLUG, SALES_SLUG].includes(normalized)) return 'manager';
  return 'member';
}
