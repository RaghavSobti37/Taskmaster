import { createLazyWithRetry } from '../../utils/lazyWithRetry';

const lazyWithRetry = createLazyWithRetry;

/** ponytail: code-split artist OS tabs — only active tab chunk loads */
export const ARTIST_OS_TAB_LOADERS = {
  overview: () => lazyWithRetry(() => import('./os/ArtistCommandCenter')),
  calendar: () => lazyWithRetry(() => import('./os/ArtistCalendarTab')),
  inquiries: () => lazyWithRetry(() => import('./os/ArtistInquiriesTab')),
  gigs: () => lazyWithRetry(() => import('./os/ArtistGigsTab')),
  finance: () => lazyWithRetry(() => import('./os/ArtistFinanceTab')),
  analytics: () => lazyWithRetry(() => import('./os/ArtistAnalyticsTab')),
  content: () => lazyWithRetry(() => import('./os/ArtistContentTab')),
  releases: () => lazyWithRetry(() => import('./workspace/ArtistReleasesTab')),
  notes: () => lazyWithRetry(() => import('./os/ArtistNotesTab')),
  documents: () => lazyWithRetry(() => import('./os/ArtistDocumentsTab')),
  contracts: () => lazyWithRetry(() => import('./os/ArtistContractsTab')),
  team: () => lazyWithRetry(() => import('./workspace/ArtistTeamTab')),
};

const osTabCache = new Map();

export function getLazyArtistOsTab(tabId) {
  const loader = ARTIST_OS_TAB_LOADERS[tabId];
  if (!loader) return null;
  if (!osTabCache.has(tabId)) {
    osTabCache.set(tabId, loader());
  }
  return osTabCache.get(tabId);
}

/** Workspace tabs share OS chunks where paths overlap */
export const ARTIST_WORKSPACE_TAB_LOADERS = {
  home: () => lazyWithRetry(() => import('./workspace/tabs/ArtistWorkspaceHome')),
  analytics: () => lazyWithRetry(() => import('./os/ArtistAnalyticsTab')),
  calendar: () => lazyWithRetry(() => import('./os/ArtistCalendarTab')),
  bookings: () => lazyWithRetry(() => import('./workspace/ArtistBookingsTab')),
  finance: () => lazyWithRetry(() => import('./os/ArtistFinanceTab')),
  content: () => lazyWithRetry(() => import('./os/ArtistContentTab')),
  connections: () => lazyWithRetry(() => import('../../components/artists/SocialConnectionsCenter')),
  releases: () => lazyWithRetry(() => import('./workspace/ArtistReleasesTab')),
  team: () => lazyWithRetry(() => import('./workspace/ArtistTeamTab')),
  documents: () => lazyWithRetry(() => import('./os/ArtistDocumentsTab')),
  contracts: () => lazyWithRetry(() => import('./os/ArtistContractsTab')),
  settings: () => lazyWithRetry(() => import('./workspace/tabs/ArtistWorkspaceSettings')),
};

const wsTabCache = new Map();

export function getLazyArtistWorkspaceTab(tabId) {
  const loader = ARTIST_WORKSPACE_TAB_LOADERS[tabId];
  if (!loader) return null;
  if (!wsTabCache.has(tabId)) {
    wsTabCache.set(tabId, loader());
  }
  return wsTabCache.get(tabId);
}
