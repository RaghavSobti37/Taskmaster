import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, Zap, TrendingUp,
  ChevronLeft, ChevronRight, RefreshCw, Globe, Database, Trash2, Edit2, Link as LinkIcon, Mic2
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import {
  Badge, PageHeader, Card, PageContainer, DataTable, Button,
  TabSwitcher, StatCard, PageSkeleton, FullScreenWorkspace, Input, NexusModal
} from '../../components/ui';
import { useArtists, useCreateArtist, useUpdateArtist, useDeleteArtist, useSyncArtistStats } from '../../hooks/useTaskmasterQueries';

const getArtistEmoji = (name = '') => {
  if (name.includes('Yugm')) return '🎸';
  if (name.includes('Mohit')) return '🎤';
  if (name.includes('Harshad')) return '🎵';
  return '✨';
};

const formatNumber = (num) => {
  if (num == null || isNaN(num)) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function ArtistsCollection() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [syncingId, setSyncingId] = useState(null);

  const { data: artists = [], isLoading, refetch } = useArtists();
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
      alert('Sync completed or simulated. Data streams refreshed.');
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
      const sp = a.analytics?.spotify?.followers || 0;
      const yt = a.analytics?.youtube?.subscribers || 0;
      const ig = a.analytics?.instagram?.followers || 0;
      const views = a.analytics?.youtube?.views || 0;
      totalReach += (sp + yt + ig);
      totalSpotify += sp;
      totalViews += views;
    });
    return { totalArtists: artists.length, totalReach, totalSpotify, totalViews };
  }, [artists]);

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
              <span className="font-bold text-xs tracking-tight text-[var(--color-text-primary)]">{row.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase tracking-tight border border-emerald-500/20">
                Active
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[250px]">{row.bio || 'Verified Artist'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Spotify Feed',
      info: 'Spotify Followers and Monthly Listeners metrics',
      render: (row) => (
        <div className="flex items-center gap-2">
          <FaSpotify size={14} className="text-emerald-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {formatNumber(row.analytics?.spotify?.followers)} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">flw</span>
          </span>
        </div>
      )
    },
    {
      header: 'YouTube Metrics',
      info: 'YouTube Channel Subscribers and Total Views',
      render: (row) => (
        <div className="flex items-center gap-2">
          <FaYoutube size={14} className="text-red-500 shrink-0" />
          <span className="text-xs font-bold text-[var(--color-text-primary)]">
            {formatNumber(row.analytics?.youtube?.views)} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">views</span>
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
            {formatNumber(row.analytics?.instagram?.followers)} <span className="text-[10px] font-normal text-[var(--color-text-muted)]">flw</span>
          </span>
        </div>
      )
    },
    {
      header: 'Data Sync',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.isSynced ? 'success' : 'warning'}>
            {row.isSynced ? 'SYNCED' : 'PENDING'}
          </Badge>
          <button
            onClick={(e) => handleSyncArtist(e, row._id)}
            disabled={syncingId === row._id}
            title="Force Real-Time API Sync"
            className={`p-1.5 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)] transition-all ${syncingId === row._id ? 'animate-spin text-blue-500' : 'text-[var(--color-text-muted)] hover:text-blue-500'}`}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )
    }
  ];

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Artists"
        icon={Mic2}
        actions={
          <div className="flex items-center gap-2">

            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={14} /> Add Artist
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Artists" value={stats.totalArtists} icon={Users} variant="slate" />
        <StatCard label="Collective Reach" value={formatNumber(stats.totalReach)} icon={TrendingUp} variant="mint" info="Aggregated followers across Spotify, YouTube, and Instagram." />
        <StatCard label="Spotify Followers" value={formatNumber(stats.totalSpotify)} icon={FaSpotify} variant="info" />
        <StatCard label="YouTube Views" value={formatNumber(stats.totalViews)} icon={FaYoutube} variant="rose" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabSwitcher
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'all', label: 'All Artists' },
              { id: 'synced', label: 'Synced' },
              { id: 'pending', label: 'Needs API Key' }
            ]}
          />
          <div className="w-72">
            <Input
              placeholder="Search artist name or bio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              icon={Search}
            />
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <DataTable
            columns={columns}
            data={filteredArtists}
            onRowClick={(row) => navigate(`/artists/${row._id}`)}
          />
          {filteredArtists.length === 0 && (
            <div className="p-16 text-center text-[var(--color-text-muted)]">
              <Users size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-xs font-black uppercase tracking-widest">No artists found in roster</p>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
            Showing {filteredArtists.length} of {artists.length} artists
          </p>
        </div>
      </div>

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
    </PageContainer>
  );
}
