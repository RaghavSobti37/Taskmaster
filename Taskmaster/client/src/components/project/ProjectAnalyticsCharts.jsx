import React from 'react';
import ChartSurface from '../ui/ChartSurface';
import {
  BklitBreakdownBars,
  BklitCategoryBarChart,
  ChartEmptyState,
} from '../charts/bklitInsightsCharts';

const CHART_HEIGHT = 220;

const EmptyChart = ({ message }) => (
  <ChartEmptyState height={CHART_HEIGHT} label={message} />
);

const ChartPlot = ({ children }) => (
  <div className="h-full w-full min-h-0 overflow-hidden">{children}</div>
);

export const TaskStatusPie = ({ byStatus }) => {
  const data = [
    { name: 'Done', value: byStatus?.done || 0 },
    { name: 'In Progress', value: byStatus?.inProgress || 0 },
    { name: 'Todo', value: byStatus?.todo || 0 },
    { name: 'In Review', value: byStatus?.inReview || 0 },
  ].filter((d) => d.value > 0);

  return (
    <ChartSurface title="Task Status" height={CHART_HEIGHT}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <ChartPlot>
          <BklitBreakdownBars
            aspectRatio={false}
            emptyLabel="No tasks in range"
            height={CHART_HEIGHT}
            items={data}
          />
        </ChartPlot>
      )}
    </ChartSurface>
  );
};

export const HoursMixPie = ({ hoursMix = [] }) => (
  <ChartSurface title="Hours Mix" height={CHART_HEIGHT}>
    {hoursMix.length === 0 ? (
      <EmptyChart message="No hours logged" />
    ) : (
      <ChartPlot>
        <BklitBreakdownBars
          aspectRatio={false}
          emptyLabel="No hours logged"
          height={CHART_HEIGHT}
          items={hoursMix}
          nameKey="name"
          valueKey="value"
        />
      </ChartPlot>
    )}
  </ChartSurface>
);

export const PriorityBarChart = ({ byPriority }) => {
  const data = [
    { label: 'Critical', value: byPriority?.critical || 0 },
    { label: 'High', value: byPriority?.high || 0 },
    { label: 'Medium', value: byPriority?.medium || 0 },
    { label: 'Low', value: byPriority?.low || 0 },
  ].filter((d) => d.value > 0);

  return (
    <ChartSurface title="Tasks by Priority" height={CHART_HEIGHT}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <ChartPlot>
          <BklitCategoryBarChart
            aspectRatio={false}
            emptyLabel="No tasks in range"
            fill="#f59e0b"
            fillHeight
            height={CHART_HEIGHT}
            labelKey="label"
            series={data}
            valueKey="value"
          />
        </ChartPlot>
      )}
    </ChartSurface>
  );
};
