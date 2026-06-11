import React from 'react';
import { ExternalLink } from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook } from 'react-icons/fa';
import { Badge, Button } from '../ui';
import { formatNumber, byId, getProfileUrl } from '../../config/integrations.config';
import ConnectAccountButton from './ConnectAccountButton';
import AccountSwitcher from './AccountSwitcher';

const ICONS = { spotify: FaSpotify, youtube: FaYoutube, instagram: FaInstagram, facebook: FaFacebook };
const COLORS = {
  spotify: { text: 'text-emerald-600 dark:text-emerald-400', badge: 'success', accent: 'border-emerald-500/40' },
  youtube: { text: 'text-red-600 dark:text-red-400', badge: 'rose', accent: 'border-red-500/40' },
  instagram: { text: 'text-pink-600 dark:text-pink-400', badge: 'apricot', accent: 'border-pink-500/40' },
  facebook: { text: 'text-blue-600 dark:text-blue-400', badge: 'info', accent: 'border-blue-500/40' },
};

function PlatformCard({
  provider,
  artist,
  normalized,
  connections,
  onSetPrimary,
  activeProvider,
  onSelect,
  compact = false,
}) {
  const config = byId(provider);
  const Icon = ICONS[provider];
  const colors = COLORS[provider] || COLORS.spotify;
  const isActive = activeProvider === provider;
  const conn = connections.find((c) => c.provider === provider && c.isPrimary)
    || connections.find((c) => c.provider === provider);
  const hasHandle = !!(conn?.accountHandle);
  const isConnected = hasHandle || conn?.status === 'active';
  const needsOAuth = provider === 'instagram' && hasHandle && !conn?.authenticated;

  const metrics = normalized?.platforms?.[provider] || {};
  const analytics = artist?.analytics?.[provider] || {};
  const profileUrl = getProfileUrl(provider, { connection: conn, artist });

  const statRows = [];
  if (provider === 'spotify') {
    statRows.push({ label: 'Followers', value: formatNumber(metrics.followers ?? analytics.followers) });
    statRows.push({ label: 'Popularity', value: analytics.popularity != null ? `${analytics.popularity}/100` : '—' });
  } else if (provider === 'youtube') {
    statRows.push({ label: 'Subscribers', value: formatNumber(metrics.followers ?? analytics.subscribers) });
    statRows.push({ label: 'Views', value: formatNumber(analytics.views) });
    if (!compact) statRows.push({ label: 'Videos', value: formatNumber(analytics.videoCount) });
  } else if (provider === 'instagram') {
    statRows.push({ label: 'Followers', value: formatNumber(metrics.followers ?? analytics.followers) });
    statRows.push({ label: 'Engagement', value: metrics.engagementRate ? `${metrics.engagementRate}%` : (analytics.engagementRate ? `${analytics.engagementRate}%` : '—') });
  } else if (provider === 'facebook') {
    const fb = artist?.analytics?.facebook || {};
    statRows.push({ label: 'Followers', value: formatNumber(fb.followers) });
    statRows.push({ label: 'Page Likes', value: formatNumber(fb.likes) });
  }

  const handleCardClick = () => {
    if (onSelect) onSelect(provider);
  };

  const cardClass = [
    'flex flex-col gap-2.5 rounded-[var(--radius-atomic)] border bg-[var(--color-bg-surface)] transition-colors',
    compact ? 'p-3' : 'p-4',
    isActive
      ? `border-[var(--color-action-primary)] ring-1 ring-[var(--color-action-primary)]/25`
      : `border-[var(--color-bg-border)] ${onSelect ? 'hover:border-[var(--color-action-primary)]/40 cursor-pointer' : ''}`,
    colors.accent,
  ].join(' ');

  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? handleCardClick : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(); } } : undefined}
      className={cardClass}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${colors.text}`}>
          {Icon && <Icon size={compact ? 14 : 16} />}
          {config?.name}
        </div>
        <Badge variant={needsOAuth ? 'warning' : isConnected ? colors.badge : 'info'}>
          {needsOAuth ? 'Needs Login' : isConnected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {conn?.accountLabel && (
        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{conn.accountLabel}</p>
      )}

      {isConnected ? (
        <>
          <div className={`grid gap-2 ${statRows.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {statRows.map((s) => (
              <div key={s.label} className="flex flex-col min-w-0">
                <span className="tm-widget-label !text-[9px]">{s.label}</span>
                <span className="tm-data-primary tabular-nums text-base font-semibold mt-0.5 truncate">{s.value}</span>
              </div>
            ))}
          </div>

          {!compact && (
            <div
              className="flex flex-wrap items-center gap-2 pt-1 border-t border-[var(--color-bg-border)]"
              onClick={(e) => e.stopPropagation()}
            >
              {profileUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="!text-[11px] !py-1"
                  onClick={(e) => { e.stopPropagation(); window.open(profileUrl, '_blank', 'noopener,noreferrer'); }}
                >
                  <ExternalLink size={12} /> Visit Profile
                </Button>
              )}
              {(provider === 'instagram' || provider === 'spotify' || provider === 'youtube') && (
                <ConnectAccountButton
                  provider={provider}
                  artistId={artist._id}
                  variant="compact"
                  label={needsOAuth ? 'Login' : 'Reconnect'}
                />
              )}
              <AccountSwitcher connections={connections} provider={provider} onSetPrimary={onSetPrimary} />
            </div>
          )}
        </>
      ) : (
        <div
          className="flex flex-col items-center py-3 gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[10px] text-[var(--color-text-muted)] text-center">
            Connect {config?.name} to sync stats
          </p>
          <ConnectAccountButton provider={provider} artistId={artist._id} />
        </div>
      )}
    </div>
  );
}

export default function PlatformSummaryCards({
  artist,
  normalized,
  connections,
  onSetPrimary,
  providers = ['spotify', 'youtube', 'instagram'],
  activeProvider,
  onSelect,
  compact = false,
}) {
  const cols = providers.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 ${cols} gap-3`}>
      {providers.map((p) => (
        <PlatformCard
          key={p}
          provider={p}
          artist={artist}
          normalized={normalized}
          connections={connections}
          onSetPrimary={onSetPrimary}
          activeProvider={activeProvider}
          onSelect={onSelect}
          compact={compact}
        />
      ))}
    </div>
  );
}
