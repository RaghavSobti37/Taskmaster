import React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook } from 'react-icons/fa';
import { Card, Badge, Button } from '../ui';
import { formatNumber, byId, getProfileUrl } from '../../config/integrations.config';
import ConnectAccountButton from './ConnectAccountButton';
import AccountSwitcher from './AccountSwitcher';

const ICONS = { spotify: FaSpotify, youtube: FaYoutube, instagram: FaInstagram, facebook: FaFacebook };
const COLORS = {
  spotify: { text: 'text-emerald-600 dark:text-emerald-400', badge: 'success', border: 'border-emerald-500/20' },
  youtube: { text: 'text-red-600 dark:text-red-400', badge: 'rose', border: 'border-red-500/20' },
  instagram: { text: 'text-pink-600 dark:text-pink-400', badge: 'apricot', border: 'border-pink-500/20' },
  facebook: { text: 'text-blue-600 dark:text-blue-400', badge: 'info', border: 'border-blue-500/20' },
};

function PlatformCard({ provider, artist, normalized, connections, onSetPrimary, onReconnect }) {
  const config = byId(provider);
  const Icon = ICONS[provider];
  const colors = COLORS[provider] || COLORS.spotify;
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
    statRows.push({ label: 'Videos', value: formatNumber(analytics.videoCount) });
  } else if (provider === 'instagram') {
    statRows.push({ label: 'Followers', value: formatNumber(metrics.followers ?? analytics.followers) });
    statRows.push({ label: 'Engagement', value: metrics.engagementRate ? `${metrics.engagementRate}%` : (analytics.engagementRate ? `${analytics.engagementRate}%` : '—') });
  } else if (provider === 'facebook') {
    const fb = artist?.analytics?.facebook || {};
    statRows.push({ label: 'Followers', value: formatNumber(fb.followers) });
    statRows.push({ label: 'Page Likes', value: formatNumber(fb.likes) });
  }

  return (
    <Card className={`p-4 bg-white dark:bg-[#111827] border ${colors.border} dark:border-[#1F2937] shadow-sm flex flex-col gap-3 rounded-2xl`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${colors.text}`}>
          {Icon && <Icon size={16} />}
          {config?.name}
        </div>
        <Badge variant={needsOAuth ? 'warning' : isConnected ? colors.badge : 'info'}>
          {needsOAuth ? 'Needs Login' : isConnected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {conn?.accountLabel && (
        <p className="text-[11px] text-slate-500 truncate">{conn.accountLabel}</p>
      )}

      {isConnected ? (
        <>
          <div className={`grid gap-2 ${statRows.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {statRows.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">{s.label}</span>
                <span className="text-lg font-black mt-0.5">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            {profileUrl && (
              <Button
                variant="secondary"
                size="sm"
                className="!text-[11px] !py-1"
                onClick={() => window.open(profileUrl, '_blank', 'noopener,noreferrer')}
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
        </>
      ) : (
        <div className="flex flex-col items-center py-4 gap-3">
          <p className="text-[11px] text-slate-400 text-center">Connect {config?.name} to sync stats and manage posts.</p>
          <ConnectAccountButton provider={provider} artistId={artist._id} />
        </div>
      )}
    </Card>
  );
}

export default function PlatformSummaryCards({ artist, normalized, connections, onSetPrimary, providers = ['spotify', 'youtube', 'instagram'] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {providers.map((p) => (
        <PlatformCard
          key={p}
          provider={p}
          artist={artist}
          normalized={normalized}
          connections={connections}
          onSetPrimary={onSetPrimary}
        />
      ))}
    </div>
  );
}
