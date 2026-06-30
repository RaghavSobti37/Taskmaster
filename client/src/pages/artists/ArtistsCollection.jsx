import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, TrendingUp, RefreshCw, Globe, BarChart3,
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { Badge, DataTable, Button, TabSwitcher, PageSkeleton, Input, ListPageLayout, SearchInput, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { NexusModal } from '../../components/ui/modals';;
import { distributionFromField } from '../../utils/buildChartSeries';
import { useArtists, useCreateArtist, useSyncArtistStats } from '../../hooks/useTaskmasterQueries';
import { formatNumber } from '../../config/integrations.config';

const getArtistEmoji = (name = '') => {
  if (name.includes('Yugm')) return '🎸';
  if (name.includes('Mohit')) return '🎤';
  if (name.includes('Harshad')) return '🎵';
  return '✨';
};

const formatNumberLocal = (num) => {
  if (num == null || isNaN(num)) return 'N/A';
  return formatNumber(num);
};

export default function ArtistsCollection() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const { data: artists = [], isLoading, isError, error, refetch } = useArtists();
  const createMutation = useCreateArtist();
  const syncMutation = useSyncArtistStats();

  const [newArtist, setNewArtist] = useState({
    name: '', bio: '', website: '', spotifyId: '', youtubeId: '', instaId: ''
  });

  const handleAddArtistSubmit = async (e) => {
    e.preventDefault();
    if (!newArtist.name) return alert('Artist Name is required');
    try {
      const payload = {
        name: newArtist.name,
        bio: newArtist.bio || `${newArtist.name} official roster artist.`,
        website: newArtist.website,
        oauthCredentials: {
          spotify: { artistId: newArtist.spotifyId },
          youtube: { channelId: newArtist.youtubeId },
          meta: { igAccountId: newArtist.instaId }
        }
      };
      await createMutation.mutateAsync(payload);
      setIsAddModalOpen(false);
      setNewArtist({ name: '', bio: '', website: '', spotifyId: '', youtubeId: '', instaId: '' });
    } catch (err) {
      alert('Failed to create artist: ' + err.message);
    }
  };

  const handleSyncArtist = async (e, id) => {
    e.stopPropagation();
    try {
      setSyncingId(id);
      await syncMutation.mutateAsync(id);
      setSyncingId(null);
    } catch (err) {
      setSyncingId(null);
      alert(`Sync failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const filteredArtists = useMemo(() => {
    return artists.filter(artist => {
      const matchesSearch = artist.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            artist.bio?.toLowerCase().includes(searchTerm.toLowerCase());
      if (activeTab === 'synced') return matchesSearch && artist.isSynced;
      if (activeTab === 'pending') return matchesSearch && !artist.isSynced;
      return matchesSearch;
    });
  }, [artists, searchTerm, activeTab]);

  const stats = useMemo(() => {
    let totalReach = 0;
    let totalSpotify = 0;
    let totalViews = 0;
    artists.forEach(a => {
      const unified = a.normalized?.unified?.reach;
      const sp = a.analytics?.spotify?.followers || 0;
      const yt = a.analytics?.youtube?.subscribers || 0;
      const ig = a.analytics?.instagram?.followers || 0;
      const views = a.analytics?.youtube?.views || 0;
      totalReach += unified ?? (sp + yt + ig);
      totalSpotify += sp;
      totalViews += views;
    });
    return { totalArtists: artists.length, totalReach, totalSpotify, totalViews };
  }, [artists]);

  const syncChartData = useMemo(
    () => distributionFromField(artists, 'isSynced', {
      labelFn: (v) => (v ? 'Synced' : 'Needs API key'),
    }),
    [artists],
  );

  const columns = [
    {
      header: 'Artist',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center text-lg shadow-inner shrink-0 select-none">
            {getArtistEmoji(row.name)}
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-tight text-[var(--color-text-primary)]">{row?.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded badge-mint font-bold uppercase tracking-tight">
                Active
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[250px]">{row.bio || 'Verified Artist'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Reach',
      render: (row) => (
        <span className="text-xs font-bold text-[var(--color-text-primary)]">
          {formatNumber(row.normalized?.unified?.reach ?? (
            (row.analytics?.spotify?.followers || 0) +
            (row.analytics?.youtube?.subscribers || 0) +
            (row.analytics?.instagram?.followers || 0)
          ))}
        </span>
      )
    },
    {
      header: 'YouTube Metrics',
      info: 'YouTube Channel Subscribers and Total Views',
      render: (row) => (
        <div className="flex items-center gap-2">
          <FaYoutube size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {formatNumberLocal(row.analytics?.youtube?.views)} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">views</span>
          </span>
        </div>
      )
    },
    {
      header: 'Instagram Reach',
      info: 'Instagram Professional Account Followers',
      render: (row) => (
        <div className="flex items-center gap-2">
          <FaInstagram size={14} className="text-pink-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {formatNumberLocal(row.analytics?.instagram?.followers)} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">flw</span>
          </span>
        </div>
      )
    },
    {
      header: 'Sync',
      render: (row) => (
        <div className="flex items-center gap-2 min-w-[6rem]">
          <Badge variant={row.isSynced ? 'success' : 'warning'}>
            {row.isSynced ? 'SYNCED' : 'PENDING'}
          </Badge>
          <button
            type="button"
            onClick={(e) => handleSyncArtist(e, row._id)}
            disabled={syncingId === row._id}
            title="Force Real-Time API Sync"
            className={`p-1.5 rounded-[var(--radius-atomic)] bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all ${syncingId === row._id ? 'animate-spin text-[var(--color-action-primary)] opacity-100' : 'text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)]'}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )
    }
  ];

  if (isLoading && !isError) return <PageSkeleton />;

  return (
    <>
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          { id: 'total', label: 'Total Artists', value: stats.totalArtists, icon: Users, variant: 'slate' },
          { id: 'reach', label: 'Collective Reach', value: formatNumberLocal(stats.totalReach), icon: TrendingUp, variant: 'mint', info: 'Aggregated followers across connected platforms.' },
          { id: 'spotify', label: 'Spotify Followers', value: formatNumberLocal(stats.totalSpotify), icon: FaSpotify, variant: 'info' },
          { id: 'youtube', label: 'YouTube Views', value: formatNumberLocal(stats.totalViews), icon: FaYoutube, variant: 'rose' },
        ],
      }}
      toolbar={(
        <>
          <TabSwitcher
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'all', label: 'All Artists' },
              { id: 'synced', label: 'Synced' },
              { id: 'pending', label: 'Needs API Key' },
            ]}
          />
          <SearchInput
            placeholder="Search artist name or bio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!w-56 shrink-0"
          />
        </>
      )}
      toolbarActions={(
        <>
          <Button size="sm" variant="secondary" onClick={() => navigate('/artists/portfolio')}>
            <BarChart3 size={14} /> Portfolio
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={14} /> Add Artist
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        {isError && (
          <QueryErrorBanner
            message={getQueryErrorMessage(error, 'Failed to load artists')}
            onRetry={() => refetch()}
          />
        )}
        <DataTable
          columns={columns}
          data={filteredArtists}
          onRowClick={(row) => navigate(`/artists/${row?._id}`)}
          emptyTitle="No artists found in roster"
        />
      </div>
    </ListPageLayout>

      {/* Add New Artist Modal */}
      <NexusModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Artist"
        showFooter={false}
      >
        <form onSubmit={handleAddArtistSubmit} className="space-y-6">
          <div className="space-y-4">
            <Input
              label="Artist Name *"
              required
              placeholder="e.g. Yugm"
              value={newArtist.name}
              onChange={e => setNewArtist({ ...newArtist, name: e.target.value })}
            />
            <Input
              label="Website"
              placeholder="https://..."
              value={newArtist.website}
              onChange={e => setNewArtist({ ...newArtist, website: e.target.value })}
              icon={Globe}
            />
            <Input
              label="Bio"
              placeholder="Artist description..."
              value={newArtist.bio}
              onChange={e => setNewArtist({ ...newArtist, bio: e.target.value })}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-[var(--color-bg-border)]">
            <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Optional API Keys</h4>
            <Input
              label="Spotify Artist ID"
              placeholder="22-char ID from Spotify URL"
              value={newArtist.spotifyId}
              onChange={e => setNewArtist({ ...newArtist, spotifyId: e.target.value })}
              className="font-mono text-xs"
            />
            <Input
              label="YouTube Channel ID"
              placeholder="Starts with UC..."
              value={newArtist.youtubeId}
              onChange={e => setNewArtist({ ...newArtist, youtubeId: e.target.value })}
              className="font-mono text-xs"
            />
            <Input
              label="Instagram Graph ID"
              placeholder="17-digit numeric ID"
              value={newArtist.instaId}
              onChange={e => setNewArtist({ ...newArtist, instaId: e.target.value })}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-bg-border)]">
            <Button variant="secondary" type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit">Add Artist</Button>
          </div>
        </form>
      </NexusModal>
    </>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
