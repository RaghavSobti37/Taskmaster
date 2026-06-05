import { DEFAULT_NAVBAR_GROUPS as NAVBAR_GROUPS } from './navbarConfig';

/** Default sidebar groups (mirrors server NavbarPreference.DEFAULT_NAVBAR_GROUPS). */
export const DEFAULT_NAVBAR_GROUPS = NAVBAR_GROUPS;

export function sortNavbarGroups(groups) {
  return (groups || [])
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((g) => ({
      ...g,
      pages: (g.pages || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)),
    }));
}
