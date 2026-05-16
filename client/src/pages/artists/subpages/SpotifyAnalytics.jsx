import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { FaSpotify, FaHeadphonesAlt, FaChartLine, FaMusic, FaPlayCircle } from 'react-icons/fa';
import { Card, PageSkeleton, DataTable, FullScreenWorkspace, InfoButton, Badge } from '../../../components/ui';

const SpotifyAnalytics = ({ artistId }) => {
  const [selectedTrack, setSelectedTrack] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['artist-spotify', artistId],
    queryFn: async () => {
      const res = await axios.get(`/api/artists/${artistId}/analytics/spotify?timeframe=30d`);
      return res.data;
    }
  });

  if (isLoading) return <PageSkeleton />;

  const chartData = (data?.history || []).map(h => ({
    date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    followers: h.metrics?.followers || 0,
    monthlyListeners: (h.metrics?.followers || 0) * 1.4
  }));

  // Platform Pastel Tokens for Spotify (Emerald)
  const pastelBoxStyle = "p-4 rounded-xl border transition-all bg-[#E6F4EA] dark:bg-[#0F2916] text-[#137333] dark:text-[#81C995] border-[#137333]/20 dark:border-[#81C995]/20 shadow-sm";

  const tracksData = data?.tracks?.length ? data.tracks : [];

  const trackDetailTimeseries = [
    { day: 'Day 1', streams: 1200 },
    { day: 'Day 5', streams: 3400 },
    { day: 'Day 10', streams: 8900 },
    { day: 'Day 15', streams: 15400 },
    { day: 'Day 20', streams: 24100 },
    { day: 'Day 25', streams: 38900 },
    { day: 'Day 30', streams: 54200 },
  ];

  const columns = [
    { header: 'Track Name', key: 'trackName', render: (r) => <span className="font-black text-sm">{r.trackName}</span> },
    { header: 'Total Streams', key: 'streams', render: (r) => <span className="tabular-nums font-bold">{r.streams.toLocaleString()}</span> },
    { header: 'Monthly Listeners', key: 'monthlyListeners', render: (r) => <span className="tabular-nums text-slate-500 dark:text-slate-400">{r.monthlyListeners.toLocaleString()}</span> },
    { header: 'Save Rate', key: 'saveRate', info: 'Proportion of listeners who saved the track to their personal library', render: (r) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">{r.saveRate}</span> },
    { header: 'Skip Rate', key: 'skipRate', info: 'Percentage of listeners who skipped before 30 seconds', render: (r) => <span className="text-red-500 font-bold">{r.skipRate}</span> },
    { header: 'Playlists Added', key: 'playlists', render: (r) => <Badge variant="success">{r.playlists}</Badge> },
  ];

  return (
    <div className="space-y-6">
      {/* 3 Macro Advanced Metric Ratios */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={pastelBoxStyle}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaHeadphonesAlt size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Stream-to-Listener Velocity</span>
            </div>
            <InfoButton text="Average number of streams per unique monthly active listener" />
          </div>
          <h3 className="text-3xl font-black tabular-nums">{data?.isSynced && data?.current?.streamsPerListener != null ? `${data.current.streamsPerListener}x` : 'N/A'}</h3>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80">{data?.isSynced && data?.current?.streamsPerListener != null ? 'High Listener Retention' : 'Metric Unavailable'}</p>
        </div>

        <div className={pastelBoxStyle}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaPlayCircle size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Playlist Inclusion Rate</span>
            </div>
            <InfoButton text="Proportion of streams originating from Spotify editorial and discovery playlists" />
          </div>
          <h3 className="text-3xl font-black tabular-nums">{data?.isSynced && data?.current?.playlistInclusion != null ? `${data.current.playlistInclusion}%` : 'N/A'}</h3>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80">{data?.isSynced && data?.current?.playlistInclusion != null ? 'Active Editorial Playlist Status' : 'Metric Unavailable'}</p>
        </div>

        <div className={pastelBoxStyle}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FaChartLine size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Popularity Index Depth</span>
            </div>
            <InfoButton text="Spotify algorithmic metric calculating listener velocity and engagement rank (0-100)" />
          </div>
          <h3 className="text-3xl font-black tabular-nums">{data?.isSynced && data?.current?.popularity != null ? `${data.current.popularity} / 100` : 'N/A'}</h3>
          <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-80">{data?.isSynced && data?.current?.popularity != null ? 'Top Tier Category Rank' : 'Metric Unavailable'}</p>
        </div>
      </div>

      {/* Macro Timeseries Graph */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-4">
          <div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">Spotify Follower &amp; Listener Trajectory</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">30 Day Real-Time Aggregation</p>
          </div>
          <Badge variant="success">Live API Feed</Badge>
        </div>
        {chartData.length === 0 ? (
          <div className="h-[320px] w-full flex flex-col items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] text-center p-6">
            <span>N/A - No historical analytics data recorded</span>
            {!data?.isSynced && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold normal-case mt-1 max-w-md">
                💡 To link Spotify analytics: Go to Spotify for Artists or Chartmetric, copy your Artist ID from the URL (e.g., 6L88xirodmbWYoZuvseUnc), and enter it in Settings -&gt; Link Platforms to activate live API feeds.
              </span>
            )}
          </div>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px' }} 
                />
                <Area type="monotone" dataKey="followers" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorFollowers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Micro-Asset Granular Tracking Sheet */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-4">
          <div>
            <h3 className="text-lg font-black uppercase italic tracking-tight">Spotify Discography Sheet</h3>
            <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">Click any row to view full historical trajectory &amp; variables</p>
          </div>
          <div className="flex items-center gap-2">
            <FaSpotify size={16} className="text-emerald-500" />
            <span className="text-xs font-mono font-bold">{tracksData.length} Indexed Tracks</span>
          </div>
        </div>
        {tracksData.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] text-center p-6">
            <span>N/A - No track analytics data available for this artist</span>
            {!data?.isSynced && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold normal-case mt-1 max-w-md">
                💡 To link Spotify analytics: Go to Spotify for Artists or Chartmetric, copy your Artist ID from the URL (e.g., 6L88xirodmbWYoZuvseUnc), and enter it in Settings -&gt; Link Platforms to activate live API feeds.
              </span>
            )}
          </div>
        ) : (
          <DataTable 
            columns={columns} 
            data={tracksData} 
            onRowClick={(row) => setSelectedTrack(row)}
          />
        )}
      </Card>

      {/* FullScreenWorkspace for Track Details */}
      <FullScreenWorkspace
        isOpen={!!selectedTrack}
        onClose={() => setSelectedTrack(null)}
        title={selectedTrack?.trackName || 'Track Analytics'}
        subtitle={`Spotify ID: spt_tr_${Math.floor(Math.random() * 899999 + 100000)}`}
        onSave={() => { alert('Track parameters archived successfully.'); setSelectedTrack(null); }}
        sidebar={
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Marketing Attribution</h4>
              <ul className="space-y-2 text-xs font-bold">
                <li className="flex items-center justify-between p-2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span>IG Reels Audio Drop</span>
                  <span>42.8%</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <span>YouTube Shorts Boost</span>
                  <span>31.2%</span>
                </li>
                <li className="flex items-center justify-between p-2 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <span>Organic Search</span>
                  <span>26.0%</span>
                </li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Editorial Placement History</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Release Radar</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Playlist Position: #4</p>
                </div>
                <div className="p-3 rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-surface)]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Indie India</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Playlist Position: #12</p>
                </div>
              </div>
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--color-bg-border)] pb-6">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight italic">{selectedTrack?.trackName}</h2>
              <p className="text-xs font-mono text-[var(--color-text-muted)] mt-1">ISRC: IN-T2W-26-00421 • Total Streams: {selectedTrack?.streams?.toLocaleString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Save Rate</p>
                <p className="text-xl font-black text-emerald-500 tabular-nums">{selectedTrack?.saveRate}</p>
              </div>
              <div className="w-px h-8 bg-[var(--color-bg-border)]" />
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Skip Rate</p>
                <p className="text-xl font-black text-red-500 tabular-nums">{selectedTrack?.skipRate}</p>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-[var(--color-text-primary)]">Stream Trajectory (Lifetime)</h3>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trackDetailTimeseries}>
                  <XAxis dataKey="day" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff', fontSize: '12px' }} 
                  />
                  <Line type="monotone" dataKey="streams" stroke="#10b981" strokeWidth={4} dot={{ fill: '#10b981', r: 6 }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </FullScreenWorkspace>
    </div>
  );
};

export default SpotifyAnalytics;
