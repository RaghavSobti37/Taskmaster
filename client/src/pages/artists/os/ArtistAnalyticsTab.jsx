import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Link2 } from 'lucide-react';
import { Button, TabSwitcher, Input, FullScreenWorkspace } from '../../../components/ui';
import { useArtistAnalytics } from '../../../hooks/useTaskmasterQueries';
import { formatChartData } from '../../../utils/analyticsDataUtils';
import { analyticsIntegrations } from '../../../config/integrations.config';
import UnifiedReachCard from '../../../components/artists/UnifiedReachCard';
import PlatformSummaryCards from '../../../components/artists/PlatformSummaryCards';
import ConnectSocialModal from '../../../components/artists/ConnectSocialModal';
import MetricChart from '../../../components/artists/MetricChart';
import AssetTable from '../../../components/artists/AssetTable';
import { Card } from '../../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../../components/ui/QueryErrorBanner';
import {
  TimeRangeProvider,
  TimeRangePicker,
  TIME_RANGE_PRESETS,
  useTimeRange,
} from '../../../contexts/TimeRangeContext';
import { useArtistOsScores } from '../../../hooks/queries/artistOs';

const TIMEFRAME_FROM_PRESET = {
  [TIME_RANGE_PRESETS.today]: '7D',
  [TIME_RANGE_PRESETS.last7]: '7D',
  [TIME_RANGE_PRESETS.last30]: '28D',
  [TIME_RANGE_PRESETS.last90]: '90D',
  [TIME_RANGE_PRESETS.thisMonth]: '28D',
  [TIME_RANGE_PRESETS.lastMonth]: '28D',
  [TIME_RANGE_PRESETS.custom]: '28D',
};

function ScoreCard({ label, value }) {
  return (
    <Card className="p-3 rounded-xl text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{label}</p>
      <p className="text-2xl font-black mt-1">{value ?? '—'}</p>
    </Card>
  );
}

export default function ArtistAnalyticsTab(props) {
  return (
    <TimeRangeProvider initialPreset={TIME_RANGE_PRESETS.last30}>
      <ArtistAnalyticsTabInner {...props} />
    </TimeRangeProvider>
  );
}

function ArtistAnalyticsTabInner({
  artistId,
  artist,
  connections = [],
  normalized,
  connectedProviders = [],
  isPreview,
  onSync,
  onSetPrimary,
  addVideoMutation,
}) {
  const { preset } = useTimeRange();
  const timeframe = TIMEFRAME_FROM_PRESET[preset] || '28D';
  const [activeTab, setActiveTab] = useState('spotify');
  const [accountId] = useState(null);
  const [videoFilter, setVideoFilter] = useState('all');
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [newVideo, setNewVideo] = useState({ url: '', title: '', channelName: '' });

  const { data: scoresData, isError: scoresError, error: scoresQueryError, refetch: refetchScores } = useArtistOsScores(artistId, !!artistId && !isPreview);
  const scores = scoresData?.scores;

  const analyticsPlatform = activeTab === 'meta' ? 'instagram' : activeTab;
  const { data: analyticsData, isLoading: isAnalyticsLoading, isError: analyticsError, error: analyticsQueryError, refetch: refetchAnalytics } = useArtistAnalytics(
    artistId,
    analyticsPlatform,
    timeframe,
    accountId,
    !!artistId
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
  const rawHistory = analyticsData?.history?.[historyKey] || analyticsData?.history?.[activeTab] || [];
  const slicedHistory = useMemo(() => {
    if (!rawHistory.length || timeframe === 'ALL') return rawHistory;
    const now = new Date();
    let from = new Date(now);
    if (timeframe === 'YTD') from = new Date(now.getFullYear(), 0, 1);
    else from.setDate(from.getDate() - ({ '7D': 7, '28D': 28, '90D': 90 }[timeframe] || 28));
    return rawHistory.filter((h) => new Date(h.timestamp || h.date) >= from);
  }, [rawHistory, timeframe]);
  const chartData = formatChartData(slicedHistory, activeTab);

  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const posts = analyticsData?.posts || [];

  return (
    <div className="space-y-6">
      <TimeRangePicker />
      {(scoresError || analyticsError) && !isPreview && (
        <QueryErrorBanner
          message={getQueryErrorMessage(scoresQueryError || analyticsQueryError, 'Failed to load analytics')}
          onRetry={() => {
            if (scoresError) refetchScores();
            if (analyticsError) refetchAnalytics();
          }}
        />
      )}
      <UnifiedReachCard
        normalized={normalized || analyticsData?.normalized}
        connectionCount={connections.filter((c) => c.accountHandle).length}
        artist={artist}
        connections={connections}
        onReconnect={onSync}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
            Connected Platforms
          </h3>
          {!isPreview && artistId && (
            <Button size="sm" onClick={() => setShowConnectModal(true)}>
              <Link2 size={14} /> Connect Social Media
            </Button>
          )}
        </div>
        <PlatformSummaryCards
          artist={artist}
          normalized={normalized || analyticsData?.normalized}
          connections={connections}
          onSetPrimary={onSetPrimary}
          providers={summaryProviders}
          onAddPlatform={!isPreview && artistId ? () => setShowConnectModal(true) : undefined}
        />
      </div>

      <ConnectSocialModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        artistId={artistId}
        connections={connections}
      />

      {scores && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ScoreCard label="Audience" value={scores.audienceScore} />
          <ScoreCard label="Growth" value={scores.growthScore} />
          <ScoreCard label="Engagement" value={scores.engagementScore} />
          <ScoreCard label="Monetization" value={scores.monetizationScore} />
        </div>
      )}

      {scoresData?.correlations?.length > 0 && (
        <Card className="p-4 rounded-2xl space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Release → Growth</h4>
          {scoresData.correlations.map((c) => (
            <div key={c.releaseId} className="flex justify-between text-xs">
              <span className="font-bold">{c.title}</span>
              <span className={c.spotifyDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                Spotify {c.spotifyDelta >= 0 ? '+' : ''}{c.spotifyDelta}
              </span>
            </div>
          ))}
        </Card>
      )}

      <MetricChart
        chartData={chartData}
        activeTab={activeTab}
        timeframe={timeframe}
        onTimeframeChange={() => {}}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabSwitcher
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={tabs.length ? tabs : [
              { id: 'spotify', label: 'Spotify' },
              { id: 'youtube', label: 'YouTube' },
              { id: 'instagram', label: 'Instagram' },
            ]}
          />
          {activeTab === 'youtube' && !isPreview && addVideoMutation && (
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

      {addVideoMutation && (
        <FullScreenWorkspace
          isOpen={showAddVideo}
          onClose={() => { setShowAddVideo(false); setNewVideo({ url: '', title: '', channelName: '' }); }}
          title="Add Featured Video"
          subtitle="Track collab / guest appearance stats"
          hasChanges={showAddVideo && !!(newVideo.url || newVideo.title || newVideo.channelName)}
          onCancel={() => setNewVideo({ url: '', title: '', channelName: '' })}
          onSave={async () => {
            if (!newVideo.url) return alert('YouTube URL required');
            await addVideoMutation.mutateAsync({ id: artistId, data: newVideo });
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
      )}
    </div>
  );
}
