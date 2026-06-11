import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, BarChart3 } from 'lucide-react';
import { Button, TabSwitcher, Input, FullScreenWorkspace, SectionCard, MetricCard } from '../../../components/ui';
import { useArtistAnalytics } from '../../../hooks/useTaskmasterQueries';
import { formatChartData } from '../../../utils/analyticsDataUtils';
import { analyticsIntegrations } from '../../../config/integrations.config';
import UnifiedReachCard from '../../../components/artists/UnifiedReachCard';
import PlatformSummaryCards from '../../../components/artists/PlatformSummaryCards';
import MetricChart from '../../../components/artists/MetricChart';
import AssetTable from '../../../components/artists/AssetTable';
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

const SCORE_VARIANTS = {
  audienceScore: 'mint',
  growthScore: 'info',
  engagementScore: 'apricot',
  monetizationScore: 'slate',
};

const SCORE_LABELS = {
  audienceScore: 'Audience',
  growthScore: 'Growth',
  engagementScore: 'Engagement',
  monetizationScore: 'Monetization',
};

function AnalyticsInsightsPanel({ scores, correlations = [] }) {
  if (!scores && !correlations.length) return null;

  return (
    <div className="space-y-4 h-full">
      {scores && (
        <div className="space-y-2">
          <p className="tm-widget-label">OS Scores</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(SCORE_LABELS).map(([key, label]) => (
              <MetricCard
                key={key}
                label={label}
                value={scores[key] ?? '—'}
                variant={SCORE_VARIANTS[key] || 'slate'}
                className="!p-2.5"
              />
            ))}
          </div>
        </div>
      )}
      {correlations.length > 0 && (
        <div className="space-y-2 border-t border-[var(--color-bg-border)] pt-4">
          <p className="tm-widget-label">Release → Growth</p>
          <ul className="space-y-2">
            {correlations.map((c) => (
              <li key={c.releaseId} className="flex justify-between gap-2 text-xs border-b border-[var(--color-bg-border)]/60 pb-2">
                <span className="font-bold truncate">{c.title}</span>
                <span className={`shrink-0 tabular-nums font-bold ${c.spotifyDelta >= 0 ? 'tm-delta-positive' : 'tm-delta-negative'}`}>
                  {c.spotifyDelta >= 0 ? '+' : ''}{c.spotifyDelta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { preset, range } = useTimeRange();
  const timeframe = TIMEFRAME_FROM_PRESET[preset] || '28D';
  const platformParam = searchParams.get('platform');
  const initialTab = platformParam === 'meta' ? 'instagram' : platformParam;
  const [activeTab, setActiveTab] = useState(initialTab || 'spotify');

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'analytics');
    next.set('platform', tab);
    setSearchParams(next, { replace: true });
  };
  const [accountId] = useState(null);
  const [videoFilter, setVideoFilter] = useState('all');
  const [showAddVideo, setShowAddVideo] = useState(false);
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
    if (platformParam) {
      const resolved = platformParam === 'meta' ? 'instagram' : platformParam;
      if (tabs.some((t) => t.id === resolved)) setActiveTab(resolved);
    }
  }, [platformParam, tabs]);

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

  const activeTabLabel = tabs.find((t) => t.id === activeTab)?.label || activeTab;
  const assetSectionTitle = activeTab === 'spotify' ? 'Top Tracks' : activeTab === 'youtube' ? 'Videos' : 'Recent Posts';

  return (
    <div className="space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={16} className="text-[var(--color-action-primary)] shrink-0" />
          <div>
            <h2 className="tm-widget-label text-[var(--color-text-primary)] !text-[11px]">Audience Analytics</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              Cross-platform reach, growth, and content performance
            </p>
          </div>
        </div>
        <TimeRangePicker className="shrink-0" />
      </div>

      {(scoresError || analyticsError) && !isPreview && (
        <div className="pt-4">
          <QueryErrorBanner
            message={getQueryErrorMessage(scoresQueryError || analyticsQueryError, 'Failed to load analytics')}
            onRetry={() => {
              if (scoresError) refetchScores();
              if (analyticsError) refetchAnalytics();
            }}
          />
        </div>
      )}

      <SectionCard title="Overview" bodyClassName="!py-4">
        <UnifiedReachCard
          normalized={normalized || analyticsData?.normalized}
          connectionCount={connections.filter((c) => c.accountHandle).length}
          artist={artist}
          connections={connections}
          onReconnect={onSync}
        />
      </SectionCard>

      <SectionCard
        title="Platforms"
        subtitle="Click a platform to view its chart and content"
        bodyClassName="!py-4"
      >
        <PlatformSummaryCards
          artist={artist}
          normalized={normalized || analyticsData?.normalized}
          connections={connections}
          onSetPrimary={onSetPrimary}
          providers={summaryProviders}
          activeProvider={activeTab}
          onSelect={handleTabChange}
          compact
        />
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-3 border-t border-[var(--color-bg-border)]">
        <div className="xl:col-span-2 py-4 xl:pr-6 xl:border-r border-[var(--color-bg-border)] min-h-[260px]">
          <MetricChart chartData={chartData} activeTab={activeTab} rangeLabel={range.label} />
        </div>
        <div className="py-4 xl:pl-6">
          <AnalyticsInsightsPanel scores={scores} correlations={scoresData?.correlations} />
        </div>
      </div>

      <SectionCard
        title={assetSectionTitle}
        subtitle={activeTabLabel}
        bodyClassName="!py-0 !pt-2"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <TabSwitcher
              activeTab={activeTab}
              onChange={handleTabChange}
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
        }
      >
        <AssetTable
          activeTab={activeTab}
          tracks={tracks}
          videos={videos}
          posts={posts}
          loading={isAnalyticsLoading}
          videoFilter={videoFilter}
          onVideoFilterChange={setVideoFilter}
        />
      </SectionCard>

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
