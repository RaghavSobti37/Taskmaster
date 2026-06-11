import React, { useMemo, useState } from 'react';
import { Globe, RefreshCw, Loader2, Activity } from 'lucide-react';
import {
  FaSpotify, FaYoutube, FaInstagram, FaFacebook, FaTiktok, FaTwitch,
  FaSoundcloud, FaDiscord, FaLinkedin, FaSnapchat, FaShopify, FaAmazon,
} from 'react-icons/fa';
import { SiApplemusic, SiBeatport, SiAudiomack, SiTelegram, SiPatreon, SiSubstack, SiWoo, SiX } from 'react-icons/si';
import { Card, Input, Badge, Button } from '../ui';
import ConnectAccountButton from './ConnectAccountButton';
import { formatNumber } from '../../config/integrations.config';
import {
  useConnectionHub,
  useConnectionHealth,
  useSyncPlatformConnection,
  useSaveManualConnection,
} from '../../hooks/queries/artists';

const ICONS = {
  spotify: FaSpotify,
  youtube: FaYoutube,
  instagram: FaInstagram,
  facebook: FaFacebook,
  tiktok: FaTiktok,
  twitch: FaTwitch,
  soundcloud: FaSoundcloud,
  discord: FaDiscord,
  linkedin: FaLinkedin,
  snapchat: FaSnapchat,
  shopify: FaShopify,
  'apple-music': SiApplemusic,
  'amazon-music': FaAmazon,
  beatport: SiBeatport,
  audiomack: SiAudiomack,
  telegram: SiTelegram,
  patreon: SiPatreon,
  substack: SiSubstack,
  woocommerce: SiWoo,
  x: SiX,
};

const COLOR_RING = {
  emerald: 'border-emerald-500/30',
  rose: 'border-rose-500/30',
  pink: 'border-pink-500/30',
  blue: 'border-blue-500/30',
  slate: 'border-slate-500/30',
  purple: 'border-purple-500/30',
  orange: 'border-orange-500/30',
  green: 'border-green-500/30',
  red: 'border-red-500/30',
  cyan: 'border-cyan-500/30',
  amber: 'border-amber-500/30',
  lime: 'border-lime-500/30',
  zinc: 'border-zinc-500/30',
  neutral: 'border-neutral-500/30',
  sky: 'border-sky-500/30',
  yellow: 'border-yellow-500/30',
  indigo: 'border-indigo-500/30',
  violet: 'border-violet-500/30',
};

const STATUS_BADGE = {
  connected: { label: 'Connected', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  expired: { label: 'Expired', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
  manual: { label: 'Manual', variant: 'default' },
  coming_soon: { label: 'Coming soon', variant: 'default' },
  disconnected: { label: 'Not linked', variant: 'default' },
};

function healthBadgeKey(platform) {
  return platform.hubStatus || platform.health?.status || 'disconnected';
}

function PlatformCard({ platform, artistId, isPreview, onSync, syncingId, onSaveManual, savingId }) {
  const Icon = ICONS[platform.id] || Globe;
  const ring = COLOR_RING[platform.colorClass || platform.color] || 'border-slate-500/30';
  const badgeKey = healthBadgeKey(platform);
  const badge = STATUS_BADGE[badgeKey] || STATUS_BADGE.disconnected;
  const [manualHandle, setManualHandle] = useState(platform.profile?.accountName || platform.connection?.accountLabel || '');
  const canSync = platform.hasOAuth && ['connected', 'active'].includes(badgeKey);
  const isSyncing = syncingId === platform.id;

  return (
    <Card className={`p-4 border ${ring} bg-[var(--color-bg-workspace)]`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={18} className="shrink-0 opacity-80" />
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{platform.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">{platform.connectMethod}</p>
          </div>
        </div>
        <Badge variant={badge.variant} className="text-[10px] shrink-0">
          {badge.label}
        </Badge>
      </div>

      {(platform.profile?.accountName || platform.connection?.accountLabel) && (
        <p className="text-xs text-slate-600 dark:text-slate-300 mb-2 truncate">
          {platform.profile?.accountName || platform.connection?.accountLabel}
        </p>
      )}

      {typeof platform.profile?.followers === 'number' && (
        <p className="text-[11px] text-slate-500 mb-2">
          {formatNumber(platform.profile.followers)} {platform.followerLabel || 'followers'}
        </p>
      )}

      {platform.health?.lastError && (
        <p className="text-[10px] text-rose-500 mb-2 line-clamp-2">{platform.health.lastError}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        {platform.hasOAuth && !isPreview && (
          <ConnectAccountButton
            provider={platform.id}
            artistId={artistId}
            variant="compact"
          />
        )}

        {canSync && !isPreview && (
          <button
            type="button"
            onClick={() => onSync(platform.id)}
            disabled={isSyncing}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Sync
          </button>
        )}
      </div>

      {(platform.connectMethod === 'manual' || platform.connectMethod === 'coming_soon') && (
        <div className="space-y-2 mt-3">
          <Input
            label={`${platform.name} handle / URL`}
            value={manualHandle}
            onChange={(e) => setManualHandle(e.target.value)}
            placeholder={platform.connectMethod === 'coming_soon' ? 'Coming soon' : '@handle or profile URL'}
            disabled={platform.connectMethod === 'coming_soon' || isPreview}
            className="text-xs font-mono"
          />
          {platform.connectMethod === 'manual' && !isPreview && (
            <Button
              size="sm"
              variant="secondary"
              disabled={savingId === platform.id || !manualHandle.trim()}
              onClick={() => onSaveManual(platform.id, manualHandle.trim())}
              className="w-full text-[11px]"
            >
              {savingId === platform.id ? <Loader2 size={12} className="animate-spin" /> : 'Save handle'}
            </Button>
          )}
          {platform.connectMethod === 'coming_soon' && (
            <p className="text-[10px] text-slate-500">OAuth and sync for this platform are not available yet.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function SyncDashboard({ items = [], loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
        <Loader2 size={14} className="animate-spin" />
        Loading sync status…
      </div>
    );
  }

  if (!items.length) {
    return <p className="text-xs text-slate-500 py-2">No connection sync data yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-widest text-slate-500">
          <tr>
            <th className="px-3 py-2 font-bold">Platform</th>
            <th className="px-3 py-2 font-bold">Last sync</th>
            <th className="px-3 py-2 font-bold">Status</th>
            <th className="px-3 py-2 font-bold">Last error</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.platform} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 font-medium">{row.name}</td>
              <td className="px-3 py-2 text-slate-500">
                {row.lastSync ? new Date(row.lastSync).toLocaleString() : '—'}
              </td>
              <td className="px-3 py-2">
                <Badge variant={STATUS_BADGE[row.status]?.variant || 'default'} className="text-[10px]">
                  {STATUS_BADGE[row.status]?.label || row.status}
                </Badge>
              </td>
              <td className="px-3 py-2 text-rose-500 truncate max-w-[200px]">{row.lastError || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Connection Hub — grouped platform grid with health badges, OAuth connect, per-platform sync.
 * Import into ArtistWorkspace Settings or `?tab=connections` when Phase 2 merges.
 */
export default function ConnectionsCenter({ artistId, isPreview = false }) {
  const { data: hub, isLoading: hubLoading } = useConnectionHub(artistId, !isPreview && !!artistId);
  const { data: health, isLoading: healthLoading } = useConnectionHealth(artistId, !isPreview && !!artistId);
  const syncMutation = useSyncPlatformConnection();
  const saveManualMutation = useSaveManualConnection();

  const grouped = useMemo(() => {
    const categories = hub?.categories || [];
    const map = Object.fromEntries(categories.map((c) => [c.id, []]));
    (hub?.platforms || []).forEach((p) => {
      if (!map[p.category]) map[p.category] = [];
      map[p.category].push(p);
    });
    return { categories, map };
  }, [hub]);

  const handleSync = (platform) => {
    if (!artistId) return;
    syncMutation.mutate({ artistId, platform });
  };

  const handleSaveManual = (platform, accountName) => {
    if (!artistId) return;
    saveManualMutation.mutate({ artistId, platform, accountName });
  };

  if (hubLoading && !isPreview) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
        <Loader2 size={16} className="animate-spin" />
        Loading connections…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Globe size={16} className="text-slate-500" />
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
          Connection Hub
        </h3>
      </div>

      {grouped.categories.map((category) => {
        const platforms = grouped.map[category.id] || [];
        if (!platforms.length) return null;

        return (
          <section key={category.id}>
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
              {category.label}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {platforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  artistId={artistId}
                  isPreview={isPreview}
                  onSync={handleSync}
                  syncingId={syncMutation.isPending ? syncMutation.variables?.platform : null}
                  onSaveManual={handleSaveManual}
                  savingId={saveManualMutation.isPending ? saveManualMutation.variables?.platform : null}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-slate-500" />
          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            Sync dashboard
          </h4>
        </div>
        <SyncDashboard items={health?.items || []} loading={healthLoading} />
      </section>
    </div>
  );
}
