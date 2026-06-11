import React, { useMemo } from 'react';
import {
  Users, Headphones, Calendar, IndianRupee, MessageSquare, TrendingUp,
} from 'lucide-react';
import { Card } from '../../../../components/ui';
import { formatNumber } from '../../../../config/integrations.config';
import ArtistOsQueryShell from '../../os/ArtistOsQueryShell';
import {
  useArtistOsOverview,
  useArtistOsGigs,
  useArtistOsScores,
} from '../../../../hooks/queries/artistOs';
import { formatInr } from '../../os/artistOsConstants';

function Widget({ label, value, icon: Icon, variant = 'slate' }) {
  const variants = {
    slate: 'border-[var(--color-bg-border)]',
    mint: 'border-emerald-500/30 bg-emerald-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
  };
  return (
    <Card className={`p-4 rounded-xl border ${variants[variant] || variants.slate}`}>
      <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
        {Icon && <Icon size={14} />}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-black text-[var(--color-text-primary)]">{value}</p>
    </Card>
  );
}

export default function ArtistWorkspaceHome({ artistId, normalized, isPreview }) {
  const enabled = !!artistId && !isPreview;
  const { data: overview, isLoading, isError, error, refetch } = useArtistOsOverview(artistId, enabled);
  const { data: gigs = [] } = useArtistOsGigs(artistId, enabled);
  const { data: scores } = useArtistOsScores(artistId, enabled);

  const upcoming30 = useMemo(() => {
    const now = new Date();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);
    return gigs.filter((g) => {
      if (!g.gigDate) return false;
      const d = new Date(g.gigDate);
      return d >= now && d <= limit;
    }).length;
  }, [gigs]);

  const unified = overview?.normalized?.unified || normalized?.unified || {};
  const analytics = overview?.analytics || {};
  const followers = unified.reach ?? null;
  const streams = analytics.spotify?.streams ?? analytics.spotify?.totalStreams ?? null;
  const growthScore = scores?.growthScore ?? overview?.scores?.growthScore ?? null;

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Widget
          label="Followers"
          value={followers != null ? formatNumber(followers) : '—'}
          icon={Users}
          variant="info"
        />
        <Widget
          label="Streams"
          value={streams != null ? formatNumber(streams) : '—'}
          icon={Headphones}
          variant="mint"
        />
        <Widget
          label="Upcoming Gigs (30d)"
          value={gigs.length ? upcoming30 : (overview?.upcomingShows ?? '—')}
          icon={Calendar}
          variant="info"
        />
        <Widget
          label="Revenue MTD"
          value={overview ? formatInr(overview.revenueMtd ?? 0) : '—'}
          icon={IndianRupee}
          variant="mint"
        />
        <Widget
          label="Pending Inquiries"
          value={overview?.pendingInquiries ?? '—'}
          icon={MessageSquare}
          variant="warning"
        />
        <Widget
          label="Growth Score"
          value={growthScore != null ? growthScore : '—'}
          icon={TrendingUp}
          variant="mint"
        />
      </div>
    </ArtistOsQueryShell>
  );
}
