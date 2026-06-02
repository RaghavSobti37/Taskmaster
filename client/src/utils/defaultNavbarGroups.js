import { PAGE_GROUPS } from './pagePermissions';

/** Default sidebar groups (mirrors server NavbarPreference.DEFAULT_NAVBAR_GROUPS). */
export const DEFAULT_NAVBAR_GROUPS = PAGE_GROUPS.map((group, idx) => ({
  id: group.id,
  title: group.label,
  order: idx + 1,
  visible: true,
  isCustom: false,
  pages: group.pages.map((page, pIdx) => ({
    path: page.path,
    label: page.label,
    order: pIdx + 1,
    visible: true,
  })),
}));

export function sortNavbarGroups(groups) {
  return (groups || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((g) => ({
      ...g,
      pages: (g.pages || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    }));
}
