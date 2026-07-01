import React from 'react';
import ChartSurface from '../ui/ChartSurface';
import {
  BklitBreakdownBars,
  BklitCategoryBarChart,
  ChartEmptyState,
} from '../charts/bklitInsightsCharts';

const EmptyChart = ({ message }) => (
  <ChartEmptyState height={200} label={message} />
);

export const TaskStatusPie = ({ byStatus }) => {
  const data = [
    { name: 'Done', value: byStatus?.done || 0 },
    { name: 'In Progress', value: byStatus?.inProgress || 0 },
    { name: 'Todo', value: byStatus?.todo || 0 },
    { name: 'In Review', value: byStatus?.inReview || 0 },
  ].filter((d) => d.value > 0);

  return (
    <ChartSurface title="Task Status" height={200}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <BklitBreakdownBars emptyLabel="No tasks in range" height={200} items={data} />
      )}
    </ChartSurface>
  );
};

export const HoursMixPie = ({ hoursMix = [] }) => (
  <ChartSurface title="Hours Mix" height={200}>
    {hoursMix.length === 0 ? (
      <EmptyChart message="No hours logged" />
    ) : (
      <BklitBreakdownBars emptyLabel="No hours logged" height={200} items={hoursMix} nameKey="name" valueKey="value" />
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
    <ChartSurface title="Tasks by Priority" height={200}>
      {data.length === 0 ? (
        <EmptyChart message="No tasks in range" />
      ) : (
        <BklitCategoryBarChart
          emptyLabel="No tasks in range"
          fill="#f59e0b"
          height={200}
          labelKey="label"
          series={data}
          valueKey="value"
        />
      )}
    </ChartSurface>
  );
};
