import React, { useMemo } from 'react';
import { curveMonotoneX } from '@visx/curve';
import { Area, AreaChart } from './area-chart';
import { AreaChartLoading } from './area-chart-loading';
import { ChartTooltip } from './tooltip';
import { Grid } from './grid';
import { XAxis } from './x-axis';
import { BK_CHART_MARGIN, normalizeTimeSeriesRows } from './bklitAdapters';

const EXLY_CHART_MARGIN = { ...BK_CHART_MARGIN, left: 48 };

function ExlyTrendAreaChart({
  data,
  dataKey,
  name,
  fill,
  loading,
  aspectRatio = '4 / 1',
  emptyLabel = 'No data recorded',
}) {
  const series = useMemo(
    () => normalizeTimeSeriesRows(data, 'date'),
    [data],
  );
  const hasData = series.length > 0 && series.some((row) => Number(row[dataKey]) > 0);

  if (loading) {
    return (
      <AreaChartLoading
        aspectRatio={aspectRatio}
        gridShimmerSync
        label="Loading"
        margin={EXLY_CHART_MARGIN}
        stroke="var(--foreground)"
        strokeOpacity={0.5}
      />
    );
  }

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider"
        style={{ aspectRatio }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <AreaChart
      aspectRatio={aspectRatio}
      data={series}
      margin={EXLY_CHART_MARGIN}
      status="ready"
      xDataKey="date"
    >
      <Grid horizontal />
      <Area
        curve={curveMonotoneX}
        dataKey={dataKey}
        fill={fill}
        fillOpacity={dataKey === 'revenue' ? 0.3 : 0.22}
        stroke={fill}
        strokeWidth={dataKey === 'revenue' ? 2 : 1.5}
      />
      <XAxis tickMode="data" />
      <ChartTooltip />
    </AreaChart>
  );
}

export function ExlyRevenueTrendChart({ data, loading, aspectRatio, emptyLabel }) {
  return (
    <ExlyTrendAreaChart
      aspectRatio={aspectRatio}
      data={data}
      dataKey="revenue"
      emptyLabel={emptyLabel || 'No revenue stream data recorded'}
      fill="var(--color-pastel-mint-text)"
      loading={loading}
    />
  );
}

export function ExlyBookingsTrendChart({ data, loading, aspectRatio, emptyLabel }) {
  return (
    <ExlyTrendAreaChart
      aspectRatio={aspectRatio}
      data={data}
      dataKey="bookings"
      emptyLabel={emptyLabel || 'No transaction trend data recorded'}
      fill="var(--color-pastel-apricot-text)"
      loading={loading}
    />
  );
}

export default ExlyRevenueTrendChart;
