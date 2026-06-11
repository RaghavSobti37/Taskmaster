import React, { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Link2 } from 'lucide-react';
import { Button, PageSkeleton } from '../../../components/ui';
import { useAuth } from '../../../contexts/AuthContext';
import { useArtistDashboard } from '../../../hooks/useArtistDashboard';
import { useArtistMembership } from '../../../hooks/queries/artistMembers';
import {
  hasArtistPermission,
  DEFAULT_PERMISSIONS_BY_ROLE,
  SYNC_PERMISSION,
} from '../../../utils/artistMemberPermissions';
import { isArtistManagerUser } from '../../../utils/pagePermissions';
import ConnectSocialModal from '../../../components/artists/ConnectSocialModal';
import ArtistWorkspaceLayout from './ArtistWorkspaceLayout';

export default function ArtistWorkspaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: membership, isLoading: membershipLoading } = useArtistMembership(id);
  const {
    artist,
    isArtistLoading,
    connections,
    normalized,
    connectedProviders,
    syncMutation,
    addVideoMutation,
    setPrimaryMutation,
  } = useArtistDashboard(id, { isPreview: false });

  const [syncing, setSyncing] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const isManager = isArtistManagerUser(user);
  const effectiveMembership = useMemo(() => {
    if (membership) return membership;
    if (isManager) {
      return {
        role: 'artist-manager',
        permissions: DEFAULT_PERMISSIONS_BY_ROLE['artist-manager'],
        managerOverride: true,
      };
    }
    return null;
  }, [membership, isManager]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncMutation.mutateAsync(id);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetPrimary = async (connectionId) => {
    if (!connectionId) return;
    await setPrimaryMutation.mutateAsync({ artistId: id, connectionId });
    handleSync();
  };

  if (isArtistLoading || membershipLoading) return <PageSkeleton />;

  if (!artist) {
    return (
      <div className="py-16 text-center">
        <h2 className="text-lg font-black uppercase text-rose-500">Artist Not Found</h2>
      </div>
    );
  }

  const canSync = hasArtistPermission(effectiveMembership, SYNC_PERMISSION);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setConnectOpen(true)}>
          <Link2 size={14} /> Connect platforms
        </Button>
        {canSync && (
          <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sync
          </Button>
        )}
      </div>

      <ArtistWorkspaceLayout
        artist={artist}
        artistId={id}
        membership={effectiveMembership}
        connections={connections}
        normalized={normalized}
        connectedProviders={connectedProviders}
        onSync={handleSync}
        onSetPrimary={handleSetPrimary}
        addVideoMutation={addVideoMutation}
      />

      <ConnectSocialModal
        isOpen={connectOpen}
        onClose={() => setConnectOpen(false)}
        artistId={id}
        connections={connections}
      />
    </>
  );
}
