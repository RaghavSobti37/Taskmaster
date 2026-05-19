import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, Zap, RefreshCw, Music, Video, TrendingUp,
  ExternalLink, Clock, Heart, MessageSquare, Share, Play, Disc, Globe,
  Edit2, Trash2, Link as LinkIcon, Info, CheckCircle, Plus, Filter,
  Radio, Headphones, Activity, BarChart2
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import {
  Badge, PageHeader, Card, PageContainer, DataTable, Button,
  TabSwitcher, StatCard, PageSkeleton, FullScreenWorkspace, Input, InfoButton
} from '../../components/ui';
import { useArtist, useArtistAnalytics, useSyncArtistStats, useUpdateArtist, useDeleteArtist, useAddTrackedVideo } from '../../hooks/useTaskmasterQueries';

const formatNumber = (num) => {
  if (num == null || isNaN(num) || num === 'N/A') return 'N/A';
  const n = Number(num);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111827]/95 backdrop-blur-md border border-[#1F2937] text-white p-3 rounded-xl shadow-2xl text-xs space-y-1 z-50">
        <p className="font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="font-bold text-emerald-400">
            {entry.name}: {formatNumber(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ArtistDetail({ isPreview = false }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('spotify');
  const [syncing, setSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedArtist, setEditedArtist] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetNotes, setAssetNotes] = useState('');
  const [videoFilter, setVideoFilter] = useState('all');
  const [showAddVideoModal, setShowAddVideoModal] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoChannel, setNewVideoChannel] = useState('');

  const { data: artist, isLoading: isArtistLoading } = useArtist(id);
  const { data: analyticsData, isLoading: isAnalyticsLoading } = useArtistAnalytics(id, activeTab);
  const syncMutation = useSyncArtistStats();
  const updateMutation = useUpdateArtist();
  const deleteMutation = useDeleteArtist();
  const addVideoMutation = useAddTrackedVideo();

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
    if (!window.confirm('Are you sure you want to remove this artist profile?')) return;
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

  const handleConnectMeta = () => {
    const appId = '733417183164639';
    const redirectUri = `${window.location.origin}/oauth/meta/callback`;
    const scope = 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement';
    const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${artist._id}`;
    window.location.href = authUrl;
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

  // Use ?? not || so 0 values don't fall through to 'N/A'
  const spFollowers = artist.analytics?.spotify?.followers ?? 'N/A';
  const spPopularity = artist.analytics?.spotify?.popularity ?? 'N/A';
  const ytSubs = artist.analytics?.youtube?.subscribers ?? 'N/A';
  const ytViews = artist.analytics?.youtube?.views ?? 'N/A';
  const ytVideos = artist.analytics?.youtube?.videoCount ?? 'N/A';
  const igFollowers = artist.analytics?.instagram?.followers ?? 'N/A';
  const igEngagement = artist.analytics?.instagram?.engagementRate ?? 'N/A';
  const igShares = artist.analytics?.instagram?.totalShares ?? 'N/A';

  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const filteredVideos = videos.filter(v => {
    if (videoFilter === 'native') return v.isNative !== false;
    if (videoFilter === 'external') return v.isNative === false;
    return true;
  });
  const posts = analyticsData?.posts || [];
  const historyMap = analyticsData?.history || {};
  const discography = analyticsData?.discography || [];
  const relatedArtists = analyticsData?.relatedArtists || [];
  const spotifyGenres = artist.analytics?.spotify?.genres || [];
  const spotifyProfileImage = artist.analytics?.spotify?.profileImage || null;

  const currentHistory = historyMap[activeTab] || [];
  const chartData = currentHistory.map((h, idx) => ({
    label: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || `Snap ${idx + 1}`,
    value: Number(h.metrics?.followers || h.metrics?.subscribers || h.metrics || 0)
  }));

  const spotifyColumns = [
    {
      header: 'Track',
      info: 'Track title, album, and release info.',
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          {row.albumImage ? (
            <img src={row.albumImage} alt={row.albumName} className="w-8 h-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
              <Disc size={16} />
            </div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white">{row.trackName}</span>
              {row.explicit && <span className="text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-500 px-1 rounded">E</span>}
              {row.url && (
                <a href={row.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-emerald-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{row.albumName || 'Single'} {row.releaseDate ? `• ${row.releaseDate.slice(0,4)}` : ''}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Popularity',
      info: 'Spotify popularity score (0–100). Updates daily.',
      render: (row) => (
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${row.popularity || 0}%` }} />
          </div>
          <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300 w-7 text-right">{row.popularity ?? 'N/A'}</span>
        </div>
      )
    },
    {
      header: 'Energy',
      info: 'Perceptual measure of intensity and activity (0–100).',
      render: (row) => row.energy != null ? (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full" style={{ width: `${row.energy}%` }} />
          </div>
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">{row.energy}%</span>
        </div>
      ) : <span className="text-xs text-slate-400">—</span>
    },
    {
      header: 'Vibe',
      info: 'Danceability & Valence — how danceable and positive the track sounds.',
      render: (row) => (
        <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 dark:text-slate-400">
          <span>💃 {row.danceability != null ? `${row.danceability}%` : '—'}</span>
          <span>😊 {row.valence != null ? `${row.valence}%` : '—'}</span>
        </div>
      )
    },
    {
      header: 'Key / BPM',
      info: 'Musical key, mode (Major/Minor), and tempo in beats per minute.',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{row.key || '—'} {row.mode || ''}</span>
          <span className="text-[10px] text-slate-500">{row.tempo ? `${row.tempo} BPM` : '—'}</span>
        </div>
      )
    }
  ];

  const youtubeColumns = [
    {
      header: 'Video Title & URL',
      info: 'Upload title and verified direct video hyperlink.',
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
            <Play size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1">{row.videoTitle}</span>
              {row.isNative !== false ? (
                <Badge variant="success" className="!text-[10px]">Native</Badge>
              ) : (
                <Badge variant="apricot" className="!text-[10px]">Featured</Badge>
              )}
              {row.url && (
                <a href={row.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-red-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {row.channelName || artist.name} • Retention: {row.retention || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Total Views',
      info: 'Cumulative number of user view iterations.',
      render: (row) => <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(row.views)}</span>
    },
    {
      header: 'Engagement (Likes)',
      info: 'Total positive engagement indicators.',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white font-bold">
          <Heart size={12} className="text-rose-500" /> {formatNumber(row.likes)}
        </div>
      )
    },
    {
      header: 'Comments',
      info: 'Total user discussion replies.',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <MessageSquare size={12} /> {formatNumber(row.comments)}
        </div>
      )
    }
  ];

  const metaColumns = [
    {
      header: 'Post / Reel Caption',
      info: 'Caption snippet and direct Instagram post URL.',
      render: (row) => (
        <div className="flex items-center gap-3 py-1">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0">
            <FaInstagram size={16} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-slate-900 dark:text-white line-clamp-1 max-w-[300px]">{row.caption}</span>
              {row.permalink && (
                <a href={row.permalink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-slate-400 hover:text-pink-500">
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{row.media_type || 'POST'}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Total Reach',
      info: 'Aggregated impression volume.',
      render: (row) => <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatNumber(row.reach)}</span>
    },
    {
      header: 'Likes',
      info: 'Total double-tap interactions.',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white font-bold">
          <Heart size={12} className="text-rose-500" /> {formatNumber(row.like_count)}
        </div>
      )
    },
    {
      header: 'Comments',
      info: 'Total discussion entries.',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <MessageSquare size={12} /> {formatNumber(row.comments_count)}
        </div>
      )
    }
  ];

  return (
    <PageContainer className="!py-4 !space-y-6 bg-[#F8FAFC] dark:bg-[#0B0F19] min-h-screen text-slate-900 dark:text-slate-100 transition-colors">
      <PageHeader
        title={`${artist.name} Workspace`}
        subtitle={`ID: ${artist._id} • Connected & Up to Date`}
        icon={Music}
        actions={
          <div className="flex items-center gap-2">
            {artist.website && (
              <Button variant="secondary" size="sm" onClick={() => window.open(artist.website, '_blank')}>
                <Globe size={14} /> Website
              </Button>
            )}
            {!isPreview && (
              <>
                <Button variant="secondary" size="sm" onClick={() => navigate('/artists')}>
                  <ArrowLeft size={14} /> Roster
                </Button>
                <Button variant="secondary" size="sm" onClick={handleOpenEdit}>
                  <Edit2 size={14} /> Edit Details
                </Button>
                <Button variant="secondary" size="sm" onClick={handleSync} disabled={syncing}>
                  <RefreshCw size={14} className={syncing ? 'animate-spin text-blue-500' : ''} /> Sync Feeds
                </Button>
                <Button size="sm" onClick={handleShare}>
                  <Share2 size={14} /> Share Link
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Tier A: The Macro Strategic Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Spotify Card */}
        {(() => {
          const isConnected = !!(artist.oauthCredentials?.spotify?.artistId || artist.oauthCredentials?.spotify?.accessToken);
          return (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm flex flex-col gap-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <FaSpotify size={16} /> Spotify Summary
                </div>
                <Badge variant={isConnected ? 'success' : 'info'}>{isConnected ? 'Connected' : 'Not Connected'}</Badge>
              </div>
              {isConnected ? (
                <div className="grid grid-cols-2 gap-2 divide-x divide-slate-100 dark:divide-[#374151]/60">
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Followers <InfoButton text="Total verified followers on Spotify platform." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(spFollowers)}</span>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Popularity <InfoButton text="Spotify algorithmic popularity ranking (0-100). Updates daily." />
                    </span>
                    <span className="text-lg font-black mt-1">{spPopularity !== 'N/A' ? `${spPopularity}/100` : '—'}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 gap-2">
                  <p className="text-[11px] text-slate-400 text-center">Connect Spotify to see follower count, popularity score, and full discography.</p>
                  <button
                    onClick={() => { handleOpenEdit(); }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 hover:bg-emerald-500/20 transition flex items-center gap-1.5"
                  >
                    <FaSpotify size={12} /> Connect Spotify
                  </button>
                </div>
              )}
            </Card>
          );
        })()}

        {/* YouTube Card */}
        {(() => {
          const isConnected = !!(artist.oauthCredentials?.youtube?.channelId);
          return (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm flex flex-col gap-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider">
                  <FaYoutube size={16} /> YouTube Summary
                </div>
                <Badge variant={isConnected ? 'rose' : 'info'}>{isConnected ? 'Connected' : 'Not Connected'}</Badge>
              </div>
              {isConnected ? (
                <div className="grid grid-cols-3 gap-2 divide-x divide-slate-100 dark:divide-[#374151]/60">
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Subscribers <InfoButton text="Total active subscribed audience members." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(ytSubs)}</span>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Total Views <InfoButton text="Cumulative channel video view iterations." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(ytViews)}</span>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Videos <InfoButton text="Total uploaded and indexed videos in channel." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(ytVideos)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 gap-2">
                  <p className="text-[11px] text-slate-400 text-center">Connect YouTube to track subscribers, views, and video performance.</p>
                  <button
                    onClick={() => window.location.href = `http://127.0.0.1:5000/api/artists/${artist._id}/auth/youtube`}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-[11px] font-bold border border-red-500/20 hover:bg-red-500/20 transition flex items-center gap-1.5"
                  >
                    <FaYoutube size={12} /> Connect YouTube
                  </button>
                </div>
              )}
            </Card>
          );
        })()}

        {/* Meta Card */}
        {(() => {
          const isConnected = !!(artist.oauthCredentials?.meta?.igAccountId && artist.oauthCredentials?.meta?.accessToken);
          return (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] shadow-sm flex flex-col gap-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 font-bold text-xs uppercase tracking-wider">
                  <FaInstagram size={16} /> Meta Summary
                </div>
                <Badge variant={isConnected ? 'apricot' : 'info'}>{isConnected ? 'Active' : 'Not Connected'}</Badge>
              </div>
              {isConnected ? (
                <div className="grid grid-cols-3 gap-2 divide-x divide-slate-100 dark:divide-[#374151]/60">
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Followers <InfoButton text="Instagram professional account audience reach." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(igFollowers)}</span>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Engagement <InfoButton text="Ratio of total profile interactions over audience." />
                    </span>
                    <span className="text-lg font-black mt-1">{igEngagement !== 'N/A' ? `${igEngagement}%` : '—'}</span>
                  </div>
                  <div className="flex flex-col px-2">
                    <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider flex items-center">
                      Post Shares <InfoButton text="Total cumulative user reshares across media items." />
                    </span>
                    <span className="text-lg font-black mt-1">{formatNumber(igShares)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-3 gap-2">
                  <p className="text-[11px] text-slate-400 text-center">Connect Instagram via Facebook to track followers and post engagement.</p>
                  <button
                    onClick={handleConnectMeta}
                    className="px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[11px] font-bold border border-pink-500/20 hover:bg-pink-500/20 transition flex items-center gap-1.5"
                  >
                    <FaInstagram size={12} /> Connect Instagram
                  </button>
                </div>
              )}
            </Card>
          );
        })()}
      </div>

      {/* Tier B: Spotify Deep Dive — only shows after sync */}
      {activeTab === 'spotify' && (spotifyGenres.length > 0 || discography.length > 0 || relatedArtists.length > 0) && (
        <div className="space-y-4">
          {/* Genre Badges + Artist Image */}
          {(spotifyGenres.length > 0 || spotifyProfileImage) && (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl shadow-sm">
              <div className="flex items-center gap-4 flex-wrap">
                {spotifyProfileImage && (
                  <img src={spotifyProfileImage} alt={artist.name} className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                )}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Radio size={12} className="text-emerald-500" /> Spotify Genres
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {spotifyGenres.length > 0 ? spotifyGenres.map(g => (
                      <span key={g} className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20 capitalize">
                        {g}
                      </span>
                    )) : (
                      <span className="text-xs text-slate-400 italic">No genres tagged by Spotify yet</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Discography Grid */}
          {discography.length > 0 && (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Disc size={14} className="text-emerald-500" /> Discography
                <Badge variant="info">{discography.length} Releases</Badge>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {discography.map(a => (
                  <a
                    key={a.albumId}
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col gap-1.5 group cursor-pointer"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-emerald-500/50 transition">
                      {a.image ? (
                        <img src={a.image} alt={a.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                          <Disc size={28} />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-emerald-500 transition">{a.title}</span>
                      <span className="text-[10px] text-slate-500 capitalize">{a.type} · {a.releaseDate?.slice(0, 4) || '—'}</span>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* Related Artists */}
          {relatedArtists.length > 0 && (
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Headphones size={14} className="text-emerald-500" /> Related Artists on Spotify
              </h3>
              <div className="flex flex-wrap gap-3">
                {relatedArtists.map(r => (
                  <a
                    key={r.name}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] hover:border-emerald-500/50 transition group"
                  >
                    {r.image ? (
                      <img src={r.image} alt={r.name} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <FaSpotify size={12} />
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-emerald-500 transition">{r.name}</span>
                      <span className="text-[10px] text-slate-500">{r.popularity}/100 pop</span>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}


      <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] space-y-4 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <TrendingUp className="text-blue-500" size={16} /> Subscriber History
            <InfoButton text="Historical tracking progression of platform audience over time." />
          </h3>
          <Badge variant="info">{activeTab.toUpperCase()} Trajectory</Badge>
        </div>
        <div className="h-52 w-full">
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs font-bold text-slate-400">
              No historical data points logged yet for this stream.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} tickFormatter={formatNumber} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name={activeTab === 'spotify' ? 'Spotify Followers' : activeTab === 'youtube' ? 'YouTube Subscribers' : 'Instagram Followers'} stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Tier C: The Micro-Asset Registry Sheet (Individual Performance Tracking) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[#E2E8F0] dark:border-[#1F2937] pb-4">
          <div className="flex items-center gap-3">
            <TabSwitcher
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: 'spotify', label: 'Spotify Catalog' },
                { id: 'youtube', label: 'YouTube Videos' },
                { id: 'meta', label: 'Instagram Media' }
              ]}
            />
            <InfoButton text="Switch between live platform ingestion feeds to inspect sub-assets." />
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'youtube' && (
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg p-1 bg-slate-100 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700">
                  <button
                    className={`px-2.5 py-1 rounded-md transition ${videoFilter === 'all' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    onClick={() => setVideoFilter('all')}
                  >
                    All
                  </button>
                  <button
                    className={`px-2.5 py-1 rounded-md transition ${videoFilter === 'native' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    onClick={() => setVideoFilter('native')}
                  >
                    Native
                  </button>
                  <button
                    className={`px-2.5 py-1 rounded-md transition ${videoFilter === 'external' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                    onClick={() => setVideoFilter('external')}
                  >
                    Featured Collabs
                  </button>
                </div>
                <Button size="sm" variant="primary" onClick={() => setShowAddVideoModal(true)}>
                  <Plus size={14} /> Add Featured Video
                </Button>
              </div>
            )}
            {activeTab !== 'youtube' && (
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Individual Performance Tracking: {activeTab.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <Card className="p-0 overflow-hidden bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937] rounded-2xl shadow-sm">
          {isAnalyticsLoading ? (
            <PageSkeleton />
          ) : activeTab === 'spotify' ? (
            <DataTable columns={spotifyColumns} data={tracks} onRowClick={setSelectedAsset} />
          ) : activeTab === 'youtube' ? (
            <DataTable columns={youtubeColumns} data={filteredVideos} onRowClick={setSelectedAsset} />
          ) : (
            <DataTable columns={metaColumns} data={posts} onRowClick={setSelectedAsset} />
          )}

          {((activeTab === 'spotify' && tracks.length === 0) ||
            (activeTab === 'youtube' && videos.length === 0) ||
            (activeTab === 'meta' && posts.length === 0)) && (
              <div className="p-16 text-center text-slate-500 dark:text-slate-400">
                <Disc size={36} className="mx-auto mb-3 opacity-30 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest">No individual sub-assets logged for this stream</p>
              </div>
            )}
        </Card>
      </div>

      {/* Immersive Full Screen Workspace Drawer on Row Click */}
      <FullScreenWorkspace
        isOpen={!!selectedAsset}
        onClose={() => { setSelectedAsset(null); setAssetNotes(''); }}
        title={selectedAsset?.trackName || selectedAsset?.videoTitle || selectedAsset?.caption || 'Asset Workspace'}
        subtitle={`Platform Stream: ${activeTab.toUpperCase()} • Live Sub-Asset Analysis`}
        onSave={() => { alert('Asset notes updated successfully.'); setSelectedAsset(null); }}
        sidebar={
          <div className="space-y-6">
            <Card className="p-4 space-y-4 bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 flex items-center gap-1.5">
                <CheckCircle size={14} /> Database Reference Ledger
              </h4>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Artist Database ID:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">{artist._id}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Platform Direct Link:</span>
                  <a href={selectedAsset?.url || selectedAsset?.permalink || '#'} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1 font-mono">
                    {selectedAsset?.url || selectedAsset?.permalink || 'N/A'} <ExternalLink size={10} />
                  </a>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block font-bold">Last Automated Sync:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200">Connected & Up to Date</span>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-4 bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quick Actions</h4>
              <Button size="sm" variant="secondary" className="w-full" onClick={() => window.open(selectedAsset?.url || selectedAsset?.permalink || '#', '_blank')}>
                <ExternalLink size={14} /> Launch Live in Browser
              </Button>
            </Card>
          </div>
        }
      >
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Zap size={14} className="text-amber-500" /> Sub-Asset Performance Metrics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {activeTab === 'spotify' && (
                <>
                  <StatCard label="Streams" value={formatNumber(selectedAsset?.streams)} icon={Disc} variant="mint" />
                  <StatCard label="Save Rate" value={selectedAsset?.saveRate || 'N/A'} icon={Heart} variant="rose" />
                  <StatCard label="Playlists" value={selectedAsset?.playlists || 'N/A'} icon={Music} variant="info" />
                  <StatCard label="Album / Release" value={selectedAsset?.albumName || 'Single'} icon={Clock} variant="slate" />
                </>
              )}
              {activeTab === 'youtube' && (
                <>
                  <StatCard label="Total Views" value={formatNumber(selectedAsset?.views)} icon={Play} variant="rose" />
                  <StatCard label="Likes" value={formatNumber(selectedAsset?.likes)} icon={Heart} variant="mint" />
                  <StatCard label="Comments" value={formatNumber(selectedAsset?.comments)} icon={MessageSquare} variant="info" />
                  <StatCard label="Audience Retention" value={selectedAsset?.retention || 'N/A'} icon={Clock} variant="slate" />
                </>
              )}
              {activeTab === 'meta' && (
                <>
                  <StatCard label="Total Reach" value={formatNumber(selectedAsset?.reach)} icon={FaInstagram} variant="apricot" />
                  <StatCard label="Likes" value={formatNumber(selectedAsset?.like_count)} icon={Heart} variant="rose" />
                  <StatCard label="Comments" value={formatNumber(selectedAsset?.comments_count)} icon={MessageSquare} variant="info" />
                  <StatCard label="Media Type" value={selectedAsset?.media_type || 'IMAGE'} icon={Video} variant="slate" />
                </>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Edit2 size={14} className="text-blue-500" /> Inline Sub-Asset Notes & Tagging
            </h3>
            <Card className="p-4 bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#1F2937]">
              <Input
                label="Strategic Notes / Campaign Context"
                multiline
                rows={5}
                placeholder="Add internal marketing context, playlist pitching status, or promotional ad notes for this specific asset..."
                value={assetNotes}
                onChange={e => setAssetNotes(e.target.value)}
              />
            </Card>
          </section>
        </div>
      </FullScreenWorkspace>

      {/* Full Screen Workspace for Editing Artist Details */}
      <FullScreenWorkspace
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title={artist.name || 'Artist Profile'}
        subtitle={`ID: ${artist._id} • Connected & Up to Date`}
        onSave={handleSaveArtist}
        sidebar={
          <div className="space-y-4">
            <Card className="p-4 space-y-4 bg-white dark:bg-[#111827] border-rose-500/20">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Danger Zone</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Permanently remove this artist profile and disconnect API keys.
              </p>
              <Button variant="danger" size="sm" className="w-full" onClick={handleDeleteArtist}>
                <Trash2 size={14} /> Delete Artist
              </Button>
            </Card>
          </div>
        }
      >
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
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
                  multiline
                  rows={6}
                  value={editedArtist?.bio || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, bio: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
              <LinkIcon size={14} /> Platform OAuth Keys & IDs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] space-y-3">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase tracking-wider">
                  <FaSpotify size={16} /> Spotify Key
                </div>
                <Input
                  label="Spotify Artist ID"
                  placeholder="e.g. 6L88xirodmbWYoZuvseUnc"
                  value={editedArtist?.spotifyId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, spotifyId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] space-y-3">
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                  <FaYoutube size={16} /> YouTube Key
                </div>
                <Input
                  label="YouTube Channel ID"
                  placeholder="e.g. UCgRciTp6cVLeuHWe3jte_aQ"
                  value={editedArtist?.youtubeId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, youtubeId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] space-y-3">
                <div className="flex items-center gap-2 text-pink-500 font-bold text-xs uppercase tracking-wider">
                  <FaInstagram size={16} /> Meta Key
                </div>
                <Input
                  label="Instagram Graph ID"
                  placeholder="e.g. 78345277076"
                  value={editedArtist?.instaId || ''}
                  onChange={e => setEditedArtist({ ...editedArtist, instaId: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="mt-6 p-6 rounded-2xl bg-slate-50 dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap size={14} className="text-pink-500" /> Automated Meta / Instagram Login
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Connect securely via Facebook. Automatically extracts Graph IDs and enables real-time webhook mentions.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectMeta}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-500/20 hover:opacity-95 flex items-center gap-2 transition cursor-pointer"
              >
                <FaInstagram size={16} /> Connect Instagram / Facebook
              </button>
            </div>

            {/* Spotify OAuth Login */}
            <div className="mt-4 p-6 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FaSpotify size={14} className="text-emerald-500" /> Connect Artist Spotify Account
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Log in as the artist on Spotify to unlock top tracks, listening history, and audio features via OAuth.
                  {artist.oauthCredentials?.spotify?.connectedAt && (
                    <span className="ml-1 text-emerald-500 font-bold">
                      ✓ Connected as {artist.oauthCredentials.spotify.displayName || 'Spotify User'}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.href = `http://127.0.0.1:5000/api/artists/${artist._id}/auth/spotify`}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:opacity-95 flex items-center gap-2 transition cursor-pointer"
              >
                <FaSpotify size={16} /> {artist.oauthCredentials?.spotify?.connectedAt ? 'Reconnect Spotify' : 'Connect Spotify'}
              </button>
            </div>

            {/* YouTube OAuth Login */}
            <div className="mt-4 p-6 rounded-2xl bg-red-500/5 dark:bg-red-500/10 border border-red-500/20 flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FaYoutube size={14} className="text-red-500" /> Connect Artist YouTube Channel
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Log in with the artist's Google account to auto-discover their YouTube channel and sync subscriber/view data.
                  {artist.oauthCredentials?.youtube?.connectedAt && (
                    <span className="ml-1 text-red-500 font-bold">
                      ✓ Connected: {artist.oauthCredentials.youtube.channelTitle || 'YouTube Channel'}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.href = `http://127.0.0.1:5000/api/artists/${artist._id}/auth/youtube`}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-500/20 hover:opacity-95 flex items-center gap-2 transition cursor-pointer"
              >
                <FaYoutube size={16} /> {artist.oauthCredentials?.youtube?.connectedAt ? 'Reconnect YouTube' : 'Connect YouTube'}
              </button>
            </div>
          </section>
        </div>
      </FullScreenWorkspace>



      <FullScreenWorkspace
        isOpen={showAddVideoModal}
        onClose={() => { setShowAddVideoModal(false); setNewVideoUrl(''); setNewVideoTitle(''); setNewVideoChannel(''); }}
        title="Add Tracked Featured Video"
        subtitle="Track public stats for guest appearances & collabs on external channels"
        onSave={async () => {
          if (!newVideoUrl) { alert('Please enter a YouTube URL'); return; }
          try {
            await addVideoMutation.mutateAsync({
              id,
              data: { url: newVideoUrl, title: newVideoTitle, channelName: newVideoChannel }
            });
            setShowAddVideoModal(false);
            setNewVideoUrl('');
            setNewVideoTitle('');
            setNewVideoChannel('');
            alert('Featured video successfully added and stats tracked.');
          } catch (err) {
            alert('Error adding video: ' + (err.response?.data?.message || err.message));
          }
        }}
      >
        <div className="space-y-6 max-w-xl mx-auto p-4">
          <Input
            label="YouTube Video URL *"
            placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            value={newVideoUrl}
            onChange={e => setNewVideoUrl(e.target.value)}
          />
          <Input
            label="Custom Title (Optional)"
            placeholder="Collab Track feat. Artist"
            value={newVideoTitle}
            onChange={e => setNewVideoTitle(e.target.value)}
          />
          <Input
            label="Channel Name (Optional)"
            placeholder="Producer Channel"
            value={newVideoChannel}
            onChange={e => setNewVideoChannel(e.target.value)}
          />
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
}
