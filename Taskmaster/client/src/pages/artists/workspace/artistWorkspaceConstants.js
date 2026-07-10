/** Panel routing — permission checks via canSeeWorkspaceTab in layout/shell. */
export const ARTIST_WORKSPACE_TABS = [
  { id: 'home', label: 'Dashboard' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'finance', label: 'Finance' },
  { id: 'content', label: 'Content' },
  { id: 'connections', label: 'Connections' },
  { id: 'releases', label: 'Releases' },
  { id: 'documents', label: 'Documents' },
  { id: 'team', label: 'Team' },
  { id: 'contracts', label: 'Contracts' },
  { id: 'settings', label: 'Settings' },
];

/** Slim sidebar nav — same ids as tabs; contracts omitted from artist-facing nav. */
export const ARTIST_WORKSPACE_NAV = ARTIST_WORKSPACE_TABS.filter((t) => t.id !== 'contracts');

export const DEFAULT_WORKSPACE_TAB = 'home';
