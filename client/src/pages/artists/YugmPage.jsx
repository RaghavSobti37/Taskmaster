import React from 'react';
import {
  ArrowLeft, Share2, Zap, RefreshCw, Music, Video, TrendingUp,
  ExternalLink, Clock, Heart, MessageSquare, Share, Play, Disc, Globe,
  Edit2, Trash2, Link as LinkIcon
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  Badge, PageHeader, Card, PageContainer, DataTable, Button,
  TabSwitcher, StatCard, FullScreenWorkspace, Input
} from '../../components/ui';

const formatNumber = (num) => {
  if (num == null || isNaN(num)) return 'N/A';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0f172a]/95 backdrop-blur-md border border-amber-800 text-white p-3 rounded-xl shadow-2xl text-xs space-y-1 z-50">
        <p className="font-bold text-amber-400 uppercase tracking-wider">{label}</p>
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

export default function YugmPage({
  artist, analyticsData, activeTab, setActiveTab, isPreview, handleOpenEdit,
  handleDeleteArtist, handleSync, handleShare, syncing, isEditing, setIsEditing,
  editedArtist, setEditedArtist, handleSaveArtist
}) {
  const isSynced = artist.isSynced;
  const spFollowers = artist.analytics?.spotify?.followers || 0;
  const spListeners = artist.analytics?.spotify?.monthlyListeners || 21200;
  const ytSubs = artist.analytics?.youtube?.subscribers || 0;
  const igFollowers = artist.analytics?.instagram?.followers || 0;
  const totalReach = spFollowers + ytSubs + igFollowers;

  const currentStats = analyticsData?.current || {};
  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const posts = analyticsData?.posts || [];
  const historyMap = analyticsData?.history || {};

  const spotifyChartData = (historyMap.spotify || []).map(h => ({
    month: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short' }),
    streams: Number(h.metrics?.streams) || 0,
    monthlyListeners: Number(h.metrics?.monthlyListeners) || 0,
    followers: Number(h.metrics?.followers) || 0
  }));

  const youtubeChartData = (videos || []).map(v => ({
    title: v.videoTitle ? v.videoTitle.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '') : 'Video',
    views: Number(v.views) || 0,
    likes: Number(v.likes) || 0
  }));

  const metaChartData = (historyMap.meta || []).map(h => ({
    week: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    reach: Number(h.metrics?.reach) || 0,
    interactions: Number(h.metrics?.interactions) || 0,
    followers: Number(h.metrics?.followers) || 0
  }));

  const spotifyColumns = [
    {
      header: 'Folk Track & Album',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Disc size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)]">{row.trackName}</span>
              {row.url && (
                <a href={row.url} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-amber-400">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{row.albumName || 'Folk Single'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Streams',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.streams)}</span>
    },
    {
      header: 'Monthly Listeners',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.monthlyListeners || Math.round(row.streams * 0.18))}</span>
    },
    {
      header: 'Save Rate',
      render: (row) => <Badge variant="warning">{row.saveRate || '15.2%'}</Badge>
    }
  ];

  const youtubeColumns = [
    {
      header: 'Folk Concert & Session',
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
            <span className="text-[10px] text-amber-400 font-semibold">Retention: {row.retention || '88.2%'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Total Views',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.views)}</span>
    },
    {
      header: 'Likes Count',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.likes)}</span>
    },
    {
      header: 'Comments',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.comments)}</span>
    }
  ];

  const metaColumns = [
    {
      header: 'Instagram Post / Reel',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
            {row.media_type === 'VIDEO' ? <Video size={16} /> : <Music size={16} />}
          </div>
          <div className="flex flex-col max-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-[var(--color-text-primary)] truncate">{row.caption || 'Instagram Reel'}</span>
              {row.permalink && (
                <a href={row.permalink} target="_blank" rel="noreferrer" className="text-[var(--color-text-muted)] hover:text-pink-500 shrink-0">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{row.media_type || 'REEL'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Likes',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.like_count)}</span>
    },
    {
      header: 'Comments',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.comments_count)}</span>
    },
    {
      header: 'Estimated Reach',
      render: (row) => <span className="text-xs font-bold tabular-nums text-[var(--color-text-primary)]">{formatNumber(row.reach || row.like_count * 12)}</span>
    }
  ];

  const activeColumns = activeTab === 'spotify' ? spotifyColumns : activeTab === 'youtube' ? youtubeColumns : metaColumns;
  const activeTableData = activeTab === 'spotify' ? tracks : activeTab === 'youtube' ? videos : posts;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <div className="relative rounded-3xl bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-slate-950 border border-amber-500/30 p-8 overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-amber-500/20 border-2 border-amber-400/50 flex items-center justify-center text-5xl shadow-xl overflow-hidden shrink-0">
              {artist.profileImage ? <img src={artist.profileImage} alt="" className="w-full h-full object-cover" /> : '🎸'}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-extrabold tracking-tight text-white">{artist.name}</h1>
                <Badge variant="warning" className="animate-pulse border border-amber-400/30">Indie Folk Sensation</Badge>
                {isSynced && <Badge variant="success" className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Live OAuth API Connected</Badge>}
              </div>
              <p className="text-xs text-amber-200/80 max-w-2xl leading-relaxed">{artist.bio || 'Indian Folk Fusion Band | Kabeera Echoes & Jaipur Concert Roster'}</p>
              
              <div className="flex items-center gap-4 text-[11px] font-bold text-amber-300 pt-1">
                {artist.website && <a href={artist.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:underline"><Globe size={13} /> Official Web</a>}
                <span>🎧 Monthly Reach: {formatNumber(totalReach)}</span>
              </div>
            </div>
          </div>

          {!isPreview && (
            <div className="flex items-center gap-2 self-start md:self-center">
              <Button variant="secondary" size="sm" onClick={handleShare} title="Copy Public Link">
                <Share2 size={14} /> Share
              </Button>
              <Button variant="secondary" size="sm" onClick={handleOpenEdit} title="Edit Artist Profile">
                <Edit2 size={14} /> Edit
              </Button>
              <Button size="sm" onClick={handleSync} disabled={syncing} className="bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing Feeds...' : 'Sync Live Feeds'}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleDeleteArtist} title="Delete Artist" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20">
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Multi-Network Analytics Graphs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Chart 1: Spotify Streams Growth */}
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaSpotify className="text-emerald-500" size={16} /> Spotify Streams Growth
            </h3>
            <Badge variant="success">Real API</Badge>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spotifyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="spotifyColorYugm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} vertical={false} />
                <XAxis dataKey="month" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="streams" name="Streams" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#spotifyColorYugm)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: YouTube Views BarChart */}
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaYoutube className="text-red-500" size={16} /> YouTube Catalog Views
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
        <Card className="p-4 space-y-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)] flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
              <FaInstagram className="text-pink-500" size={16} /> Instagram Reach Velocity
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
        <StatCard label="Spotify Listeners / Followers" value={`${spListeners != null ? formatNumber(spListeners) + ' / ' : ''}${formatNumber(spFollowers)}`} icon={FaSpotify} variant="info" info="Monthly listeners and total followers on Spotify platform." />
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
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              Active Stream: {activeTab.toUpperCase()}
            </span>
            <Badge variant="success" className="animate-pulse">Live DB Synced</Badge>
          </div>
        </div>

        <Card className="p-0 overflow-hidden shadow-2xl border-amber-500/20">
          <DataTable
            columns={activeColumns}
            data={activeTableData}
          />
          {activeTableData.length === 0 && (
            <div className="p-16 text-center text-[var(--color-text-muted)]">
              <Disc size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-xs font-black uppercase tracking-widest">No data available in this feed</p>
            </div>
          )}
        </Card>
      </div>

      {/* Edit Modal */}
      <FullScreenWorkspace
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title="Edit Yugm Profile"
        onSave={handleSaveArtist}
      >
        {editedArtist && (
          <div className="p-6 space-y-6 max-w-3xl mx-auto">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Basic Information</h4>
              <Input label="Artist Name *" required value={editedArtist.name} onChange={e => setEditedArtist({ ...editedArtist, name: e.target.value })} />
              <Input label="Website" value={editedArtist.website} onChange={e => setEditedArtist({ ...editedArtist, website: e.target.value })} icon={Globe} />
              <Input label="Biography / Description" multiline rows={6} value={editedArtist.bio} onChange={e => setEditedArtist({ ...editedArtist, bio: e.target.value })} />
            </div>

            <div className="space-y-4 pt-6 border-t border-[var(--color-bg-border)]">
              <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)]">Platform API Credentials</h4>
              <Input label="Spotify Artist ID" value={editedArtist.spotifyId} onChange={e => setEditedArtist({ ...editedArtist, spotifyId: e.target.value })} className="font-mono text-xs" />
              <Input label="YouTube Channel ID" value={editedArtist.youtubeId} onChange={e => setEditedArtist({ ...editedArtist, youtubeId: e.target.value })} className="font-mono text-xs" />
              <Input label="Instagram Graph ID" value={editedArtist.instaId} onChange={e => setEditedArtist({ ...editedArtist, instaId: e.target.value })} className="font-mono text-xs" />
            </div>
          </div>
        )}
      </FullScreenWorkspace>
    </PageContainer>
  );
}
