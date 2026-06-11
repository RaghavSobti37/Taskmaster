import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, BarChart3 } from 'lucide-react';
import { Button, Input, FullScreenWorkspace, SectionCard, MetricCard } from '../../../components/ui';
import { useArtistAnalytics } from '../../../hooks/useTaskmasterQueries';
import { formatChartData } from '../../../utils/analyticsDataUtils';
import { formatNumber } from '../../../config/integrations.config';
import UnifiedReachCard from '../../../components/artists/UnifiedReachCard';
import PlatformSummaryCards from '../../../components/artists/PlatformSummaryCards';
import PlatformAnalyticsSection from '../../../components/artists/PlatformAnalyticsSection';
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

const ANALYTICS_PLATFORMS = ['spotify', 'youtube', 'instagram'];

const HISTORY_KEY = {
  spotify: 'spotify',
  youtube: 'youtube',
  instagram: 'meta',
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

function sliceHistory(rawHistory, timeframe) {
  if (!rawHistory?.length || timeframe === 'ALL') return rawHistory || [];
  const now = new Date();
  let from = new Date(now);
  if (timeframe === 'YTD') from = new Date(now.getFullYear(), 0, 1);
  else from.setDate(from.getDate() - ({ '7D': 7, '28D': 28, '90D': 90 }[timeframe] || 28));
  return rawHistory.filter((h) => new Date(h.timestamp || h.date) >= from);
}

function AnalyticsInsightsPanel({ scores, correlations = [] }) {
  if (!scores && !correlations.length) return null;

  return (
    <div className="space-y-4">
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
  const [focusedPlatform, setFocusedPlatform] = useState(null);
  const [videoFilter, setVideoFilter] = useState('all');
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [newVideo, setNewVideo] = useState({ url: '', title: '', channelName: '' });

  const { data: scoresData, isError: scoresError, error: scoresQueryError, refetch: refetchScores } = useArtistOsScores(
    artistId,
    !!artistId && !isPreview
  );
  const scores = scoresData?.scores;

  const { data: analyticsData, isLoading: isAnalyticsLoading, isError: analyticsError, error: analyticsQueryError, refetch: refetchAnalytics } = useArtistAnalytics(
    artistId,
    'spotify',
    timeframe,
    null,
    !!artistId
  );

  const summaryProviders = useMemo(() => {
    const base = ['spotify', 'youtube', 'instagram'];
    if (connections.some((c) => c.provider === 'facebook' && c.accountHandle)) base.push('facebook');
    return base;
  }, [connections]);

  const visiblePlatforms = useMemo(() => {
    if (!connectedProviders.length) return ANALYTICS_PLATFORMS;
    return ANALYTICS_PLATFORMS.filter(
      (p) => connectedProviders.includes(p) || (p === 'instagram' && connectedProviders.includes('meta'))
    );
  }, [connectedProviders]);

  const tracks = analyticsData?.tracks || [];
  const videos = analyticsData?.videos || [];
  const posts = analyticsData?.posts || [];
  const history = analyticsData?.history || {};

  const platformChartData = useMemo(() => {
    const out = {};
    ANALYTICS_PLATFORMS.forEach((platform) => {
      const key = HISTORY_KEY[platform];
      out[platform] = formatChartData(sliceHistory(history[key] || [], timeframe), platform);
    });
    return out;
  }, [history, timeframe]);

  const platformStatHints = useMemo(() => {
    const analytics = artist?.analytics || {};
    return {
      spotify: analytics.spotify?.followers != null
        ? `${formatNumber(analytics.spotify.followers)} followers · Popularity ${analytics.spotify.popularity ?? '—'}/100`
        : null,
      youtube: analytics.youtube?.subscribers != null
        ? `${formatNumber(analytics.youtube.subscribers)} subs · ${formatNumber(analytics.youtube.views)} views`
        : null,
      instagram: analytics.instagram?.followers != null
        ? `${formatNumber(analytics.instagram.followers)} followers · ${analytics.instagram.engagementRate ?? '—'}% engagement`
        : null,
    };
  }, [artist?.analytics]);

  const scrollToPlatform = useCallback((platform) => {
    setFocusedPlatform(platform);
    document.getElementById(`analytics-${platform}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const platform = searchParams.get('platform');
    if (!platform) return;
    const resolved = platform === 'meta' ? 'instagram' : platform;
    const timer = window.setTimeout(() => scrollToPlatform(resolved), 150);
    const next = new URLSearchParams(searchParams);
    next.delete('platform');
    setSearchParams(next, { replace: true });
    return () => window.clearTimeout(timer);
  }, [searchParams, setSearchParams, scrollToPlatform]);

  useEffect(() => {
    const hash = window.location.hash?.replace('#', '');
    if (!hash.startsWith('analytics-')) return;
    const platform = hash.replace('analytics-', '');
    const timer = window.setTimeout(() => scrollToPlatform(platform), 150);
    return () => window.clearTimeout(timer);
  }, [scrollToPlatform]);

  return (
    <div className="space-y-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 size={16} className="text-[var(--color-action-primary)] shrink-0" />
          <div>
            <h2 className="tm-widget-label text-[var(--color-text-primary)] !text-[11px]">Audience Analytics</h2>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              All platforms on one page — scroll for charts and content tables
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
        subtitle="Click a card to jump to that platform's chart and content"
        bodyClassName="!py-4"
      >
        <PlatformSummaryCards
          artist={artist}
          normalized={normalized || analyticsData?.normalized}
          connections={connections}
          onSetPrimary={onSetPrimary}
          providers={summaryProviders}
          activeProvider={focusedPlatform}
          onSelect={scrollToPlatform}
          compact
        />
      </SectionCard>

      {(scores || scoresData?.correlations?.length > 0) && (
        <SectionCard title="Insights" bodyClassName="!py-4">
          <AnalyticsInsightsPanel scores={scores} correlations={scoresData?.correlations} />
        </SectionCard>
      )}

      <SectionCard
        title="Platform Breakdown"
        subtitle="Charts and content for each connected platform"
        bodyClassName="!py-4 space-y-5"
      >
        {visiblePlatforms.map((platform) => (
          <PlatformAnalyticsSection
            key={platform}
            platform={platform}
            chartData={platformChartData[platform]}
            timeframe={range.label}
            tracks={tracks}
            videos={videos}
            posts={posts}
            loading={isAnalyticsLoading}
            videoFilter={platform === 'youtube' ? videoFilter : undefined}
            onVideoFilterChange={platform === 'youtube' ? setVideoFilter : undefined}
            statHint={platformStatHints[platform]}
            headerAction={
              platform === 'youtube' && !isPreview && addVideoMutation ? (
                <Button size="sm" onClick={() => setShowAddVideo(true)}>
                  <Plus size={14} /> Add Featured Video
                </Button>
              ) : null
            }
          />
        ))}
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
