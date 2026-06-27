import React, { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { canSeeWorkspaceTab, hasArtistPermission } from '../../../utils/artistMemberPermissions';
import { ARTIST_WORKSPACE_TABS, DEFAULT_WORKSPACE_TAB } from './artistWorkspaceConstants';
import { getLazyArtistWorkspaceTab } from '../artistTabLoaders';
import PageSkeleton from '../../../components/ui/PageSkeleton';

export default function ArtistWorkspaceLayout({
  artist,
  artistId,
  membership,
  connections = [],
  normalized,
  connectedProviders = [],
  onSync,
  onSetPrimary,
  addVideoMutation,
  shellNav = true,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const visibleTabs = useMemo(
    () => ARTIST_WORKSPACE_TABS.filter((tab) => canSeeWorkspaceTab(membership, tab.id)),
    [membership],
  );

  const tabParam = searchParams.get('tab') || DEFAULT_WORKSPACE_TAB;
  const resolvedTab = visibleTabs.some((t) => t.id === tabParam)
    ? tabParam
    : (visibleTabs[0]?.id || DEFAULT_WORKSPACE_TAB);

  useEffect(() => {
    if (tabParam !== resolvedTab) {
      const next = new URLSearchParams(searchParams);
      next.set('tab', resolvedTab);
      setSearchParams(next, { replace: true });
    }
  }, [tabParam, resolvedTab, searchParams, setSearchParams]);

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next);
  };

  const panelProps = {
    artistId,
    artist,
    connections,
    normalized,
    connectedProviders,
    isPreview: false,
    isWorkspace: true,
    onSync,
    onSetPrimary,
    addVideoMutation,
  };

  const LazyPanel = useMemo(() => getLazyArtistWorkspaceTab(resolvedTab), [resolvedTab]);

  const renderPanel = () => {
    if (!LazyPanel) return null;
    const Panel = LazyPanel;
    switch (resolvedTab) {
      case 'home':
        return (
          <Panel
            artistId={artistId}
            artist={artist}
            normalized={normalized}
            connections={connections}
            membership={membership}
            isPreview={false}
            onSync={onSync}
          />
        );
      case 'analytics':
        return <Panel {...panelProps} />;
      case 'calendar':
      case 'bookings':
      case 'finance':
      case 'content':
      case 'releases':
      case 'documents':
      case 'contracts':
        return <Panel artistId={artistId} isPreview={false} />;
      case 'connections':
        return (
          <Panel
            artistId={artistId}
            connections={connections}
            isPreview={false}
          />
        );
      case 'team':
        return (
          <Panel
            artistId={artistId}
            membership={membership}
            canManageTeam={hasArtistPermission(membership, 'team')}
          />
        );
      case 'settings':
        return <Panel artistId={artistId} artist={artist} />;
      default:
        return null;
    }
  };

  if (!visibleTabs.length) {
    return (
      <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">
        No workspace sections available for your role.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {!shellNav && (
        <div
          role="tablist"
          aria-label="Artist workspace sections"
          className="flex flex-wrap gap-1 border-b border-[var(--color-bg-border)] pb-2 -mx-1 overflow-x-auto"
        >
          {visibleTabs.map((tab) => {
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
      )}
      <div role="tabpanel">
        <Suspense fallback={<PageSkeleton />} key={resolvedTab}>
          {renderPanel()}
        </Suspense>
      </div>
    </div>
  );
}
