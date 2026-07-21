import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, RefreshCw, Music, Edit2, Disc, Link2 } from 'lucide-react';
import { PageHeader, PageContainer, Button, PageSkeleton } from '../../components/ui';
import { useConfirm } from '../../contexts/confirmContext';
import { useArtistDashboard } from '../../hooks/useArtistDashboard';
import { useOrgPath } from '../../hooks/useOrgPath';

import ArtistEditDrawer from '../../components/artists/ArtistEditDrawer';

import ArtistShareModal from '../../components/artists/ArtistShareModal';
import { cloneSnapshot } from '../../hooks/useUnsavedChanges';
import { buildArtistEditForm } from '../../utils/artistEditForm';

import ClaimWorkspaceBanner from '../../components/artists/ClaimWorkspaceBanner';

import ArtistOSLayout from './ArtistOSLayout';



export default function ArtistDetail({ isPreview = false }) {

  const { confirm } = useConfirm();

  const { id } = useParams();

  const navigate = useNavigate();
  const resolveOrgPath = useOrgPath();



  const {

    artist,
    isArtistLoading,
    previewInvalid,
    shareToken,

    connections,

    normalized,

    connectedProviders,

    syncMutation,

    updateMutation,

    deleteMutation,

    addVideoMutation,

    shareLinkMutation,

    setPrimaryMutation,

  } = useArtistDashboard(id, { isPreview });



  const [syncing, setSyncing] = useState(false);

  const [isEditing, setIsEditing] = useState(false);

  const [isShareOpen, setIsShareOpen] = useState(false);

  const [editedArtist, setEditedArtist] = useState(null);
  const [editBaseline, setEditBaseline] = useState(null);



  const openEdit = () => {

    if (!artist) return;

    const snapshot = buildArtistEditForm(artist, connections);
    setEditedArtist(snapshot);
    setEditBaseline(cloneSnapshot(snapshot));

    setIsEditing(true);

  };



  const saveArtist = async () => {

    const payload = {

      name: editedArtist.name,

      bio: editedArtist.bio,

      website: editedArtist.website,

      oauthCredentials: {

        spotify: { artistId: editedArtist.spotifyId },

        youtube: { channelId: editedArtist.youtubeId },

        meta: { igAccountId: editedArtist.instaId },

      },

    };

    await updateMutation.mutateAsync({ id: artist._id, data: payload });

    setIsEditing(false);

  };



  const handleDelete = async () => {

    const ok = await confirm({ title: 'Remove artist?', message: 'This cannot be undone.', confirmLabel: 'Remove', type: 'danger' });

    if (!ok) return;

    await deleteMutation.mutateAsync(artist._id);

    navigate(resolveOrgPath('/artists'));

  };



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



  if (isArtistLoading) return <PageSkeleton />;

  if (previewInvalid) {
    return (
      <PageContainer className="!py-16 text-center">
        <Link2 size={48} className="mx-auto mb-4 text-amber-500 opacity-50" />
        <h2 className="text-lg font-black uppercase text-amber-600">Invalid Share Link</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-md mx-auto">
          This preview URL is missing a token. Ask your manager for a fresh share link.
        </p>
      </PageContainer>
    );
  }

  if (!artist) {
    return (
      <PageContainer className="!py-16 text-center">
        <Disc size={48} className="mx-auto mb-4 text-rose-500 opacity-50" />
        <h2 className="text-lg font-black uppercase text-rose-500">Artist Not Found</h2>
        <Button variant="secondary" className="mt-6 mx-auto" onClick={() => navigate(resolveOrgPath('/artists'))}>
          <ArrowLeft size={16} /> Back to Roster
        </Button>
      </PageContainer>
    );
  }



  return (

    <PageContainer className="!py-4 !space-y-6 bg-[#F8FAFC] dark:bg-[#0B0F19] min-h-screen">

      {isPreview && shareToken && (

        <ClaimWorkspaceBanner artistId={id} shareToken={shareToken} team={artist?.team} />

      )}



      <PageHeader

        title={artist.name}

        icon={Music}

        actions={

          <div className="flex flex-wrap items-center gap-2">

            {!isPreview && (

              <>

                <Button variant="secondary" size="sm" onClick={() => navigate(resolveOrgPath('/artists'))}>

                  <ArrowLeft size={14} /> Roster

                </Button>

                <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>

                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> Sync

                </Button>

              </>

            )}

            {!isPreview && (

              <Button variant="secondary" size="sm" onClick={openEdit}>

                <Edit2 size={14} /> Edit

              </Button>

            )}

            {!isPreview && (

              <Button size="sm" onClick={() => setIsShareOpen(true)}>

                <Share2 size={14} /> Share

              </Button>

            )}

          </div>

        }

      />



      <ArtistOSLayout

        artist={artist}

        artistId={id}

        connections={connections}

        normalized={normalized}

        connectedProviders={connectedProviders}

        isPreview={isPreview}

        shareToken={shareToken}

        onSync={handleSync}

        onSetPrimary={handleSetPrimary}

        addVideoMutation={addVideoMutation}

      />



      <ArtistEditDrawer

        isOpen={isEditing}

        onClose={() => setIsEditing(false)}

        artist={artist}

        editedArtist={editedArtist}

        setEditedArtist={setEditedArtist}

        editBaseline={editBaseline}

        onSave={saveArtist}

        onDelete={handleDelete}

        isPreview={isPreview}

      />

      <ArtistShareModal

        isOpen={isShareOpen}

        onClose={() => setIsShareOpen(false)}

        artistId={id}

        artistName={artist.name}

        artistSlug={artist.slug}

        shareLinkMutation={shareLinkMutation}

      />

    </PageContainer>

  );

}

