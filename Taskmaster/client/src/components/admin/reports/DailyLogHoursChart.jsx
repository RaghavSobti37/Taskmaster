import { formatDisplayDate } from '../../../utils/dateDisplay';
import React, { useMemo } from 'react';
import { parseISO } from 'date-fns';
import { Badge } from '../../ui';
import { BklitAreaSeriesChart } from '../../charts/bklitInsightsCharts';

const LogTrendChart = ({ title, data, dataKey, stroke, badge, emptyLabel }) => (
  <section className="py-4 border-t border-[var(--color-bg-border)] h-full flex flex-col">
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
        {title}
      </p>
      {badge != null && (
        <Badge variant="info">{badge}</Badge>
      )}
    </div>
    <div className="flex-1 min-h-[200px]">
      <BklitAreaSeriesChart
        curve={undefined}
        dataKey={dataKey}
        emptyLabel={emptyLabel}
        fill={stroke}
        height={200}
        series={data}
        xKey="label"
      />
    </div>
  </section>
);

const DailyLogHoursChart = ({
  byDay = [],
  totalEntries = 0,
  onDaySelect,
  selectedDay,
  hideDayChips = false,
}) => {
  const chartData = useMemo(
    () => byDay.map((d) => ({
      ...d,
      count: d.count ?? d.logCount ?? 0,
      hours: Number(d.hours || 0),
      label: d.date?.slice(5) || d.date,
      dateLabel: d.date ? formatDisplayDate(parseISO(d.date)) : d.label,
    })),
    [byDay],
  );

  const totalLogs = totalEntries || chartData.reduce((s, d) => s + (d.count || 0), 0);
  const totalHours = chartData.reduce((s, d) => s + (d.hours || 0), 0);

  return (
    <div className="space-y-3">
    <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
      <LogTrendChart
        badge={`${totalHours.toFixed(1)}h total`}
        data={chartData}
        dataKey="hours"
        emptyLabel="No hours logged for this period"
        stroke="#6366f1"
        title="Daily Log Hours"
      />
      <LogTrendChart
        badge={`${totalLogs} logs`}
        data={chartData}
        dataKey="count"
        emptyLabel="No logs for this period"
        stroke="#f59e0b"
        title="Logs per Day"
      />
    </div>
    {onDaySelect && chartData.length > 0 && !hideDayChips && (
      <div className="flex flex-wrap gap-1.5">
        {chartData.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => onDaySelect(selectedDay === d.date ? null : d.date)}
            className={`px-2 py-0.5 rounded text-[10px] font-bold tabular-nums border transition-colors ${
              selectedDay === d.date
                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                : 'border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-blue-500/50'
            }`}
            title={`${d.dateLabel}: ${d.hours.toFixed(1)}h · ${d.count} logs`}
          >
            {d.label}
          </button>
        ))}
      </div>
    )}
    </div>
  );
};

export default DailyLogHoursChart;
