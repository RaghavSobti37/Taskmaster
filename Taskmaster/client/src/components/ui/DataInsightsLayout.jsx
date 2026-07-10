import React from 'react';
import MetricPanelGroup from './MetricPanelGroup';
import InsightsChartGrid from './InsightsChartGrid';

/**
 * UDIF insights page shell — header, KPI panels, chart grid, optional toolbar, detail workspace.
 */
export default function DataInsightsLayout({
  header,
  panels = [],
  panelColumns = 3,
  charts = [],
  chartColumns = 2,
  chartsEager = false,
  toolbar,
  children,
  className = '',
}) {
  const hasPanels = panels.length > 0;
  const hasCharts = charts.length > 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {header}

      {hasPanels && (
        <MetricPanelGroup panels={panels} columns={panelColumns} />
      )}

      {hasCharts && (
        <InsightsChartGrid
          charts={charts}
          columns={chartColumns}
          eager={chartsEager}
        />
      )}

      {toolbar}

      {children != null && (
        <div className="space-y-4 border-t border-[var(--color-bg-border)] pt-4">
          {children}
        </div>
      )}
    </div>
  );
}
