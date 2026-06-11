import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ARTIST_OS_TABS } from './os/artistOsConstants';
import ArtistCommandCenter from './os/ArtistCommandCenter';
import ArtistCalendarTab from './os/ArtistCalendarTab';
import ArtistInquiriesTab from './os/ArtistInquiriesTab';
import ArtistGigsTab from './os/ArtistGigsTab';
import ArtistFinanceTab from './os/ArtistFinanceTab';
import ArtistAnalyticsTab from './os/ArtistAnalyticsTab';
import ArtistContentTab from './os/ArtistContentTab';
import ArtistReleasesTab from './workspace/ArtistReleasesTab';
import ArtistNotesTab from './os/ArtistNotesTab';
import ArtistDocumentsTab from './os/ArtistDocumentsTab';
import ArtistContractsTab from './os/ArtistContractsTab';
import ArtistTeamTab from './workspace/ArtistTeamTab';

export default function ArtistOSLayout({
  artist,
  artistId,
  connections = [],
  normalized,
  connectedProviders = [],
  isPreview,
  shareToken,
  onSync,
  onSetPrimary,
  addVideoMutation,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') || 'overview';
  const resolvedTab = ARTIST_OS_TABS.some((t) => t.id === tabParam) ? tabParam : 'overview';

  useEffect(() => {
    if (tabParam !== resolvedTab) {
      setSearchParams({ tab: resolvedTab }, { replace: true });
    }
  }, [tabParam, resolvedTab, setSearchParams]);

  const setTab = (id) => setSearchParams({ tab: id });

  const panelProps = {
    artistId,
    artist,
    connections,
    normalized,
    connectedProviders,
    isPreview,
    shareToken,
    onSync,
    onSetPrimary,
    addVideoMutation,
  };

  const renderPanel = () => {
    switch (resolvedTab) {
      case 'overview':
        return <ArtistCommandCenter {...panelProps} />;
      case 'calendar':
        return <ArtistCalendarTab artistId={artistId} isPreview={isPreview} />;
      case 'inquiries':
        return <ArtistInquiriesTab artistId={artistId} isPreview={isPreview} />;
      case 'gigs':
        return <ArtistGigsTab artistId={artistId} isPreview={isPreview} />;
      case 'finance':
        return <ArtistFinanceTab artistId={artistId} isPreview={isPreview} />;
      case 'analytics':
        return <ArtistAnalyticsTab {...panelProps} />;
      case 'content':
        return <ArtistContentTab artistId={artistId} isPreview={isPreview} />;
      case 'releases':
        return <ArtistReleasesTab artistId={artistId} isPreview={isPreview} />;
      case 'notes':
        return <ArtistNotesTab artistId={artistId} isPreview={isPreview} />;
      case 'documents':
        return <ArtistDocumentsTab artistId={artistId} artistName={artist?.name} isPreview={isPreview} />;
      case 'contracts':
        return <ArtistContractsTab artistId={artistId} isPreview={isPreview} />;
      case 'team':
        return <ArtistTeamTab artistId={artistId} canManageTeam={!isPreview} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Artist OS sections"
        className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2 -mx-1 overflow-x-auto"
      >
        {ARTIST_OS_TABS.map((tab) => {
          const active = tab.id === resolvedTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[var(--token-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-action-primary)]/30'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--token-surface-2)]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{renderPanel()}</div>
    </div>
  );
}
