import React, { useMemo } from 'react';
import { formatDisplayDateShort } from '../../../utils/dateDisplay';
import { Link } from 'react-router-dom';
import {
  Users, Headphones, Calendar, IndianRupee, MessageSquare, TrendingUp,
  Music2, RefreshCw, Link2, Plus, ArrowRight, Activity, Disc,
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { Card, Badge, Button } from '../../../components/ui';
import { formatNumber } from '../../../config/integrations.config';
import {
  useArtistOsOverview,
  useArtistOsTimeline,
  useArtistOsGigs,
  useArtistOsInquiries,
  useArtistOsScores,
  useArtistOsCalendar,
  useArtistOsContent,
} from '../../../hooks/queries/artistOs';
import { useConnectionHub, useConnectionHealth, useSyncPlatformConnection } from '../../../hooks/queries/artists';
import { formatInr, INQUIRY_STATUSES, CALENDAR_EVENT_COLORS } from './artistOsConstants';
import ArtistConnectOnboarding from './ArtistConnectOnboarding';
import { hasArtistPermission } from '../../../utils/artistMemberPermissions';

const CORE_PLATFORMS = ['spotify', 'youtube', 'instagram'];

const PLATFORM_META = {
  spotify: { icon: FaSpotify, label: 'Spotify', colorClass: 'text-emerald-500', followerKey: 'followers', streamKey: 'streams' },
  youtube: { icon: FaYoutube, label: 'YouTube', colorClass: 'text-red-500', followerKey: 'subscribers' },
  instagram: { icon: FaInstagram, label: 'Instagram', colorClass: 'text-pink-500', followerKey: 'followers' },
};

const LINK_BTN =
  'rounded-[var(--radius-atomic)] font-semibold transition-all inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap px-3 py-1.5 text-xs';

const HEALTH_BADGE = {
  connected: { label: 'Connected', variant: 'success' },
  active: { label: 'Active', variant: 'success' },
  pending: { label: 'Pending', variant: 'warning' },
  expired: { label: 'Expired', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
  manual: { label: 'Manual', variant: 'default' },
  disconnected: { label: 'Not linked', variant: 'default' },
};

function KpiCard({ label, value, icon: Icon, variant = 'slate', sub }) {
  const variants = {
    slate: 'border-[var(--color-bg-border)]',
    mint: 'border-emerald-500/30 bg-emerald-500/5',
    rose: 'border-rose-500/30 bg-rose-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
  };
  return (
    <Card className={`p-4 rounded-xl border ${variants[variant] || variants.slate}`}>
      <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
        {Icon && <Icon size={14} />}
        <span className="tm-widget-label !text-[9px] !mb-0">{label}</span>
      </div>
      <p className="text-xl font-black text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{sub}</p>}
    </Card>
  );
}

function SectionCard({ title, icon: Icon, tabHref, children }) {
  return (
    <Card className="p-4 rounded-2xl space-y-3 h-full">
      <div className="flex items-center justify-between gap-2">
        <h3 className="tm-widget-label flex items-center gap-2 !mb-0">
          {Icon && <Icon size={14} />}
          {title}
        </h3>
        {tabHref && (
          <Link
            to={tabHref}
            className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-action-primary)] hover:underline inline-flex items-center gap-1 shrink-0"
          >
            View all <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </Card>
  );
}

function tabHref(tab) {
  return `?tab=${tab}`;
}

function connectionStatusFromProps(connections, platformId) {
  const conn = connections.find((c) => c.provider === platformId);
  if (!conn) return 'disconnected';
  if (conn.status === 'expired') return 'expired';
  if (conn.status === 'error') return 'error';
  if (conn.accountHandle || conn.status === 'active') return 'connected';
  return conn.status || 'disconnected';
}

function formatShortDate(d) {
  if (!d) return '—';
  return formatDisplayDateShort(d);
}

function inquiryStatusLabel(status) {
  return INQUIRY_STATUSES.find((s) => s.id === status)?.label || status || '—';
}

export default function ArtistOverviewPanel({
  artistId,
  artist,
  normalized,
  connections = [],
  isPreview = false,
  isWorkspace = false,
  membership = null,
  shareToken,
  onSync,
}) {
  const enabled = !!artistId && !isPreview;

  const { data: overview, isLoading, isError, error, refetch } = useArtistOsOverview(artistId, enabled);
  const { data: timeline = [] } = useArtistOsTimeline(artistId, enabled);
  const { data: gigs = [] } = useArtistOsGigs(artistId, enabled);
  const { data: inquiries = [] } = useArtistOsInquiries(artistId, enabled);
  const { data: scores } = useArtistOsScores(artistId, enabled);
  const { data: calendarEvents = [] } = useArtistOsCalendar(artistId, enabled);
  const { data: contentItems = [] } = useArtistOsContent(artistId, enabled);
  const { data: hub } = useConnectionHub(artistId, enabled);
  const { data: health } = useConnectionHealth(artistId, enabled);
  const syncMutation = useSyncPlatformConnection();

  const canFinance = !isWorkspace || hasArtistPermission(membership, 'finance');
  const canBooking = !isWorkspace || hasArtistPermission(membership, 'booking');
  const canCalendar = !isWorkspace || hasArtistPermission(membership, 'calendar');
  const canContent = !isWorkspace || hasArtistPermission(membership, 'content');
  const canSocials = !isWorkspace || hasArtistPermission(membership, 'socials');
  const canSync = !isPreview && canSocials;

  const analytics = overview?.analytics || artist?.analytics || {};
  const unified = overview?.normalized?.unified || normalized?.unified || {};
  const growthPct = scores?.growthPct ?? overview?.scores?.growthPct ?? unified.growth;

  const hasOverview = enabled && !!overview;
  const revenueMtd = overview?.revenueMtd ?? 0;
  const expensesMtd = overview?.expensesMtd ?? 0;
  const profitMtd = overview?.profitMtd ?? revenueMtd - expensesMtd;
  const fmtFinance = (n) => (hasOverview ? formatInr(n) : '—');

  const followers = unified.reach ?? null;
  const streams = analytics.spotify?.streams ?? analytics.spotify?.totalStreams ?? null;
  const growthScore = scores?.growthScore ?? overview?.scores?.growthScore ?? null;

  const pendingInquiries = useMemo(() => {
    if (enabled && inquiries.length) {
      return inquiries.filter((i) => ['new', 'contacted', 'negotiating', 'blocked'].includes(i.status)).length;
    }
    return overview?.pendingInquiries ?? null;
  }, [enabled, inquiries, overview]);

  const upcomingGigCount = useMemo(() => {
    const now = new Date();
    return gigs.filter((g) => g.gigDate && new Date(g.gigDate) >= now).length;
  }, [gigs]);

  const nextGig = useMemo(() => {
    const now = new Date();
    return [...gigs]
      .filter((g) => g.gigDate && new Date(g.gigDate) >= now)
      .sort((a, b) => new Date(a.gigDate) - new Date(b.gigDate))[0] || null;
  }, [gigs]);

  const latestInquiry = useMemo(() => {
    if (!inquiries.length) return null;
    return [...inquiries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [inquiries]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...calendarEvents]
      .filter((e) => e.startAt && new Date(e.startAt) >= now)
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 3);
  }, [calendarEvents]);

  const topReleases = useMemo(() => {
    return [...contentItems]
      .sort((a, b) => new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0))
      .slice(0, 3);
  }, [contentItems]);

  const platformRows = useMemo(() => {
    const hubPlatforms = (hub?.platforms || []).filter((p) => CORE_PLATFORMS.includes(p.id));
    const healthMap = Object.fromEntries((health?.items || []).map((h) => [h.platform, h]));

    return CORE_PLATFORMS.map((id) => {
      const meta = PLATFORM_META[id];
      const hubRow = hubPlatforms.find((p) => p.id === id);
      const healthRow = healthMap[id];
      const analyticsRow = analytics[id] || {};
      const status = isPreview
        ? connectionStatusFromProps(connections, id)
        : (hubRow?.hubStatus || hubRow?.health?.status || healthRow?.status || 'disconnected');
      const followersCount = hubRow?.profile?.followers
        ?? analyticsRow[meta.followerKey]
        ?? null;

      return {
        id,
        meta,
        status,
        followers: followersCount,
        lastSync: healthRow?.lastSync || hubRow?.health?.lastSyncAt,
        lastError: healthRow?.lastError || hubRow?.health?.lastError,
      };
    });
  }, [hub, health, analytics, connections, isPreview]);

  const bookingsTab = isWorkspace ? 'bookings' : 'inquiries';
  const releasesTab = isWorkspace ? 'releases' : 'content';
  const connectionsTab = isWorkspace ? 'connections' : null;

  const kpiItems = [
    { key: 'reach', show: true, label: 'Reach', value: followers != null ? formatNumber(followers) : '—', icon: Users, variant: 'info' },
    { key: 'streams', show: true, label: 'Streams', value: streams != null ? formatNumber(streams) : '—', icon: Headphones, variant: 'mint' },
    { key: 'growth', show: true, label: 'Growth Score', value: growthScore != null ? growthScore : '—', icon: TrendingUp, variant: 'mint', sub: growthPct != null && growthPct !== '—' ? `${Number(growthPct).toFixed(1)}% audience growth` : undefined },
    { key: 'pending', show: canBooking, label: 'Pending Inquiries', value: pendingInquiries ?? '—', icon: MessageSquare, variant: 'warning' },
    { key: 'gigs', show: canBooking, label: 'Upcoming Gigs', value: enabled ? (overview?.upcomingShows ?? upcomingGigCount) : '—', icon: Calendar, variant: 'info', sub: nextGig ? `${nextGig.name} · ${formatShortDate(nextGig.gigDate)}` : undefined },
    { key: 'revenue', show: canFinance, label: 'Revenue MTD', value: fmtFinance(revenueMtd), icon: IndianRupee, variant: 'mint' },
  ].filter((k) => k.show).slice(0, 6);

  const handlePlatformSync = (platformId) => {
    if (!artistId || isPreview) return;
    syncMutation.mutate({ artistId, platform: platformId });
  };

  return (
    <div className="space-y-4">
      {(isPreview || isWorkspace) && (
        <ArtistConnectOnboarding
          artistId={artist?._id || artistId}
          shareToken={shareToken}
          team={artist?.team}
          connections={connections}
          isPreview={isPreview}
          isWorkspace={isWorkspace}
        />
      )}

      {!isPreview && isError && (
        <Card className="p-3 border-rose-500/30 bg-rose-500/5 text-xs text-rose-600">
          Failed to load overview.{' '}
          <button type="button" className="underline font-bold" onClick={() => refetch?.()}>
            Retry
          </button>
        </Card>
      )}

      {isLoading && !isPreview ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={`grid gap-3 ${kpiItems.length >= 6 ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2 lg:grid-cols-3'}`}>
          {kpiItems.map((kpi) => (
            <KpiCard key={kpi.key} label={kpi.label} value={kpi.value} icon={kpi.icon} variant={kpi.variant} sub={kpi.sub} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(canSocials || isPreview) && (
          <SectionCard
            title="Platform Snapshot"
            icon={Music2}
            tabHref={connectionsTab ? tabHref(connectionsTab) : (isWorkspace ? tabHref('analytics') : tabHref('analytics'))}
          >
            <div className="space-y-2">
              {platformRows.map((row) => {
                const Icon = row.meta.icon;
                const badge = HEALTH_BADGE[row.status] || HEALTH_BADGE.disconnected;
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)]"
                  >
                    <Icon size={18} className={row.meta.colorClass} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold">{row.meta.label}</p>
                        <Badge variant={badge.variant} className="text-[9px]">{badge.label}</Badge>
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {row.followers != null ? `${formatNumber(row.followers)} followers` : 'No metrics yet'}
                        {row.lastSync && ` · synced ${formatShortDate(row.lastSync)}`}
                      </p>
                      {row.lastError && (
                        <p className="text-[10px] text-rose-500 truncate">{row.lastError}</p>
                      )}
                    </div>
                    {canSync && ['connected', 'active'].includes(row.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        disabled={syncMutation.isPending}
                        onClick={() => handlePlatformSync(row.id)}
                      >
                        <RefreshCw size={12} className={syncMutation.isPending && syncMutation.variables?.platform === row.id ? 'animate-spin' : ''} />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {canBooking && (
          <SectionCard title="Bookings" icon={Calendar} tabHref={tabHref(bookingsTab)}>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-muted)]">Pending inquiries</span>
                <span className="font-black text-[var(--color-text-primary)]">{pendingInquiries ?? '—'}</span>
              </div>
              {nextGig ? (
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-1">Next gig</p>
                  <p className="text-sm font-black">{nextGig.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {formatShortDate(nextGig.gigDate)}
                    {nextGig.location ? ` · ${nextGig.location}` : ''}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">No upcoming gigs scheduled.</p>
              )}
              {latestInquiry ? (
                <div className="flex items-center justify-between gap-2 text-xs border-t border-[var(--color-bg-border)] pt-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{latestInquiry.clientName}</p>
                    <p className="text-[var(--color-text-muted)]">{inquiryStatusLabel(latestInquiry.status)}</p>
                  </div>
                  <span className="shrink-0 font-bold">{formatInr(latestInquiry.expectedBudget)}</span>
                </div>
              ) : enabled && (
                <p className="text-xs text-[var(--color-text-muted)]">No inquiries yet.</p>
              )}
            </div>
          </SectionCard>
        )}

        {canFinance && (
          <SectionCard title="Finance MTD" icon={IndianRupee} tabHref={tabHref('finance')}>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-center">
                <p className="tm-widget-label !text-[8px]">Revenue</p>
                <p className="text-sm font-black">{fmtFinance(revenueMtd)}</p>
              </div>
              <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center">
                <p className="tm-widget-label !text-[8px]">Expenses</p>
                <p className="text-sm font-black">{fmtFinance(expensesMtd)}</p>
              </div>
              <div className="p-3 rounded-xl border border-[var(--color-bg-border)] text-center">
                <p className="tm-widget-label !text-[8px]">Profit</p>
                <p className="text-sm font-black">{fmtFinance(profitMtd)}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {canCalendar && (
          <SectionCard title="Upcoming Events" icon={Calendar} tabHref={tabHref('calendar')}>
            {upcomingEvents.length ? (
              <ul className="space-y-2">
                {upcomingEvents.map((ev) => {
                  const color = CALENDAR_EVENT_COLORS[ev.eventType] || CALENDAR_EVENT_COLORS.personal;
                  return (
                    <li key={ev._id} className="flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${color.bg}`} />
                      <span className="font-bold flex-1 truncate">{ev.title}</span>
                      <span className="text-[var(--color-text-muted)] shrink-0">{formatShortDate(ev.startAt)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">No upcoming calendar events.</p>
            )}
          </SectionCard>
        )}

        <SectionCard title="Recent Activity" icon={Activity} tabHref={isWorkspace ? null : tabHref('notes')}>
          {(enabled ? timeline : []).length ? (
            <ul className="space-y-2">
              {timeline.slice(0, 5).map((item) => (
                <li key={item._id} className="text-xs flex justify-between gap-2 border-b border-[var(--color-bg-border)] pb-2 last:border-0">
                  <span className="font-bold truncate">{item.label}</span>
                  <span className="text-[var(--color-text-muted)] shrink-0">{formatShortDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              {isPreview ? 'Activity appears after workspace is claimed.' : 'No recent activity logged.'}
            </p>
          )}
        </SectionCard>

        {canContent && (
          <SectionCard title="Top Releases" icon={Disc} tabHref={tabHref(releasesTab)}>
            {topReleases.length ? (
              <ul className="space-y-2">
                {topReleases.map((item) => (
                  <li key={item._id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{item.title}</p>
                      <p className="text-[var(--color-text-muted)] uppercase text-[10px]">{item.releaseType}</p>
                    </div>
                    <span className="text-[var(--color-text-muted)] shrink-0">{formatShortDate(item.releaseDate)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">No releases tracked yet.</p>
            )}
          </SectionCard>
        )}
      </div>

      {!isPreview && (
        <Card className="p-3 rounded-2xl flex flex-wrap items-center gap-2">
          <span className="tm-widget-label !mb-0 mr-2">Quick actions</span>
          {canSync && onSync && (
            <Button variant="secondary" size="sm" onClick={onSync}>
              <RefreshCw size={14} /> Sync all
            </Button>
          )}
          {canSocials && connectionsTab && (
            <Link
              to={tabHref(connectionsTab)}
              className={`${LINK_BTN} bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]`}
            >
              <Link2 size={14} /> Connect platforms
            </Link>
          )}
          {canBooking && (
            <Link
              to={tabHref(bookingsTab)}
              className={`${LINK_BTN} bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-bg-border)] hover:bg-[var(--color-bg-border)]`}
            >
              <Plus size={14} /> Add inquiry
            </Link>
          )}
          {canCalendar && (
            <Link
              to={tabHref('calendar')}
              className={`${LINK_BTN} bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]`}
            >
              Calendar
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}
