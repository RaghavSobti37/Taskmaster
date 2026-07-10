import React from 'react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook } from 'react-icons/fa';
import { Card } from '../ui';
import MetricChart from './MetricChart';
import AssetTable from './AssetTable';

const PLATFORM_META = {
  spotify: {
    icon: FaSpotify,
    label: 'Spotify Catalog',
    accent: 'text-emerald-500',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
  },
  youtube: {
    icon: FaYoutube,
    label: 'YouTube Videos',
    accent: 'text-red-500',
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
  },
  instagram: {
    icon: FaInstagram,
    label: 'Instagram Media',
    accent: 'text-pink-500',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/5',
  },
  facebook: {
    icon: FaFacebook,
    label: 'Facebook',
    accent: 'text-blue-500',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
};

function SectionHeader({ platform, statHint }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.spotify;
  const Icon = meta.icon;
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-bg-border)] ${meta.bg}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} border ${meta.border}`}>
          <Icon size={16} className={meta.accent} />
        </div>
        <div className="min-w-0">
          <h3 className={`text-xs font-black uppercase tracking-widest ${meta.accent}`}>{meta.label}</h3>
          {statHint && (
            <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">{statHint}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlatformAnalyticsSection({
  platform,
  chartData = [],
  timeframe,
  tracks = [],
  videos = [],
  posts = [],
  loading = false,
  videoFilter,
  onVideoFilterChange,
  headerAction,
  statHint,
}) {
  const sectionId = `analytics-${platform}`;
  const hasTable = platform !== 'facebook';

  return (
    <Card
      id={sectionId}
      className={`scroll-mt-24 overflow-hidden rounded-2xl border ${PLATFORM_META[platform]?.border || 'border-[var(--color-bg-border)]'} bg-[var(--color-bg-surface)]`}
    >
      <SectionHeader platform={platform} statHint={statHint} />
      {headerAction && (
        <div className="px-4 pt-3 flex justify-end">{headerAction}</div>
      )}
      <div className="space-y-4 p-4">
        <MetricChart
          chartData={chartData}
          activeTab={platform}
          rangeLabel={timeframe}
        />
        {hasTable && (
          <AssetTable
            activeTab={platform}
            tracks={tracks}
            videos={videos}
            posts={posts}
            loading={loading}
            videoFilter={videoFilter}
            onVideoFilterChange={onVideoFilterChange}
          />
        )}
        {!hasTable && (
          <p className="text-xs text-[var(--color-text-muted)] text-center py-6">
            Facebook metrics appear in the summary cards above.
          </p>
        )}
      </div>
    </Card>
  );
}

export { PLATFORM_META };
