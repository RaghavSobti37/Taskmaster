import React, { useState, useMemo, useRef } from 'react';
import { AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import { Card, TimeframeFilter } from '../ui';
import { COMPONENT_REGISTRY } from '../../lib/componentRegistry';
import { useDashboardTasks, useMailStats, useActivityGrid, useDashboardSummary } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';

export default function GenericDashboardCard({ componentId }) {
  const [timeframe, setTimeframe] = useState('7d');
  const { user } = useAuth();

  // Real Data Fetchers
  const { data: tasks = [] } = useDashboardTasks(user?._id);
  const { data: mailStats } = useMailStats(componentId === 'campaign-metrics');
  const { data: activityData } = useActivityGrid(componentId === 'team-activity');
  const { data: summaryData } = useDashboardSummary(componentId === 'dept-stats');

  const meta = COMPONENT_REGISTRY[componentId];

  const { chartData, type } = useMemo(() => {
    const days = timeframe === '1d' ? 1 : timeframe === '7d' ? 7 : 30;
    const now = new Date();

    if (componentId === 'campaign-metrics' && mailStats) {
      // Real campaign metrics
      return {
        type: 'bar',
        chartData: [
          { label: 'Sent', value: mailStats.totalSent || 0 },
          { label: 'Opens', value: mailStats.totalOpens || 0 },
          { label: 'Clicks', value: mailStats.totalClicks || 0 }
        ]
      };
    }

    if (componentId === 'team-activity' && activityData?.length) {
      // Real team activity (last N days)
      const recent = activityData.slice(0, days).reverse();
      return {
        type: 'area',
        chartData: recent.map(d => {
          const rawDate = d.date || d._id || d.label;
          let label = String(rawDate).slice(5) || 'Unknown';
          try {
            if (rawDate) label = format(parseISO(String(rawDate)), 'MMM dd');
          } catch (e) {
            // fallback gracefully
          }
          return { label, value: d.count || d.value || 0 };
        })
      };
    }

    if (componentId === 'dept-stats' && summaryData?.metrics) {
      return {
        type: 'bar',
        chartData: [
          { label: 'Tasks', value: summaryData.metrics.completionRate || 0 },
          { label: 'Leads', value: summaryData.metrics.totalLeads || 0 },
          { label: 'Focus', value: summaryData.metrics.focusHours || 0 }
        ]
      };
    }

    // Default fallback to tasks (real data)
    const dataMap = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(now, i);
      dataMap.set(format(d, 'MMM dd'), 0);
    }
    tasks.forEach(t => {
      const day = t.scheduleDate || t.dueDate || t.createdAt;
      if (!day) return;
      const fmt = format(new Date(day), 'MMM dd');
      if (dataMap.has(fmt)) {
        dataMap.set(fmt, dataMap.get(fmt) + 1);
      }
    });

    return { type: 'area', chartData: Array.from(dataMap.entries()).map(([label, value]) => ({ label, value })) };
  }, [tasks, timeframe, componentId, mailStats, activityData, summaryData]);

  const hasData = chartData.some(d => d.value > 0);

  return (
    <Card className="p-0 flex flex-col justify-between shadow-md overflow-hidden h-full">
      <div className="h-12 px-4 border-b border-[rgba(255,255,255,0.08)] bg-[var(--color-bg-secondary)] flex items-center justify-between w-full shrink-0">
        <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2 uppercase tracking-wider mb-0">
          <span className="text-[16px]">{meta?.icon || '📊'}</span> {meta?.label || componentId}
        </h4>
        <div className="flex items-center gap-2">
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>
      </div>

      <div className="flex-1 p-0 flex flex-col items-center justify-center relative" style={{ minHeight: 200, height: 200 }}>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center opacity-40 grayscale h-full w-full py-8">
            <div className="w-full max-w-[200px] space-y-2 mb-3">
              <div className="h-2 w-full bg-[var(--color-text-muted)] rounded-full animate-pulse"></div>
              <div className="h-2 w-3/4 bg-[var(--color-text-muted)] rounded-full mx-auto animate-pulse" style={{ animationDelay: '150ms' }}></div>
              <div className="h-2 w-1/2 bg-[var(--color-text-muted)] rounded-full mx-auto animate-pulse" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] italic">
              No data to display for the last {timeframe}
            </p>
          </div>
        ) : (
          <div className="w-full" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height={200}>
              {type === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-border)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                    cursor={{ fill: 'var(--color-bg-secondary)' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`colorValue-${componentId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} width={35} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--color-bg-surface)', border: '1px solid var(--color-bg-border)', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ color: 'var(--color-text-primary)' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill={`url(#colorValue-${componentId})`} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}
