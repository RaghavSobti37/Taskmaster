import React, { useMemo } from 'react';
import { TrendingUp, Users, Activity, Zap } from 'lucide-react';
import { formatNumber, computeFallbackReach } from '../../config/integrations.config';
import OAuthExpiryBanner from './OAuthExpiryBanner';

function MiniMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[var(--radius-atomic)] bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] p-2.5 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        {Icon && <Icon size={11} strokeWidth={2.5} className="shrink-0" />}
        <span className="tm-widget-label truncate !text-[9px]">{label}</span>
      </div>
      <span className="tm-data-primary tabular-nums text-lg font-semibold leading-none truncate">{value}</span>
    </div>
  );
}

export default function UnifiedReachCard({
  normalized,
  connectionCount = 0,
  artist,
  connections = [],
  onReconnect,
}) {
  const unified = normalized?.unified || {};
  const platforms = normalized?.platforms || {};

  const reach = unified.reach || computeFallbackReach(artist);
  const connected = connectionCount || unified.connectedCount || Object.keys(platforms).length || 0;

  const expiredConnections = useMemo(
    () => connections.filter((c) => c.status === 'expired' || c.status === 'pending_reauth'),
    [connections]
  );

  const metrics = [
    { label: 'Engagement', value: unified.engagementRate ? `${unified.engagementRate}%` : '—', icon: Activity },
    { label: 'Growth', value: unified.growth ? `${Number(unified.growth).toFixed(1)}%` : '—', icon: TrendingUp },
    { label: 'Trend Score', value: unified.trendScore ?? '—', icon: Zap },
    { label: 'Platforms', value: connected || '—', icon: Users },
  ];

  return (
    <div className="space-y-3">
      <OAuthExpiryBanner expiredConnections={expiredConnections} onReconnect={onReconnect} />
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="shrink-0 lg:pr-6 lg:border-r lg:border-[var(--color-bg-border)]">
          <p className="tm-widget-label mb-1">Unified Audience</p>
          <p className="tm-data-primary tabular-nums text-3xl md:text-4xl font-semibold tracking-tight">
            {formatNumber(reach)}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
            Across {connected} connected platform{connected !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1 min-w-0">
          {metrics.map((m) => (
            <MiniMetric key={m.label} {...m} />
          ))}
        </div>
      </div>
    </div>
  );
}
