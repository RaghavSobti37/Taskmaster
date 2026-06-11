import React from 'react';
import {
  IndianRupee, TrendingUp, Calendar, MessageSquare, CheckCircle, Music2,
} from 'lucide-react';
import { FaSpotify, FaYoutube, FaInstagram } from 'react-icons/fa';
import { Card } from '../../../components/ui';
import { formatNumber } from '../../../config/integrations.config';
import ArtistOsQueryShell from './ArtistOsQueryShell';
import { useArtistOsOverview, useArtistOsTimeline } from '../../../hooks/queries/artistOs';
import { formatInr } from './artistOsConstants';
import ArtistConnectOnboarding from './ArtistConnectOnboarding';

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
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-xl font-black text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{sub}</p>}
    </Card>
  );
}

function PlatformStat({ icon: Icon, label, value, colorClass }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)]">
      <Icon size={18} className={colorClass} />
      <div>
        <p className="text-[9px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  );
}

export default function ArtistCommandCenter({
  artist,
  normalized,
  connections = [],
  isPreview,
  isWorkspace = false,
  shareToken,
  artistId,
}) {
  const { data: overview, isLoading, isError, error, refetch } = useArtistOsOverview(artistId, !!artistId && !isPreview);
  const { data: timeline = [] } = useArtistOsTimeline(artistId, !!artistId && !isPreview);

  const analytics = overview?.analytics || artist?.analytics || {};
  const unified = overview?.normalized || normalized?.unified || {};
  const growth = overview?.scores?.growthPct ?? unified.growth;

  const revenueMtd = overview?.revenueMtd ?? 0;
  const expensesMtd = overview?.expensesMtd ?? 0;
  const profitMtd = overview?.profitMtd ?? revenueMtd - expensesMtd;

  return (
    <ArtistOsQueryShell isLoading={isLoading} isError={isError} error={error} refetch={refetch} isPreview={isPreview}>
      <ArtistConnectOnboarding
        artistId={artist?._id}
        shareToken={shareToken}
        team={artist?.team}
        connections={connections}
        isPreview={isPreview}
        isWorkspace={isWorkspace}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Revenue MTD" value={formatInr(revenueMtd)} icon={IndianRupee} variant="mint" />
        <KpiCard label="Expenses MTD" value={formatInr(expensesMtd)} icon={IndianRupee} variant="rose" />
        <KpiCard label="Profit MTD" value={formatInr(profitMtd)} icon={TrendingUp} variant="mint" />
        <KpiCard label="Upcoming Shows" value={overview?.upcomingShows ?? 0} icon={Calendar} variant="info" />
        <KpiCard label="Pending Inquiries" value={overview?.pendingInquiries ?? 0} icon={MessageSquare} variant="warning" />
        <KpiCard label="Confirmed Shows" value={overview?.confirmedShows ?? 0} icon={CheckCircle} variant="mint" />
      </div>

      <Card className="p-4 rounded-2xl space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <Music2 size={14} /> Platform Snapshot
          {growth != null && growth !== '—' && (
            <span className="text-emerald-500 normal-case">Growth {Number(growth).toFixed(1)}%</span>
          )}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PlatformStat icon={FaSpotify} label="Spotify Followers" value={formatNumber(analytics.spotify?.followers)} colorClass="text-emerald-500" />
          <PlatformStat icon={FaInstagram} label="Instagram Followers" value={formatNumber(analytics.instagram?.followers)} colorClass="text-pink-500" />
          <PlatformStat icon={FaYoutube} label="YouTube Subscribers" value={formatNumber(analytics.youtube?.subscribers)} colorClass="text-red-500" />
        </div>
      </Card>

      {timeline.length > 0 && (
        <Card className="p-4 rounded-2xl">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-3">Recent Activity</h3>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {timeline.slice(0, 8).map((item) => (
              <li key={item._id} className="text-xs flex justify-between gap-2 border-b border-[var(--color-bg-border)] pb-2">
                <span className="font-bold">{item.label}</span>
                <span className="text-[var(--color-text-muted)] shrink-0">
                  {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </ArtistOsQueryShell>
  );
}
