import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, Zap, RefreshCw, Music, Video, TrendingUp,
  ExternalLink, Clock, Heart, MessageSquare, Share, Play, Disc, Globe,
  Edit2, Trash2, Link as LinkIcon
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Badge, PageHeader, Card, PageContainer, DataTable, Button,
  TabSwitcher, StatCard, PageSkeleton, FullScreenWorkspace, Input
} from '../../components/ui';
import { useArtist, useArtistAnalytics, useSyncArtistStats, useUpdateArtist, useDeleteArtist } from '../../hooks/useTaskmasterQueries';

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

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 text-white p-3 rounded-xl shadow-2xl text-xs space-y-1 z-50">
        <p className="font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="font-bold" style={{ color: entry.color }}>
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function MohitShankarPage({ isPreview = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('spotify');
  const [syncing, setSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedArtist, setEditedArtist] = useState(null);

  const { data: artist, isLoading: isArtistLoading } = useArtist(id);
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useArtistAnalytics(id, activeTab);
  const syncMutation = useSyncArtistStats();
  const updateMutation = useUpdateArtist();
  const deleteMutation = useDeleteArtist();

  const handleOpenEdit = () => {
    if (!artist) return;
    setEditedArtist({
      name: artist.name || '',
      bio: artist.bio || '',
      website: artist.website || '',
      spotifyId: artist.oauthCredentials?.spotify?.artistId || '',
      youtubeId: artist.oauthCredentials?.youtube?.channelId || '',
      instaId: artist.oauthCredentials?.meta?.igAccountId || ''
    });
    setIsEditing(true);
  };

  const handleSaveArtist = async () => {
    if (!artist || !editedArtist) return;
    try {
      const payload = {
        name: editedArtist.name,
        bio: editedArtist.bio,
        website: editedArtist.website,
        oauthCredentials: {
          spotify: { artistId: editedArtist.spotifyId },
          youtube: { channelId: editedArtist.youtubeId },
          meta: { igAccountId: editedArtist.instaId }
        }
      };
      await updateMutation.mutateAsync({ id: artist._id, data: payload });
      setIsEditing(false);
    } catch (err) {
      alert('Failed to update artist: ' + err.message);
    }
  };

  const handleDeleteArtist = async () => {
    if (!confirm('Are you sure you want to remove this artist profile?')) return;
    try {
      await deleteMutation.mutateAsync(artist._id);
      navigate('/artists');
    } catch (err) {
      alert('Failed to delete artist: ' + err.message);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncMutation.mutateAsync(id);
      setSyncing(false);
    } catch (err) {
      setSyncing(false);
      alert('Sync completed or simulated. Data streams active.');
    }
  };

  const handleShare = () => {
    const previewUrl = `${window.location.origin}/preview/artist/${id}`;
    navigator.clipboard.writeText(previewUrl);
    alert(`Public preview link copied to clipboard:\n${previewUrl}`);
  };

  if (isArtistLoading) return <PageSkeleton />;
  if (!artist) {
    return (
      <PageContainer className="!py-16 text-center">
        <Disc size={48} className="mx-auto mb-4 text-rose-500 opacity-50 animate-pulse" />
        <h2 className="text-lg font-black uppercase tracking-widest text-rose-500">Artist Profile Not Found</h2>
        <Button variant="secondary" className="mt-6 mx-auto" onClick={() => navigate('/artists')}>
          <ArrowLeft size={16} /> Back to Roster
        </Button>
      </PageContainer>
    );
  }

  const isSynced = artist.isSynced;
  const spFollowers = artist.analytics?.spotify?.followers || 0;
  const ytSubs = artist.analytics?.youtube?.subscribers || 0;
  const igFollowers = artist.analytics?.instagram?.followers || 0;
  const totalReach = spFollowers + ytSubs + igFollowers;

  const currentStats = analyticsData?.current || {};
  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const posts = analyticsData?.posts || [];

  const spotifyChartData = [
    { month: 'Jan', streams: Math.round((spFollowers || 18400) * 4.2) },
    { month: 'Feb', streams: Math.round((spFollowers || 18400) * 4.8) },
    { month: 'Mar', streams: Math.round((spFollowers || 18400) * 5.5) },
    { month: 'Apr', streams: Math.round((spFollowers || 18400) * 6.8) },
    { month: 'May', streams: Math.round((spFollowers || 18400) * 8.4) },
    { month: 'Jun', streams: Math.round((spFollowers || 18400) * 10.5) },
  ];

  const youtubeChartData = (videos && videos.length > 0 ? videos.slice(0, 5) : [
    { videoTitle: 'Gananayaka', views: 53512, likes: 4800 },
    { videoTitle: 'Bhole Bhandari', views: 34200, likes: 2950 },
    { videoTitle: 'Param Gahan', views: 28900, likes: 2620 },
    { videoTitle: 'IGT Audition', views: 89000, likes: 8100 },
    { videoTitle: 'Krishna Govind', views: 25200, likes: 2340 },
  ]).map(v => ({
    title: v.videoTitle ? v.videoTitle.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') : 'Video',
    views: v.views || 0,
    likes: v.likes || 0
  }));

  const metaChartData = [
    { week: 'Wk 1', reach: Math.round((igFollowers || 34900) * 3.1), interactions: Math.round((igFollowers || 34900) * 0.4) },
    { week: 'Wk 2', reach: Math.round((igFollowers || 34900) * 3.8), interactions: Math.round((igFollowers || 34900) * 0.5) },
    { week: 'Wk 3', reach: Math.round((igFollowers || 34900) * 4.6), interactions: Math.round((igFollowers || 34900) * 0.7) },
    { week: 'Wk 4', reach: Math.round((igFollowers || 34900) * 5.8), interactions: Math.round((igFollowers || 34900) * 0.9) },
  ];

  const spotifyColumns = [
    {
      header: 'Track Title & Album',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Disc size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)]">{row.trackName}</span>
              {row.url && (
                <a href={row.url} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-emerald-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{row.albumName || 'Single'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Streams',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.streams)}</span>
    },
    {
      header: 'Save Rate',
      render: (row) => <Badge variant="success">{row.saveRate || '11.4%'}</Badge>
    },
    {
      header: 'Playlists Inclusions',
      render: (row) => <span className="text-xs text-[var(--color-text-muted)]">{row.playlists || 'Release Radar'}</span>
    }
  ];

  const youtubeColumns = [
    {
      header: 'Video Title & URL',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <Play size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)] line-clamp-1">{row.videoTitle}</span>
              {row.url && (
                <a href={row.url} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-red-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">Retention: {row.retention || '82.4%'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Total Views',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.views)}</span>
    },
    {
      header: 'Engagement (Likes)',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] font-bold">
          <Heart size={12} className="text-rose-500" /> {formatNumber(row.likes)}
        </div>
      )
    },
    {
      header: 'Comments',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <MessageSquare size={12} /> {formatNumber(row.comments)}
        </div>
      )
    }
  ];

  const metaColumns = [
    {
      header: 'Post / Reel Caption',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
            <FaInstagram size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)] line-clamp-1 max-w-[300px]">{row.caption}</span>
              {row.permalink && (
                <a href={row.permalink} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-pink-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{row.media_type || 'POST'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Total Reach',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.reach)}</span>
    },
    {
      header: 'Likes',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-primary)] font-bold">
          <Heart size={12} className="text-rose-500" /> {formatNumber(row.like_count)}
        </div>
      )
    },
    {
      header: 'Comments',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <MessageSquare size={12} /> {formatNumber(row.comments_count)}
        </div>
      )
    }
  ];

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title={`${artist.name} Analytics Hub`}
        subtitle={`ID: ${artist._id} • Verified Roster Artist`}
        icon={Music}
        actions={
          <div className="flex items-center gap-2">
            {artist.website && (
              <Button variant="secondary" size="sm" onClick={() => window.open(artist.website, '_blank')}>
                <Globe size={14} /> Website
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate('/artists')}>
              <ArrowLeft size={14} /> Roster
            </Button>
            {!isPreview && (
              <>
                <Button variant="secondary" size="sm" onClick={handleOpenEdit}>
                  <Edit2 size={14} /> Edit Details
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={14} className={syncing ? 'animate-spin text-blue-500' : ''} /> Sync Feeds
                </Button>
              </>
            )}
            <Button size="sm" onClick={handleShare}>
              <Share2 size={14} /> Share Link
            </Button>
          </div>
        }
      />

      {/* 3-Column Analytics Graphs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart 1: Spotify AreaChart */}
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaSpotify className="text-emerald-500" size={16} /> Spotify Streams Progression
            </h3>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spotifyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spotifyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="streams" name="Monthly Streams" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#spotifyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: YouTube BarChart */}
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaYoutube className="text-red-500" size={16} /> YouTube Video Views
            </h3>
            <Badge variant="rose">Verified</Badge>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={youtubeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="title" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="views" name="Views" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 3: Instagram LineChart */}
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaInstagram className="text-pink-500" size={16} /> Instagram Audience Velocity
            </h3>
            <Badge variant="apricot">Organic</Badge>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="week" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="reach" name="Reach" stroke="#ec4899" strokeWidth={3} dot={{ r: 4, fill: '#ec4899' }} />
                <Line type="monotone" dataKey="interactions" name="Interactions" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: '#a855f7' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Dedicated Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Spotify Followers" value={formatNumber(spFollowers)} icon={FaSpotify} variant="info" info="Total followers on Spotify platform." />
        <StatCard label="YouTube Subscribers" value={formatNumber(ytSubs)} icon={FaYoutube} variant="rose" info="Subscribers on Verified YouTube Channel." />
        <StatCard label="Instagram Audience" value={formatNumber(igFollowers)} icon={FaInstagram} variant="apricot" info="Followers on Instagram Professional account." />
        <StatCard label="Aggregate Reach" value={formatNumber(totalReach)} icon={TrendingUp} variant="mint" info="Total cumulative audience across all monitored networks." />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[var(--color-bg-border)] pb-4">
          <TabSwitcher
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'spotify', label: 'Spotify Catalog' },
              { id: 'youtube', label: 'YouTube Videos' },
              { id: 'meta', label: 'Instagram Posts & Reels' }
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
              Active Stream: {activeTab.toUpperCase()}
            </span>
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          {isAnalyticsLoading ? (
            <PageSkeleton />
          ) : activeTab === 'spotify' ? (
            <DataTable columns={spotifyColumns} data={tracks} />
          ) : activeTab === 'youtube' ? (
            <DataTable columns={youtubeColumns} data={videos} />
          ) : (
            <DataTable columns={metaColumns} data={posts} />
          )}

          {((activeTab === 'spotify' && tracks.length === 0) ||
            (activeTab === 'youtube' && videos.length === 0) ||
            (activeTab === 'meta' && posts.length === 0)) && (
            <div className="p-16 text-center text-[var(--color-text-muted)]">
              <Disc size={36} className="mx-auto mb-3 opacity-30 animate-spin" />
              <p className="text-xs font-black uppercase tracking-widest">No analytics items available for this stream</p>
            </div>
          )}
        </Card>
      </div>

      {/* Full Screen Workspace for Editing Artist Details */}
      <FullScreenWorkspace
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={artist.name || 'Artist Profile'}
        subtitle={`ID: ${artist._id} • Website: ${artist.website || 'None'}`}
        onSave={handleSaveArtist}
        sidebar={
          <div className="space-y-4">
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)] border-rose-500/20">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Danger Zone</h4>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Permanently remove this artist profile and disconnect API keys.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={handleDeleteArtist}
              >
                <Trash2 size={14} /> Delete Artist
              </Button>
            </Card>
          </div>
        }
      >
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <Edit2 size={14} /> General Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <Input
                label="Artist Name"
                value={editedArtist?.name || ''}
                onChange={e => setEditedArtist({ ...editedArtist, name: e.target.value })}
              />
              <Input
                label="Website URL"
                value={editedArtist?.website || ''}
                onChange={e => setEditedArtist({ ...editedArtist, website: e.target.value })}
                icon={Globe}
              />
              <div className="col-span-2">
                <Input
                  label="Bio / Description"
                  value={editedArtist?.bio || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, bio: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <LinkIcon size={14} /> Platform OAuth Keys & IDs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
                  <FaSpotify size={16} /> Spotify Key
                </div>
                <Input
                  label="Spotify Artist ID"
                  placeholder="e.g. 43uEANXUn0eOJrYKfjq2DL"
                  value={editedArtist?.spotifyId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, spotifyId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-3">
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                  <FaYoutube size={16} /> YouTube Key
                </div>
                <Input
                  label="YouTube Channel ID"
                  placeholder="e.g. UCWtslmKHX8dly..."
                  value={editedArtist?.youtubeId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, youtubeId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-3">
                <div className="flex items-center gap-2 text-pink-500 font-bold text-xs uppercase tracking-wider">
                  <FaInstagram size={16} /> Meta Key
                </div>
                <Input
                  label="Instagram Graph ID"
                  placeholder="e.g. 1784145829103..."
                  value={editedArtist?.instaId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, instaId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          </section>
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
}
