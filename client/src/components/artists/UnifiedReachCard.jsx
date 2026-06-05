import React, { useMemo } from 'react';
import { TrendingUp, Users, Activity, Zap } from 'lucide-react';
import { Card } from '../ui';
import { formatNumber, computeFallbackReach } from '../../config/integrations.config';
import OAuthExpiryBanner from './OAuthExpiryBanner';

function MiniMetric({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] p-3 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        {Icon && <Icon size={11} strokeWidth={2.5} className="shrink-0" />}
        <span className="text-[9px] font-black uppercase tracking-widest truncate">{label}</span>
      </div>
      <span className="text-xl font-black text-[var(--color-text-primary)] leading-none truncate">{value}</span>
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
    <Card className="p-5 md:p-6 bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] rounded-2xl overflow-hidden space-y-4">
      <OAuthExpiryBanner expiredConnections={expiredConnections} onReconnect={onReconnect} />
      <div className="flex flex-col xl:flex-row xl:items-stretch gap-6">
        <div className="shrink-0 xl:pr-6 xl:border-r xl:border-[var(--color-bg-border)]">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">Unified Audience</p>
          <h2 className="text-4xl font-black tracking-tight text-[var(--color-text-primary)]">{formatNumber(reach)}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Across {connected} connected platform{connected !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-0">
          {metrics.map((m) => (
            <MiniMetric key={m.label} {...m} />
          ))}
        </div>
      </div>
    </Card>
  );
}
