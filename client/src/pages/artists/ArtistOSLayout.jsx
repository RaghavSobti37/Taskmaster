import React, { Suspense, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ARTIST_OS_TABS } from './os/artistOsConstants';
import { getLazyArtistOsTab } from './artistTabLoaders';
import PageSkeleton from '../../components/ui/PageSkeleton';

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

  React.useEffect(() => {
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

  const LazyPanel = useMemo(() => getLazyArtistOsTab(resolvedTab), [resolvedTab]);

  const renderPanel = () => {
    if (!LazyPanel) return null;
    const Panel = LazyPanel;
    switch (resolvedTab) {
      case 'overview':
        return <Panel {...panelProps} />;
      case 'calendar':
      case 'inquiries':
      case 'gigs':
      case 'finance':
      case 'content':
      case 'releases':
      case 'notes':
      case 'documents':
      case 'contracts':
        return <Panel artistId={artistId} isPreview={isPreview} />;
      case 'analytics':
        return <Panel {...panelProps} />;
      case 'team':
        return <Panel artistId={artistId} canManageTeam={!isPreview} />;
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
      <div role="tabpanel">
        <Suspense fallback={<PageSkeleton />} key={resolvedTab}>
          {renderPanel()}
        </Suspense>
      </div>
    </div>
  );
}
