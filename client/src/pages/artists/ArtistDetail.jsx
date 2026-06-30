import React, { useState } from 'react';

import { useParams, useNavigate } from 'react-router-dom';

import { ArrowLeft, Share2, RefreshCw, Music, Edit2, Disc } from 'lucide-react';

import { PageHeader, PageContainer, Button, PageSkeleton } from '../../components/ui';

import { useConfirm } from '../../contexts/confirmContext';

import { useArtistDashboard } from '../../hooks/useArtistDashboard';

import ArtistEditDrawer from '../../components/artists/ArtistEditDrawer';

import ArtistShareModal from '../../components/artists/ArtistShareModal';

import ClaimWorkspaceBanner from '../../components/artists/ClaimWorkspaceBanner';

import ArtistOSLayout from './ArtistOSLayout';



export default function ArtistDetail({ isPreview = false }) {

  const { confirm } = useConfirm();

  const { id } = useParams();

  const navigate = useNavigate();



  const {

    artist,

    isArtistLoading,

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



  const openEdit = () => {

    if (!artist) return;

    setEditedArtist({

      name: artist.name || '',

      bio: artist.bio || '',

      website: artist.website || '',

      spotifyId: artist.oauthCredentials?.spotify?.artistId || connections.find((c) => c.provider === 'spotify')?.accountHandle || '',

      youtubeId: artist.oauthCredentials?.youtube?.channelId || connections.find((c) => c.provider === 'youtube')?.accountHandle || '',

      instaId: artist.oauthCredentials?.meta?.igAccountId || connections.find((c) => c.provider === 'instagram')?.accountHandle || '',

    });

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

    navigate('/artists');

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



  if (!artist) {

    return (

      <PageContainer className="!py-16 text-center">

        <Disc size={48} className="mx-auto mb-4 text-rose-500 opacity-50" />

        <h2 className="text-lg font-black uppercase text-rose-500">Artist Not Found</h2>

        <Button variant="secondary" className="mt-6 mx-auto" onClick={() => navigate('/artists')}>

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

                <Button variant="secondary" size="sm" onClick={() => navigate('/artists')}>

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

