import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  BarChart3,
  IndianRupee,
  Layers,
  Phone,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  PageContainer,
  PageHeader,
  DataInsightsLayout,
  MetricPanelGroup,
  Accordion,
} from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import { useAuth } from '../../contexts/AuthContext';
import { hasPageAccess } from '../../utils/pagePermissions';
import { useCrmStats, useCrmStatsTrends } from '../../hooks/queries/crmStats';
import { FUNNEL_CHART_COLORS } from '../../components/ui/FunnelChart';

const LOOKBACK_OPTIONS = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
];

function progressBarClass(pct) {
  const value = Number(pct) || 0;
  if (value >= 75) return 'bg-[var(--color-brand-teal)]';
  if (value >= 40) return 'bg-amber-500';
  return 'bg-[var(--color-pastel-rose-text)]';
}

function progressStatusLabel(pct, hasTarget) {
  if (!hasTarget) return null;
  const value = Number(pct) || 0;
  if (value >= 75) return 'On track';
  if (value >= 40) return 'Behind pace';
  return 'At risk';
}

function pipelineMetricsFromRows(rows, segment) {
  return (rows || []).map(({ key, label, suffix }) => ({
    label,
    value:
      suffix && typeof segment?.[key] === 'number'
        ? `${segment[key]}${suffix}`
        : (segment?.[key] ?? 0),
  }));
}

function isPipelineSegmentEmpty(segment) {
  if (!segment) return true;
  return (
    (segment.totalLeads ?? 0) === 0
    && (segment.connected ?? 0) === 0
    && (segment.meaningful ?? 0) === 0
    && (segment.warmLeads ?? 0) === 0
    && (segment.converted ?? 0) === 0
  );
}

function repActivitySummary(dailyStats, lookbackDays) {
  const calls = dailyStats?.callsMade ?? 0;
  if (calls === 0) {
    return lookbackDays <= 1
      ? 'No calls logged today'
      : 'No calls logged in this period';
  }
  const parts = [`${calls} call${calls === 1 ? '' : 's'}`];
  const connected = dailyStats?.connected ?? 0;
  const converted = dailyStats?.converted ?? 0;
  if (connected > 0) parts.push(`${connected} connected`);
  if (converted > 0) parts.push(`${converted} converted`);
  return parts.join(' · ');
}

function buildFunnelStages(overview) {
  const all = overview?.all || {};
  const rows = [
    { label: 'Assigned', value: all.totalLeads ?? 0 },
    { label: 'Connected', value: all.connected ?? 0 },
    { label: 'Meaningful', value: all.meaningful ?? 0 },
    { label: 'Warm', value: all.warmLeads ?? 0 },
    { label: 'Converted', value: all.converted ?? 0 },
  ];
  return rows.map((row, index) => ({
    ...row,
    color: FUNNEL_CHART_COLORS[index % FUNNEL_CHART_COLORS.length],
  }));
}

function MonthBusinessCard({ segment }) {
  if (!segment) return null;
  const progress = segment.progressPct ?? 0;
  const hasTarget = (segment.targetLakhs || 0) > 0;
  const statusLabel = progressStatusLabel(progress, hasTarget);
  const barClass = hasTarget ? progressBarClass(progress) : 'bg-[var(--color-brand-teal)]';
  const isAtRisk = hasTarget && progress < 40;

  return (
    <div
      className={[
        'rounded-xl border bg-[var(--color-bg-secondary)] p-4 space-y-3',
        isAtRisk
          ? 'border-[var(--color-pastel-rose-text)]/40'
          : 'border-[var(--color-bg-border)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{segment.title}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{segment.projectName}</p>
        </div>
        {statusLabel && (
          <span
            className={[
              'text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0',
              progress >= 75
                ? 'bg-[var(--color-pastel-mint)]/20 text-[var(--color-pastel-mint-text)]'
                : progress >= 40
                  ? 'bg-amber-500/15 text-amber-600'
                  : 'bg-[var(--color-pastel-rose)]/20 text-[var(--color-pastel-rose-text)]',
            ].join(' ')}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3 text-center">
          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Leads closed</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{segment.leadsClosed ?? 0}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] p-3 text-center">
          <p className="text-[10px] uppercase text-[var(--color-text-muted)]">Value</p>
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{segment.valueLabel || '0 Lakhs'}</p>
        </div>
      </div>
      {hasTarget ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Target: {segment.targetLabel}</span>
            <span className={isAtRisk ? 'text-[var(--color-pastel-rose-text)] font-semibold' : ''}>
              {progress}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--color-bg-border)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barClass}`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          Monthly target not set — configure in TSC Academy / TSC Films project Goals.
        </p>
      )}
    </div>
  );
}

function RepSectionContent({ section, statRows, pipelineRows, activityTitle }) {
  const hasActivity = (section.dailyStats?.callsMade ?? 0) > 0
    || (section.dailyStats?.leadsTouched ?? 0) > 0;

  return (
    <div className="space-y-4">
      {section.error && (
        <p className="text-xs text-amber-400">{section.error}</p>
      )}
      {!hasActivity && !section.error && (
        <p className="text-xs text-[var(--color-text-muted)] italic">
          No rep activity recorded in the selected window.
        </p>
      )}
      <MetricPanelGroup
        columns={2}
        panels={[
          {
            id: 'activity',
            title: activityTitle,
            metrics: statRows.map(({ key, label, highlight, suffix }) => ({
              label,
              value:
                suffix && typeof section.dailyStats?.[key] === 'number'
                  ? `${section.dailyStats[key]}${suffix}`
                  : (section.dailyStats?.[key] ?? 0),
              tone: highlight ? 'mint' : 'default',
            })),
          },
          {
            id: 'pipeline',
            title: 'Assigned pipeline (current)',
            metrics: pipelineRows.map(({ key, label, suffix }) => ({
              label,
              value:
                suffix && typeof section.pipelineStats?.[key] === 'number'
                  ? `${section.pipelineStats[key]}${suffix}`
                  : (section.pipelineStats?.[key] ?? 0),
            })),
          },
        ]}
      />
    </div>
  );
}

export default function CrmStatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [lookbackDays, setLookbackDays] = useState(7);
  const { data, isLoading, error, refetch, isFetching } = useCrmStats({ days: lookbackDays });
  const {
    data: trends,
    isLoading: trendsLoading,
    refetch: refetchTrends,
    isFetching: trendsFetching,
  } = useCrmStatsTrends({ days: Math.max(7, lookbackDays) });

  const activityTitle = useMemo(() => {
    if (lookbackDays <= 1) return "Today's activity";
    return `Activity (last ${lookbackDays} days)`;
  }, [lookbackDays]);

  const overview = data?.platformOverview;
  const funnelStages = useMemo(() => buildFunnelStages(overview), [overview]);

  const insightPanels = useMemo(() => {
    if (!overview) return [];

    const rows = data?.pipelineRows || [];
    const artistEmpty = isPipelineSegmentEmpty(overview.artist);

    const panels = [
      {
        id: 'all-crm',
        icon: Layers,
        title: 'All CRM',
        metrics: pipelineMetricsFromRows(rows, overview.all),
      },
      {
        id: 'sales-crm',
        icon: Users,
        title: 'Sales CRM',
        metrics: pipelineMetricsFromRows(rows, overview.sales),
      },
    ];

    if (artistEmpty) {
      panels.push({
        id: 'artist-crm',
        icon: Phone,
        title: 'Artist CRM',
        colSpan: 3,
        className: 'opacity-75',
        children: (
          <p className="text-sm text-[var(--color-text-muted)] italic py-1">
            No artist CRM pipeline activity — all stages are empty.
          </p>
        ),
      });
    } else {
      panels.push({
        id: 'artist-crm',
        icon: Phone,
        title: 'Artist CRM',
        metrics: pipelineMetricsFromRows(rows, overview.artist),
      });
    }

    return panels;
  }, [data?.pipelineRows, overview]);

  const insightCharts = useMemo(() => {
    const activityData = trends?.activityChartData || [];
    const emptyActivityLabel = lookbackDays <= 1
      ? 'No rep activity recorded today'
      : `No rep activity recorded in the last ${lookbackDays} days`;

    return [
      {
        id: 'pipeline-funnel',
        title: 'Pipeline funnel',
        type: 'funnel',
        stages: funnelStages,
        layers: 3,
        loading: isLoading && !overview,
        height: 260,
        emptyLabel: 'No leads in pipeline yet',
        headerAction: (
          <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-pastel-mint-text)]">
            <BarChart3 size={12} />
            <span>All CRM</span>
          </div>
        ),
      },
      {
        id: 'crm-activity',
        title: 'Rep activity trend',
        type: 'line',
        data: activityData,
        dataKeys: [
          { key: 'calls', name: 'Calls', color: 'primary' },
          { key: 'connected', name: 'Connected', color: 'mint' },
          { key: 'converted', name: 'Converted', color: 'apricot' },
        ],
        xKey: 'date',
        loading: trendsLoading,
        emptyWhenAllZero: true,
        emptyLabel: emptyActivityLabel,
        headerAction: (
          <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-brand-teal)]">
            <TrendingUp size={12} />
            <span>Activity</span>
          </div>
        ),
      },
    ];
  }, [funnelStages, overview, isLoading, trends, trendsLoading, lookbackDays]);

  if (!authLoading && !hasPageAccess(user, 'admin_data')) {
    return <Navigate to="/admin/console" replace />;
  }

  return (
    <PageContainer className="!py-4 space-y-6">
      <DataInsightsLayout
        header={(
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <PageHeader
              title="CRM Stats"
              icon={BarChart3}
              backTo={ADMIN_CONSOLE_PATH}
              subtitle="Live pipeline, rep activity, and month-to-date business across sales and artist CRM."
            />
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex rounded-lg border border-[var(--color-bg-border)] overflow-hidden">
                {LOOKBACK_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setLookbackDays(opt.value)}
                    className={[
                      'px-3 py-1.5 text-xs font-medium transition-colors',
                      lookbackDays === opt.value
                        ? 'bg-[var(--color-brand-teal)] text-white'
                        : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--token-surface-2)]',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  refetch();
                  refetchTrends();
                }}
                disabled={isFetching || trendsFetching}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--token-surface-2)] disabled:opacity-50"
              >
                <RefreshCw size={14} className={isFetching || trendsFetching ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>
        )}
        panels={isLoading && !data ? [] : insightPanels}
        charts={insightCharts}
        chartsEager
      >
        {error && <QueryErrorBanner message={getQueryErrorMessage(error)} onRetry={() => refetch()} />}

        {isLoading && !data && (
          <p className="text-sm text-[var(--color-text-muted)]">Loading CRM stats…</p>
        )}

        {data && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--color-brand-teal)]/30 bg-[var(--color-bg-secondary)] p-4">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Phone size={16} className="text-[var(--color-brand-teal)]" />
                <span className="font-medium text-[var(--color-text-primary)]">{data.periodLabel}</span>
                <span className="text-[var(--color-text-muted)]">· rep activity window · IST</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IndianRupee size={16} className="text-[var(--color-brand-teal)]" />
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Business done in {data.monthlyBusiness?.monthLabel}
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <MonthBusinessCard segment={data.monthlyBusiness?.academy} />
                <MonthBusinessCard segment={data.monthlyBusiness?.films} />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Per-rep breakdown</h2>
              <Accordion
                items={(data.sections || []).map((section) => ({
                  title: `${section.title}${section.rep?.name ? ` · ${section.rep.name}` : ''}`,
                  subtitle: repActivitySummary(section.dailyStats, lookbackDays),
                  content: (
                    <RepSectionContent
                      section={section}
                      statRows={data.statRows}
                      pipelineRows={data.pipelineRows}
                      activityTitle={activityTitle}
                    />
                  ),
                }))}
              />
            </div>

            <p className="text-xs text-[var(--color-text-muted)] pb-4">
              Pipeline counts are live from leads. Activity counts come from CRM field changes in the selected window.
              Monthly targets: TSC Academy / TSC Films project Goals → CRM stats settings.
            </p>
          </div>
        )}
      </DataInsightsLayout>
    </PageContainer>
  );
}
