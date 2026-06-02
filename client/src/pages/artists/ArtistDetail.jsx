import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, RefreshCw, Music, Edit2, Plus, Disc,
} from 'lucide-react';
import {
  PageHeader, PageContainer, Button, PageSkeleton, TabSwitcher, Input, FullScreenWorkspace,
} from '../../components/ui';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useArtistDashboard } from '../../hooks/useArtistDashboard';
import { useArtistAnalytics } from '../../hooks/useTaskmasterQueries';
import { formatChartData } from '../../utils/analyticsDataUtils';
import { analyticsIntegrations } from '../../config/integrations.config';

import UnifiedReachCard from '../../components/artists/UnifiedReachCard';
import PlatformSummaryCards from '../../components/artists/PlatformSummaryCards';
import MetricChart from '../../components/artists/MetricChart';
import AssetTable from '../../components/artists/AssetTable';
import ArtistEditDrawer from '../../components/artists/ArtistEditDrawer';
import ClaimWorkspaceBanner from '../../components/artists/ClaimWorkspaceBanner';

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

  const [activeTab, setActiveTab] = useState('spotify');
  const [timeframe, setTimeframe] = useState('28D');
  const [accountId, setAccountId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedArtist, setEditedArtist] = useState(null);
  const [videoFilter, setVideoFilter] = useState('all');
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideo, setNewVideo] = useState({ url: '', title: '', channelName: '' });

  const analyticsPlatform = activeTab === 'meta' ? 'instagram' : activeTab;
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useArtistAnalytics(
    id,
    analyticsPlatform,
    timeframe,
    accountId,
    !!id
  );
  const summaryProviders = useMemo(() => {
    const base = ['spotify', 'youtube', 'instagram'];
    if (connections.some((c) => c.provider === 'facebook' && c.accountHandle)) base.push('facebook');
    return base;
  }, [connections]);

  const tabs = useMemo(() => {
    const integrations = analyticsIntegrations();
    const connected = connectedProviders.length
      ? integrations.filter((p) => connectedProviders.includes(p.id) || (p.id === 'instagram' && connectedProviders.includes('meta')))
      : integrations.filter((p) => ['spotify', 'youtube', 'instagram'].includes(p.id));
    return connected.map((p) => ({ id: p.id === 'instagram' ? 'instagram' : p.id, label: p.tabLabel }));
  }, [connectedProviders]);

  useEffect(() => {
    if (tabs.length && !tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

  const historyKey = activeTab === 'instagram' ? 'meta' : activeTab;
  const chartData = formatChartData(analyticsData?.history?.[historyKey] || analyticsData?.history?.[activeTab] || [], activeTab);

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

  const handleShare = async () => {
    try {
      const { url } = await shareLinkMutation.mutateAsync(id);
      await navigator.clipboard.writeText(url);
      alert(`Share link copied:\n${url}`);
    } catch {
      const fallback = `${window.location.origin}/preview/artist/${id}`;
      await navigator.clipboard.writeText(fallback);
      alert(`Preview link copied:\n${fallback}`);
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

  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const posts = analyticsData?.posts || [];

  return (
    <PageContainer className="!py-4 !space-y-6 bg-[#F8FAFC] dark:bg-[#0B0F19] min-h-screen">
      {isPreview && shareToken && (
        <ClaimWorkspaceBanner artistId={id} shareToken={shareToken} />
      )}

      <PageHeader
        title={artist.name}
        subtitle={`Artist Workspace · ${connections.filter((c) => c.accountHandle).length} connections · ${artist.isSynced ? 'Synced' : 'Pending sync'}`}
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
            <Button variant="secondary" size="sm" onClick={openEdit}>
              <Edit2 size={14} /> Edit
            </Button>
            {!isPreview && (
              <Button size="sm" onClick={handleShare}>
                <Share2 size={14} /> Share
              </Button>
            )}
          </div>
        }
      />

      <UnifiedReachCard
        normalized={normalized || analyticsData?.normalized}
        connectionCount={connections.filter((c) => c.accountHandle).length}
        artist={artist}
      />

      <PlatformSummaryCards
        artist={artist}
        normalized={normalized || analyticsData?.normalized}
        connections={connections}
        onSetPrimary={handleSetPrimary}
        providers={summaryProviders}
      />

      <MetricChart
        chartData={chartData}
        activeTab={activeTab}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabSwitcher activeTab={activeTab} onChange={setActiveTab} tabs={tabs.length ? tabs : [{ id: 'spotify', label: 'Spotify' }, { id: 'youtube', label: 'YouTube' }, { id: 'instagram', label: 'Instagram' }]} />
          {activeTab === 'youtube' && !isPreview && (
            <Button size="sm" onClick={() => setShowAddVideo(true)}>
              <Plus size={14} /> Add Featured Video
            </Button>
          )}
        </div>

        <AssetTable
          activeTab={activeTab}
          tracks={tracks}
          videos={videos}
          posts={posts}
          loading={isAnalyticsLoading}
          videoFilter={videoFilter}
          onVideoFilterChange={setVideoFilter}
        />
      </div>

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

      <FullScreenWorkspace
        isOpen={showAddVideo}
        onClose={() => { setShowAddVideo(false); setNewVideo({ url: '', title: '', channelName: '' }); }}
        title="Add Featured Video"
        subtitle="Track collab / guest appearance stats"
        hasChanges={showAddVideo && !!(newVideo.url || newVideo.title || newVideo.channelName)}
        onCancel={() => setNewVideo({ url: '', title: '', channelName: '' })}
        onSave={async () => {
          if (!newVideo.url) return alert('YouTube URL required');
          await addVideoMutation.mutateAsync({ id, data: newVideo });
          setShowAddVideo(false);
          setNewVideo({ url: '', title: '', channelName: '' });
        }}
      >
        <div className="space-y-4 max-w-lg mx-auto p-4">
          <Input label="YouTube URL *" value={newVideo.url} onChange={(e) => setNewVideo({ ...newVideo, url: e.target.value })} />
          <Input label="Title" value={newVideo.title} onChange={(e) => setNewVideo({ ...newVideo, title: e.target.value })} />
          <Input label="Channel" value={newVideo.channelName} onChange={(e) => setNewVideo({ ...newVideo, channelName: e.target.value })} />
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
