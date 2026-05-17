import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Mail, ArrowLeft, Users, CheckCircle2, Play, AlertCircle, Clock, Globe } from 'lucide-react';
import { Card, Button, Badge, StatCard, PageSkeleton, PageContainer, PageHeader } from '../components/ui';
import { useCampaignDetails } from '../hooks/useTaskmasterQueries';
import { format } from 'date-fns';

export default function CampaignDetails() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const { data: campaign, isLoading, error } = useCampaignDetails(campaignId);

  if (isLoading) return <PageSkeleton />;
  if (error || !campaign) {
    return (
      <PageContainer className="!py-12 text-center font-mono">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-base font-black uppercase tracking-widest mb-2">Campaign Data Not Found</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-6">{error?.message || 'The requested campaign identifier does not exist.'}</p>
        <Button onClick={() => navigate('/admin?tab=mail')}>Return to Campaigns</Button>
      </PageContainer>
    );
  }

  // Format time series data for Recharts
  const chartData = (campaign.timeSeries || []).map(pt => ({
    timeStr: pt.time ? format(new Date(pt.time), 'HH:mm') : '',
    opens: pt.opens || 0,
    clicks: pt.clicks || 0
  }));

  // Format location breakdown for Recharts
  const locationData = Object.entries(campaign.locationBreakdown || {}).map(([city, stats]) => ({
    city,
    opens: stats?.opens || 0,
    clicks: stats?.clicks || 0
  })).sort((a, b) => (b.opens + b.clicks) - (a.opens + a.clicks));

  const totalRecipients = campaign.recipients?.length || 0;
  const metrics = campaign.metrics || { totalSent: 0, opened: 0, clicked: 0, bounced: 0 };
  const openRate = totalRecipients ? Math.round((metrics.opened / totalRecipients) * 100) : 0;
  const clickRate = totalRecipients ? Math.round((metrics.clicked / totalRecipients) * 100) : 0;

  return (
    <PageContainer className="!py-6 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--color-bg-border)]">
        <Button size="xs" variant="ghost" onClick={() => navigate('/admin?tab=mail')} className="flex items-center gap-2">
          <ArrowLeft size={14} /> Back to Administration
        </Button>
        <Badge variant={campaign.status === 'Completed' ? 'success' : campaign.status === 'Sending' ? 'warning' : 'info'}>
          {campaign.status}
        </Badge>
      </div>

      <PageHeader 
        title={campaign.title} 
        subtitle={`System ID: ${campaign.campaignId || campaign._id} • Created: ${format(new Date(campaign.createdAt), 'MMM dd, yyyy')}`}
        icon={Mail}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Target Audience" value={totalRecipients} icon={Users} variant="info" />
        <StatCard label="Dispatched Success" value={metrics.totalSent || 0} icon={CheckCircle2} variant="mint" />
        <StatCard label="Unique Open Rate" value={`${openRate}%`} subValue={`${metrics.opened || 0} Opens`} icon={Clock} variant="apricot" />
        <StatCard label="Click-Through Rate" value={`${clickRate}%`} subValue={`${metrics.clicked || 0} Clicks`} icon={Play} variant="slate" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Clock size={14} /> Time Series Engagement Activity
          </h3>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[var(--color-text-muted)] font-mono italic">
              Awaiting real-time pixel delivery events...
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis dataKey="timeStr" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="opens" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} name="Opens" />
                  <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} name="Clicks" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Globe size={14} /> Geographic Location Breakdown
          </h3>
          {locationData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-[var(--color-text-muted)] font-mono italic">
              Awaiting geolocation edge signals...
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                  <YAxis dataKey="city" type="category" stroke="#94a3b8" fontSize={10} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }} />
                  <Bar dataKey="opens" fill="#38bdf8" radius={[0, 6, 6, 0]} name="Opens" />
                  <Bar dataKey="clicks" fill="#10b981" radius={[0, 6, 6, 0]} name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Users size={14} /> Target Recipient Delivery Log
          </h3>
          <Badge variant="info">{totalRecipients} Total Loaded</Badge>
        </div>

        <div className="border border-[var(--color-bg-border)] rounded-xl overflow-x-auto bg-[var(--color-bg-primary)] custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs font-mono whitespace-nowrap">
            <thead className="bg-[var(--color-bg-secondary)] border-b border-[var(--color-bg-border)]">
              <tr>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Recipient</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Delivery Status</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Timestamp</th>
                <th className="px-4 py-3 font-bold text-[var(--color-text-muted)] text-[10px] uppercase">Diagnostic Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-bg-border)]">
              {campaign.recipients?.map((r, idx) => (
                <tr key={idx} className="hover:bg-[var(--color-bg-secondary)]/50">
                  <td className="px-4 py-3 font-semibold">{r.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant={r.status === 'Opened' ? 'mint' : r.status === 'Clicked' ? 'success' : r.status === 'Sent' ? 'info' : r.status === 'Bounced' || r.status === 'Failed' ? 'rose' : 'slate'}>
                      {r.status || 'Pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)]">
                    {r.sentAt ? format(new Date(r.sentAt), 'MMM dd, HH:mm:ss') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-[var(--color-text-muted)] truncate max-w-xs">
                    {r.error || r.messageId || 'Ready for tracking'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
