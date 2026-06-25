import React from 'react';
import { BarChart2, Users } from 'lucide-react';
import { Card, Badge } from '../ui';
import RegisteredLocationBarChart from '../emails/RegisteredLocationBarChart';

export default function MailCumulativeAnalyticsPanel({ cumulativeAnalytics, onLocationSelect }) {
  const aggregateRows = cumulativeAnalytics?.aggregateData || [];
  const locationRows = cumulativeAnalytics?.dynamicBreakdown || [];

  const chartData = locationRows.map((row) => ({
    city: row.location,
    count: row.count || 0,
    opens: row.opens || 0,
    clicks: row.clicks || 0,
    total: row.total ?? ((row.opens || 0) + (row.clicks || 0)),
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <BarChart2 size={14} /> Cumulative Campaign Performance (By Event Tag)
        </h3>
        <div className="border border-[var(--color-bg-border)] rounded-xl overflow-x-auto bg-[var(--color-bg-secondary)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
            <thead className="bg-[var(--color-bg-primary)] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Event Tag</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Sent</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Opens</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Total Clicks</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Open rate (% of sent)</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">CTR (% of sent)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {aggregateRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-bg-primary)]/50">
                  <td className="px-4 py-3 font-bold text-[var(--color-action-primary)]">{row.eventTag}</td>
                  <td className="px-4 py-3">{row.totalSent}</td>
                  <td className="px-4 py-3">{row.totalOpens}</td>
                  <td className="px-4 py-3">{row.totalClicks}</td>
                  <td className="px-4 py-3"><Badge variant="mint">{row.openRate}%</Badge></td>
                  <td className="px-4 py-3"><Badge variant="info">{row.ctr}%</Badge></td>
                </tr>
              ))}
              {aggregateRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--color-text-muted)] italic font-mono">
                    No cumulative campaign analytics recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
          <Users size={14} /> Location breakdown (all campaigns)
        </h3>
        <p className="text-[10px] text-[var(--color-text-muted)]">
          Opens and clicks by real reader city (proxy/datacenter IPs excluded). Click a bar to view leads.
        </p>
        <RegisteredLocationBarChart
          variant="histogram"
          data={chartData}
          height={320}
          limit={16}
          onLocationClick={onLocationSelect}
          emptyMessage="No engaged lead demographics recorded yet."
        />
      </Card>
    </div>
  );
}
