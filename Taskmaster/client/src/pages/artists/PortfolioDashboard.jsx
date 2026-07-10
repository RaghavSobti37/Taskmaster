import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, Radio, BarChart3, ChevronLeft, Headphones,
  IndianRupee, Calendar, AlertTriangle, Award,
} from 'lucide-react';
import { Card, Button, PageSkeleton, QueryErrorBanner, getQueryErrorMessage } from '../../components/ui';
import { formatNumber } from '../../config/integrations.config';
import { usePortfolioSummary } from '../../hooks/queries/artists';
import { formatInr } from './os/artistOsConstants';

function KpiCard({ label, value, icon: Icon, sub }) {
  return (
    <Card className="p-5 border border-[var(--color-bg-border)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
          <p className="text-2xl font-black mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Icon size={18} />
          </div>
        )}
      </div>
    </Card>
  );
}

function RankingTable({ title, rows, valueKey, formatValue }) {
  return (
    <Card className="p-4 border border-[var(--color-bg-border)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">No data yet</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((row, idx) => (
            <li key={row.artistId || idx} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-bold truncate">
                <span className="text-slate-400 mr-2">{idx + 1}.</span>
                {row.name}
              </span>
              <span className="font-black tabular-nums shrink-0">
                {formatValue(row[valueKey] ?? 0)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

const ALERT_STYLES = {
  warning: 'border-amber-500/30 bg-amber-500/5',
  info: 'border-blue-500/30 bg-blue-500/5',
};

export default function PortfolioDashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = usePortfolioSummary();

  if (isLoading) return <PageSkeleton rows={4} />;

  if (isError) {
    return (
      <QueryErrorBanner
        message={getQueryErrorMessage(error)}
        onRetry={refetch}
      />
    );
  }

  const summary = data || {};
  const rankings = summary.rankings || {};
  const alerts = summary.alerts || [];
  const top = summary.topPerformer;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/management?tab=artists')}>
            <ChevronLeft size={16} /> Back to Artists
          </Button>
          <h1 className="text-2xl font-black mt-2">Artist Portfolio</h1>
          <p className="text-sm text-slate-500">Aggregate reach, revenue, and growth across your roster.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Artists" value={formatNumber(summary.totalArtists ?? 0)} icon={Users} />
        <KpiCard label="Total Reach" value={formatNumber(summary.totalReach ?? 0)} icon={Radio} />
        <KpiCard label="Total Followers" value={formatNumber(summary.totalFollowers ?? 0)} icon={BarChart3} />
        <KpiCard
          label="Total Streams"
          value={summary.totalStreams ? formatNumber(summary.totalStreams) : '—'}
          icon={Headphones}
          sub="Spotify when available"
        />
        <KpiCard
          label="Monthly Growth"
          value={summary.monthlyGrowth != null ? `${summary.monthlyGrowth}%` : '—'}
          icon={TrendingUp}
          sub="Avg across roster"
        />
        <KpiCard
          label="Revenue MTD"
          value={formatInr(summary.totalRevenueMtd ?? 0)}
          icon={IndianRupee}
        />
        <KpiCard
          label="Total Bookings"
          value={formatNumber(summary.totalBookings ?? 0)}
          icon={Calendar}
          sub="Inquiries + gigs"
        />
      </div>

      {top?.name && (
        <Card className="p-5 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <Award size={20} className="text-emerald-600" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Top growth</p>
              <p className="text-lg font-bold">{top.name}</p>
              <p className="text-xs text-slate-500">
                Growth {top.growth ?? 0}% · Reach {formatNumber(top.reach ?? 0)}
              </p>
            </div>
            {top.artistId && (
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => navigate(`/artists/${top.artistId}`)}
              >
                Open workspace
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <RankingTable
          title="Top Growth"
          rows={rankings.topGrowth || []}
          valueKey="growth"
          formatValue={(v) => `${v}%`}
        />
        <RankingTable
          title="Top Revenue"
          rows={rankings.topRevenue || []}
          valueKey="revenue"
          formatValue={(v) => formatInr(v)}
        />
        <RankingTable
          title="Top Engagement"
          rows={rankings.topEngagement || []}
          valueKey="engagement"
          formatValue={(v) => `${v}%`}
        />
      </div>

      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} /> Alerts
        </h2>
        {alerts.length === 0 ? (
          <Card className="p-5 text-sm text-slate-500 border border-[var(--color-bg-border)]">
            No roster alerts right now.
          </Card>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <Card
                key={`${alert.type}-${alert.artistId}`}
                className={`p-4 border flex items-center justify-between gap-3 flex-wrap ${ALERT_STYLES[alert.severity] || ALERT_STYLES.info}`}
              >
                <p className="text-sm font-medium">{alert.message}</p>
                {alert.artistId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/artists/${alert.artistId}`)}
                  >
                    View artist
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {!summary.totalArtists && (
        <Card className="p-8 text-center text-slate-500 text-sm">
          No artists on the roster yet. Add artists from Management to see portfolio metrics.
        </Card>
      )}
    </div>
  );
}
