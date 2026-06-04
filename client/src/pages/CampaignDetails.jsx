import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Mail, ArrowLeft, Users, CheckCircle2, Play, AlertCircle, Clock, Globe, Terminal, Zap, RefreshCw, Filter, X, Eye, Octagon } from 'lucide-react';
import { Card, Button, Badge, PageSkeleton, PageContainer, DataTable, EmptyState, DataOverviewSection, PageToolbar } from '../components/ui';
import { useCampaignDetails, useCampaignRecipients, useMailProfiles, useResendCampaign, useResendFilteredCampaign, useStopCampaign } from '../hooks/useTaskmasterQueries';
import { useToast } from '../contexts/ToastContext';
import { formatTimestampWithTz } from '../utils/displayLabels';
import { format } from 'date-fns';
import { eventCityLabel } from '../utils/mailEventLocation';

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending', match: ['Pending', 'Queued'] },
  { id: 'sent', label: 'Sent', match: ['Sent'] },
  { id: 'opened', label: 'Opened', match: ['Opened'] },
  { id: 'clicked', label: 'Clicked', match: ['Clicked'] },
  { id: 'unsubscribed', label: 'Unsubscribed', match: ['Unsubscribed'] },
  { id: 'bounced', label: 'Bounced', match: ['Bounced', 'Failed', 'Invalid'], title: 'Includes bounced, failed, and invalid addresses' },
  { id: 'cancelled', label: 'Cancelled', match: ['Cancelled'] },
];

const RESEND_STATUS_OPTIONS = [
  { id: 'Pending', label: 'Pending' },
  { id: 'Cancelled', label: 'Cancelled' },
  { id: 'Failed', label: 'Failed' },
  { id: 'Bounced', label: 'Bounced' },
  { id: 'Invalid', label: 'Invalid' },
];

export default function CampaignDetails() {
  const { campaignId: routeCampaignId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backToEmails = location.state?.from || '/emails';
  const { data: campaign, isLoading, error, refetch, dataUpdatedAt } = useCampaignDetails(routeCampaignId);
  const toast = useToast();
  const { data: profiles = [] } = useMailProfiles();
  const resendMutation = useResendCampaign();
  const resendFilteredMutation = useResendFilteredCampaign();
  const stopMutation = useStopCampaign();

  const [statusFilter, setStatusFilter] = useState('all');
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientPageSize, setRecipientPageSize] = useState(25);
  const [hideInvalidEmails, setHideInvalidEmails] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [showFilteredResendModal, setShowFilteredResendModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [resendSenderMode, setResendSenderMode] = useState('single');
  const [resendSenderProfileId, setResendSenderProfileId] = useState('');
  const [resendSenderProfileIds, setResendSenderProfileIds] = useState([]);
  const [resendTargetStatuses, setResendTargetStatuses] = useState(['Failed', 'Bounced', 'Pending', 'Invalid']);

  const campaignApiId = campaign?.campaignId || campaign?._id || routeCampaignId;

  const {
    data: recipientsData,
    isLoading: recipientsLoading,
    isFetching: recipientsFetching,
  } = useCampaignRecipients(campaignApiId, {
    page: recipientPage,
    limit: recipientPageSize,
    status: statusFilter,
    hideInvalid: hideInvalidEmails,
  });

  useEffect(() => {
    setRecipientPage(1);
  }, [statusFilter, hideInvalidEmails, recipientPageSize]);

  const paginatedRecipients = recipientsData?.recipients || [];
  const recipientPagination = recipientsData?.pagination || { page: 1, limit: recipientPageSize, total: 0, pages: 1 };
  const invalidEmailCount = recipientsData?.invalidCount ?? campaign?.invalidEmailCount ?? 0;

  const openResendModal = () => {
    setResendSenderMode(campaign?.senderMode || 'single');
    setResendSenderProfileId(campaign?.senderProfileId?._id || campaign?.senderProfileId || '');
    setResendSenderProfileIds(
      (campaign?.senderProfileIds || []).map((p) => p._id || p)
    );
    setShowResendModal(true);
  };

  const openFilteredResendModal = () => {
    setResendSenderMode(campaign?.senderMode || 'single');
    setResendSenderProfileId(campaign?.senderProfileId?._id || campaign?.senderProfileId || '');
    setResendSenderProfileIds(
      (campaign?.senderProfileIds || []).map((p) => p._id || p)
    );
    setShowFilteredResendModal(true);
  };

  const recipientStatusCounts = useMemo(() => {
    const counts = campaign?.recipientStatusCounts || {};
    const fallback = { Pending: 0, Queued: 0, Sent: 0, Opened: 0, Clicked: 0, Bounced: 0, Failed: 0, Invalid: 0, Unsubscribed: 0, Cancelled: 0 };
    return { ...fallback, ...counts };
  }, [campaign?.recipientStatusCounts]);

  const filterCounts = useMemo(() => {
    const total = campaign?.recipientCount ?? campaign?.stats?.total ?? 0;
    const map = { all: total };
    STATUS_FILTERS.forEach((f) => {
      if (f.id === 'all') return;
      map[f.id] = f.match.reduce((sum, st) => sum + (recipientStatusCounts[st] || 0), 0);
    });
    return map;
  }, [campaign?.recipientCount, campaign?.stats?.total, recipientStatusCounts]);

  const filteredRecipientTotal = recipientPagination.total ?? filterCounts[statusFilter] ?? 0;

  const activeFilterLabel = useMemo(() => {
    const def = STATUS_FILTERS.find((f) => f.id === statusFilter);
    return def?.label || 'All';
  }, [statusFilter]);

  const filteredResendTitle = useMemo(() => {
    if (!campaign?.title) return '';
    return `${campaign.title} [${activeFilterLabel}]`;
  }, [campaign?.title, activeFilterLabel]);

  const resendPreviewCount = useMemo(() => {
    return resendTargetStatuses.reduce((sum, st) => sum + (recipientStatusCounts[st] || 0), 0);
  }, [recipientStatusCounts, resendTargetStatuses]);

  const handleResend = async () => {
    if (resendPreviewCount === 0) {
      toast.warn('No recipients match the selected resend statuses.');
      return;
    }
    if (resendSenderMode === 'single' && !resendSenderProfileId) {
      toast.warn('Select a sender profile.');
      return;
    }
    if (resendSenderMode === 'pool' && resendSenderProfileIds.length === 0) {
      toast.warn('Select at least one profile for the SMTP pool.');
      return;
    }
    try {
      const payload = {
        id: campaignApiId,
        senderMode: resendSenderMode,
        senderProfileId: resendSenderMode === 'single' ? resendSenderProfileId : resendSenderProfileIds[0],
        senderProfileIds: resendSenderMode === 'pool' ? resendSenderProfileIds : [],
        ...(resendSenderMode === 'system_resend' ? { systemProvider: 'resend' } : {}),
        ...(resendSenderMode === 'system_smtp' ? { systemProvider: 'env_smtp' } : {}),
        targetStatuses: resendTargetStatuses,
        includeSignature: campaign.includeSignature !== false
      };
      const result = await resendMutation.mutateAsync(payload);
      setShowResendModal(false);
      await refetch();
      toast.success(`Resend queued: ${result.resetCount} recipient(s) reset, ${result.queuedCount ?? result.remainingToSend ?? 0} job(s) dispatched.`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const handleStopCampaign = async () => {
    try {
      const result = await stopMutation.mutateAsync(campaignApiId);
      setShowStopModal(false);
      await refetch();
      toast.success(`Campaign stopped. ${result.cancelledCount ?? 0} pending recipient(s) cancelled.`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const campaignStatusVariant = (status) => {
    if (status === 'Completed') return 'success';
    if (status === 'Sending' || status === 'Queued') return 'warning';
    if (status === 'Stopped') return 'danger';
    return 'info';
  };

  const isCampaignActive = campaign?.status === 'Sending' || campaign?.status === 'Queued';

  const handleFilteredResend = async () => {
    if (filteredRecipientTotal === 0) {
      toast.warn('No recipients in the current filter.');
      return;
    }
    if (statusFilter === 'all') {
      toast.warn('Select a status filter before resending.');
      return;
    }
    if (resendSenderMode === 'single' && !resendSenderProfileId) {
      toast.warn('Select a sender profile.');
      return;
    }
    if (resendSenderMode === 'pool' && resendSenderProfileIds.length === 0) {
      toast.warn('Select at least one profile for the SMTP pool.');
      return;
    }
    try {
      const payload = {
        id: campaignApiId,
        statusFilter,
        hideInvalid: hideInvalidEmails,
        filterLabel: activeFilterLabel,
        titleOverride: filteredResendTitle,
        senderMode: resendSenderMode,
        senderProfileId: resendSenderMode === 'single' ? resendSenderProfileId : resendSenderProfileIds[0],
        senderProfileIds: resendSenderMode === 'pool' ? resendSenderProfileIds : [],
        ...(resendSenderMode === 'system_resend' ? { systemProvider: 'resend' } : {}),
        ...(resendSenderMode === 'system_smtp' ? { systemProvider: 'env_smtp' } : {}),
        includeSignature: campaign.includeSignature !== false,
      };
      const result = await resendFilteredMutation.mutateAsync(payload);
      setShowFilteredResendModal(false);
      toast.success(`New campaign "${result.campaign?.title || filteredResendTitle}" queued: ${result.queuedCount ?? filteredRecipientTotal} recipient(s). Original campaign unchanged.`);
      const nextId = result.campaignId || result.campaign?.campaignId || result.campaign?._id || result.campaignMongoId;
      if (nextId) {
        navigate(`/campaign/${nextId}`);
      } else {
        await refetch();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (error || !campaign) {
    return (
      <PageContainer className="!py-12 text-center font-mono">
        <AlertCircle size={48} className="mx-auto text-rose-500 mb-4" />
        <h2 className="text-base font-black uppercase tracking-widest mb-2">Campaign Data Not Found</h2>
        <p className="text-xs text-[var(--color-text-muted)] mb-6">{error?.message || 'The requested campaign identifier does not exist.'}</p>
        <Button onClick={() => navigate(backToEmails)}>Return to Email Campaigns</Button>
      </PageContainer>
    );
  }

  const chartData = (campaign.timeSeries || []).map(pt => ({
    timeStr: pt.time ? format(new Date(pt.time), 'HH:mm') : '',
    opens: pt.opens || 0,
    clicks: pt.clicks || 0
  }));
  const hasChartData = chartData.length > 0 && chartData.some((pt) => pt.opens > 0 || pt.clicks > 0);

  const locationData = Object.entries(campaign.locationBreakdown || {})
    .map(([city, stats]) => ({
      city,
      opens: stats?.opens || 0,
      clicks: stats?.clicks || 0,
    }))
    .filter((r) => r.opens > 0 || r.clicks > 0)
    .sort((a, b) => (b.opens + b.clicks) - (a.opens + a.clicks));

  const totalRecipients = campaign?.recipientCount ?? campaign?.stats?.total ?? 0;
  const deliveredCount =
    (recipientStatusCounts.Sent || 0) + (recipientStatusCounts.Opened || 0) + (recipientStatusCounts.Clicked || 0);
  const failedCount =
    (recipientStatusCounts.Failed || 0) + (recipientStatusCounts.Bounced || 0) + (recipientStatusCounts.Invalid || 0);
  const openedCount = (recipientStatusCounts.Opened || 0) + (recipientStatusCounts.Clicked || 0);
  const clickedCount = recipientStatusCounts.Clicked || 0;
  const openRate = deliveredCount ? Math.round((openedCount / deliveredCount) * 100) : 0;
  const clickRate = deliveredCount ? Math.round((clickedCount / deliveredCount) * 100) : 0;
  const pendingCount = (recipientStatusCounts.Pending || 0) + (recipientStatusCounts.Queued || 0);
  const resendableCount = (recipientStatusCounts.Failed || 0) + (recipientStatusCounts.Bounced || 0)
    + (recipientStatusCounts.Pending || 0) + (recipientStatusCounts.Invalid || 0)
    + (recipientStatusCounts.Cancelled || 0);

  const currentSenderLabel = (() => {
    if (campaign.senderMode === 'system_resend') return 'System Resend (API)';
    if (campaign.senderMode === 'system_smtp') return 'System SMTP (env)';
    if (campaign.senderMode === 'pool') return `SMTP Pool (${(campaign.senderProfileIds || []).length} profiles)`;
    const sp = campaign.senderProfileId;
    if (sp && typeof sp === 'object') return `${sp.name} (${sp.email})`;
    const p = profiles.find((pr) => pr._id === sp);
    return p ? `${p.name} (${p.email})` : 'Single profile';
  })();

  return (
    <PageContainer className="!py-6 space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-3 min-w-0">
        <Button size="xs" variant="ghost" onClick={() => navigate(backToEmails)} className="flex items-center gap-2 shrink-0">
          <ArrowLeft size={14} /> Back to Email Campaigns
        </Button>
        <span className="text-sm font-black text-[var(--color-text-primary)] truncate">{campaign.title}</span>
        </div>
        <p className="text-[10px] font-bold text-[var(--color-text-muted)] truncate max-w-[40%] hidden sm:block">
          {currentSenderLabel} · {formatTimestampWithTz(campaign.createdAt, 'MMM dd, yyyy')}
        </p>
      </div>

      <DataOverviewSection
        mobileCollapsed
        mobileMaxStats={2}
        stats={[
          { id: 'recipients', label: 'Total Recipients', value: totalRecipients, icon: Users, variant: 'info' },
          { id: 'delivered', label: 'Sent Successfully', value: deliveredCount, icon: CheckCircle2, variant: 'mint' },
          { id: 'failed', label: 'Failed / Bounced', value: failedCount, icon: AlertCircle, variant: 'rose' },
          { id: 'pending', label: 'Pending / Queued', value: pendingCount, icon: Clock, variant: 'slate' },
          {
            id: 'openRate',
            label: 'Engagement rate',
            value: `${openRate}%`,
            subValue: `${openedCount} opened or clicked`,
            icon: Clock,
            variant: 'apricot',
            info: 'Percentage of delivered emails where the recipient opened or clicked. Denominator is successfully sent emails, not total list size.',
          },
          {
            id: 'clickRate',
            label: 'Click rate',
            value: `${clickRate}%`,
            subValue: `${clickedCount} clicks`,
            icon: Play,
            variant: 'slate',
            info: 'Percentage of delivered emails with at least one link click.',
          },
        ]}
        charts={
          locationData.length
            ? [{
                id: 'geo',
                title: 'Engagement by city',
                type: 'bar',
                data: locationData.slice(0, 8).map((d) => ({
                  label: d.city || 'Unknown',
                  value: (d.opens || 0) + (d.clicks || 0),
                })),
              }]
            : []
        }
      />

      <PageToolbar
        actions={(
          <>
            <Button size="xs" variant="secondary" onClick={() => refetch()} className="flex items-center gap-1">
              <RefreshCw size={12} /> Refresh
            </Button>
            {isCampaignActive && (
              <Button size="xs" variant="danger" onClick={() => setShowStopModal(true)} className="flex items-center gap-1" title="Halt pending sends — already-delivered emails are preserved">
                <Octagon size={12} /> Stop Campaign
              </Button>
            )}
            <Button size="xs" variant="primary" onClick={openResendModal} className="flex items-center gap-1" disabled={resendableCount === 0} title="Retry failed/bounced/pending recipients on this campaign">
              <RefreshCw size={12} /> Resend Campaign
            </Button>
            <Badge variant={campaignStatusVariant(campaign.status)}>
              {campaign.status}
            </Badge>
          </>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Clock size={14} /> Engagement Over Time
          </h3>
          <div className="h-64 w-full">
            {hasChartData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="timeStr" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }}
                  formatter={(value, name) => [String(value), name]}
                />
                <Line type="monotone" dataKey="opens" stroke="#38bdf8" strokeWidth={3} dot={{ r: 4, fill: '#38bdf8' }} name="Opens" />
                <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
            ) : (
              <EmptyState variant="subtle" title="No engagement yet" description="Opens and clicks will appear here once recipients interact with this campaign." className="h-full flex flex-col justify-center" />
            )}
          </div>
        </Card>

        <Card className="p-6 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Globe size={14} /> Location Breakdown
          </h3>
          <div className="h-64 w-full">
            {locationData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[var(--color-text-muted)] italic border border-dashed border-[var(--color-bg-border)] rounded-xl px-4 text-center">
                No location data yet — open or click from a real device to populate city geo.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={locationData} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                  <YAxis dataKey="city" type="category" stroke="#94a3b8" fontSize={10} width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', fontFamily: 'monospace' }}
                  formatter={(value, name) => [String(value), name]}
                />
                  <Bar dataKey="opens" fill="#38bdf8" radius={[0, 6, 6, 0]} name="Opens" />
                  <Bar dataKey="clicks" fill="#10b981" radius={[0, 6, 6, 0]} name="Clicks" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-[#0B0F19] border border-blue-500/30 rounded-[var(--radius-atomic)] space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
        <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-2 select-none">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
            </div>
            <Terminal size={16} className="text-blue-400" />
            <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 font-mono">Recent Activity</h3>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
            Last updated {dataUpdatedAt ? formatTimestampWithTz(dataUpdatedAt) : '—'}
          </div>
        </div>
        <div className="bg-black/60 rounded-xl p-4 font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-2.5 border border-white/5 custom-scrollbar select-text">
          <div className="text-slate-500 text-[10px] pb-1 border-b border-white/5">
            Campaign events — refresh to update
          </div>
          {(!campaign.events || campaign.events.length === 0) ? (
            <div className="text-slate-400 italic py-4 flex items-center gap-2">
              <Zap size={14} className="text-amber-400" /> No activity recorded yet for this campaign.
            </div>
          ) : (
            campaign.events.map((evt, idx) => (
              <div key={idx} className="flex flex-col lg:flex-row lg:items-start gap-1 lg:gap-3 hover:bg-white/5 p-2 rounded transition-colors font-mono min-w-0">
                <span className="text-slate-500 text-[10px] shrink-0">
                  {evt.timestamp ? formatTimestampWithTz(evt.timestamp) : '—'}
                </span>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                  evt.eventType === 'Open' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                  evt.eventType === 'Click' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                  evt.eventType === 'Send' || evt.eventType === 'Delivery' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                  evt.eventType === 'Failed' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                  evt.eventType === 'Skipped' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                }`}>
                  [{evt.eventType}]
                </span>
                <span className="text-slate-200 font-semibold break-all">{evt.email}</span>
                <span className="text-slate-400 text-[11px]">
                  {evt.metadata?.error
                    ? `→ ${evt.metadata.error}`
                    : evt.metadata?.reason
                      ? `→ ${evt.metadata.reason}`
                      : (evt.linkClicked || evt.metadata?.url)
                        ? `→ ${evt.linkClicked || evt.metadata?.url}`
                        : evt.eventType === 'Click'
                          ? '• Clicked link'
                          : evt.eventType === 'Open'
                            ? '• Opened email'
                            : evt.eventType === 'Failed'
                              ? '• Delivery failed'
                              : evt.eventType === 'Skipped'
                                ? '• Skipped'
                              : evt.eventType === 'Send' || evt.eventType === 'Delivery'
                                ? '• Email sent'
                                : '• Event'}
                  {eventCityLabel(evt) && (
                    <span
                      className={`ml-1 ${
                        evt.locationTrust === 'verified'
                          ? 'text-emerald-400/90'
                          : evt.locationTrust === 'inferred'
                            ? 'text-sky-400/80'
                            : 'text-slate-500 italic'
                      }`}
                      title={
                        evt.locationTrust === 'verified'
                          ? 'City from click (verified)'
                          : evt.locationTrust === 'inferred'
                            ? 'City inferred from recipient click'
                            : evt.locationTrust === 'proxy'
                              ? 'Open via mail proxy — not shown on geo map'
                              : ''
                      }
                    >
                      @ {eventCityLabel(evt)}
                      {evt.locationTrust === 'proxy' && ' (proxy)'}
                    </span>
                  )}
                </span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
            <Users size={14} /> Target Recipient Delivery Log
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="info">{filteredRecipientTotal} shown</Badge>
            <Badge variant="slate">{totalRecipients} total</Badge>
            {invalidEmailCount > 0 && (
              <Badge variant="rose">{invalidEmailCount} invalid email{invalidEmailCount === 1 ? '' : 's'}</Badge>
            )}
            <Button
              size="xs"
              variant="primary"
              onClick={openFilteredResendModal}
              disabled={filteredRecipientTotal === 0 || statusFilter === 'all'}
              className="flex items-center gap-1"
              title={statusFilter === 'all' ? 'Select a status filter first' : `Create a new campaign from the ${activeFilterLabel} filter`}
            >
              <RefreshCw size={12} /> New campaign [{activeFilterLabel}] ({filteredRecipientTotal})
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Filter size={12} className="text-[var(--color-text-muted)]" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              title={f.title || undefined}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                statusFilter === f.id
                  ? 'bg-[var(--color-action-primary)]/15 border-[var(--color-action-primary)]/40 text-[var(--color-action-primary)]'
                  : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-[var(--color-action-primary)]/30'
              }`}
            >
              {f.label} ({filterCounts[f.id] ?? 0})
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={hideInvalidEmails}
              onChange={(e) => setHideInvalidEmails(e.target.checked)}
              className="rounded border-[var(--color-bg-border)]"
            />
            Hide malformed addresses (not RFC-valid)
          </label>
        </div>

        <DataTable
          className="font-mono"
          columns={[
            {
              header: 'Recipient',
              render: (r) => (
                <span className={`font-semibold ${r.invalidEmail ? 'opacity-80' : ''}`}>
                  <span className={r.invalidEmail ? 'text-rose-400 line-through decoration-rose-400/50' : ''}>{r.email}</span>
                  {r.invalidEmail && <Badge variant="rose" className="ml-2 text-[9px]">Bad email</Badge>}
                </span>
              ),
            },
            {
              header: 'Delivery Status',
              render: (r) => {
                const displayStatus = r.displayStatus || r.status || 'Pending';
                return (
                  <Badge variant={displayStatus === 'Opened' ? 'mint' : displayStatus === 'Clicked' ? 'success' : displayStatus === 'Sent' ? 'info' : displayStatus === 'Bounced' || displayStatus === 'Failed' || displayStatus === 'Invalid' ? 'rose' : 'slate'}>
                    {displayStatus}
                  </Badge>
                );
              },
            },
            {
              header: 'Timestamp',
              render: (r) => (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  {r.sentAt ? formatTimestampWithTz(r.sentAt, 'MMM dd, HH:mm:ss') : '—'}
                </span>
              ),
            },
            {
              header: 'Notes',
              render: (r) => (
                <span className="text-[11px] text-[var(--color-text-muted)] truncate max-w-xs block">
                  {r.invalidEmail ? (r.error || 'Invalid email address') : (r.error || r.messageId || 'Ready for tracking')}
                </span>
              ),
            },
          ]}
          data={paginatedRecipients}
          getRowId={(r) => r._id || r.email}
          serverSide
          paginated
          totalItems={recipientPagination.total}
          totalPages={recipientPagination.pages}
          currentPage={recipientPagination.page}
          onPageChange={setRecipientPage}
          pageSize={recipientPageSize}
          onPageSizeChange={(size) => {
            setRecipientPageSize(size);
            setRecipientPage(1);
          }}
          isLoading={recipientsLoading}
          emptyTitle="No recipients"
          emptyDescription="No recipients match this filter."
        />
        {recipientsFetching && !recipientsLoading && (
          <p className="px-4 py-2 text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-bg-border)]">
            Refreshing…
          </p>
        )}
      </Card>

      {showFilteredResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
                <Eye size={16} /> Create New Campaign from Filter
              </h3>
              <button type="button" onClick={() => setShowFilteredResendModal(false)} className="text-[var(--color-text-muted)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Creates a <strong className="text-white">new campaign</strong> named <strong className="text-white">{filteredResendTitle}</strong> and sends only to the {filteredRecipientTotal} recipient(s) matching the <strong className="text-white">{activeFilterLabel}</strong> filter. The original campaign is unchanged.
            </p>

            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl text-xs space-y-1 font-mono">
              <div><span className="text-[var(--color-text-muted)]">Subject:</span> {campaign.subject || '—'}</div>
              <div><span className="text-[var(--color-text-muted)]">New campaign:</span> {filteredResendTitle}</div>
              <div className="text-[var(--color-action-primary)] font-bold">Recipients: {filteredRecipientTotal}</div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase flex items-center gap-1">
                <Eye size={12} /> Email Preview
              </label>
              <div className="border border-[var(--color-bg-border)] rounded-xl overflow-hidden bg-white h-64">
                <iframe
                  srcDoc={campaign.content || '<p style="font-family:sans-serif;padding:16px;color:#666;">No content</p>'}
                  title="Campaign preview"
                  className="w-full h-full border-0"
                  sandbox=""
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Sender Mode</label>
              <select
                value={resendSenderMode}
                onChange={(e) => setResendSenderMode(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
              >
                <option value="single">Single SMTP Profile</option>
                <option value="pool">Rotate SMTP Pool</option>
                <option value="system_resend">System Resend (API key)</option>
                <option value="system_smtp">System SMTP (env vars)</option>
              </select>
            </div>

            {resendSenderMode === 'single' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Sender Profile</label>
                <select
                  value={resendSenderProfileId}
                  onChange={(e) => setResendSenderProfileId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                >
                  <option value="">— Select profile —</option>
                  {profiles.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.email}) — {p.usage?.used ?? 0}/{p.usage?.limit ?? 500} today
                    </option>
                  ))}
                </select>
              </div>
            )}

            {resendSenderMode === 'pool' && (
              <div className="space-y-2 max-h-32 overflow-y-auto p-3 bg-[var(--color-bg-secondary)] rounded-xl">
                {profiles.map((p) => {
                  const checked = resendSenderProfileIds.includes(p._id);
                  return (
                    <label key={p._id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setResendSenderProfileIds((prev) => checked ? prev.filter((id) => id !== p._id) : [...prev, p._id])}
                      />
                      <span className="flex-1">{p.name}</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowFilteredResendModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleFilteredResend} disabled={resendFilteredMutation.isPending || filteredRecipientTotal === 0}>
                <RefreshCw size={14} className={resendFilteredMutation.isPending ? 'animate-spin' : ''} />
                {resendFilteredMutation.isPending ? 'Creating…' : `Send ${filteredRecipientTotal} as "${activeFilterLabel}"`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-rose-500 flex items-center gap-2">
                <Octagon size={16} /> Stop Campaign
              </h3>
              <button type="button" onClick={() => setShowStopModal(false)} className="text-[var(--color-text-muted)] hover:text-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Stop this campaign immediately. {pendingCount} pending/queued recipient(s) will not be sent. Already-delivered emails and tracking data are preserved.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowStopModal(false)}>Keep Sending</Button>
              <Button variant="danger" className="flex-1" onClick={handleStopCampaign} disabled={stopMutation.isPending}>
                <Octagon size={14} />
                {stopMutation.isPending ? 'Stopping…' : 'Stop Now'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg p-6 space-y-4 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-action-primary)] flex items-center gap-2">
                <RefreshCw size={16} /> Retry Failed Recipients
              </h3>
              <button type="button" onClick={() => setShowResendModal(false)} className="text-[var(--color-text-muted)] hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              Resend on this same campaign to recipients matching selected statuses. Checking Pending, Failed, Bounced, or Invalid resends mail. Checking Sent does not re-email unless you explicitly include Sent. Opens and clicks on already-delivered emails are preserved.
            </p>

            <div className="p-3 bg-[var(--color-bg-secondary)] rounded-xl text-xs space-y-1 font-mono">
              <div><span className="text-[var(--color-text-muted)]">Current sender:</span> {currentSenderLabel}</div>
              <div><span className="text-[var(--color-text-muted)]">Resendable now:</span> {resendableCount} (failed/bounced/pending/invalid/cancelled)</div>
              <div className="text-[var(--color-action-primary)] font-bold">Will queue: {resendPreviewCount} recipient(s)</div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Sender Mode</label>
              <select
                value={resendSenderMode}
                onChange={(e) => setResendSenderMode(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
              >
                <option value="single">Single SMTP Profile</option>
                <option value="pool">Rotate SMTP Pool</option>
                <option value="system_resend">System Resend (API key)</option>
                <option value="system_smtp">System SMTP (env vars)</option>
              </select>
            </div>

            {resendSenderMode === 'single' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Sender Profile</label>
                <select
                  value={resendSenderProfileId}
                  onChange={(e) => setResendSenderProfileId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl text-sm outline-none"
                >
                  <option value="">— Select profile —</option>
                  {profiles.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.email}) — {p.usage?.used ?? 0}/{p.usage?.limit ?? 500} today
                    </option>
                  ))}
                </select>
                {resendSenderProfileId && (() => {
                  const sp = profiles.find((p) => p._id === resendSenderProfileId);
                  if (!sp?.usage) return null;
                  const remaining = Math.max(0, (sp.usage.limit || 500) - (sp.usage.used || 0));
                  return (
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      SMTP capacity remaining today: <strong className={remaining < resendPreviewCount ? 'text-amber-500' : 'text-emerald-500'}>{remaining}</strong> / {sp.usage.limit}
                      {remaining < resendPreviewCount && ' — may need pool mode or wait until tomorrow'}
                    </p>
                  );
                })()}
              </div>
            )}

            {resendSenderMode === 'pool' && (
              <div className="space-y-2 max-h-32 overflow-y-auto p-3 bg-[var(--color-bg-secondary)] rounded-xl">
                {profiles.map((p) => {
                  const checked = resendSenderProfileIds.includes(p._id);
                  const remaining = Math.max(0, (p.usage?.limit ?? 500) - (p.usage?.used ?? 0));
                  return (
                    <label key={p._id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setResendSenderProfileIds((prev) => checked ? prev.filter((id) => id !== p._id) : [...prev, p._id])}
                      />
                      <span className="flex-1">{p.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)]">{remaining} left today</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Resend to statuses</label>
              <div className="flex flex-wrap gap-2">
                {RESEND_STATUS_OPTIONS.map((opt) => (
                  <label key={opt.id} className="flex items-center gap-1.5 text-xs cursor-pointer px-2 py-1 rounded-lg border border-[var(--color-bg-border)]">
                    <input
                      type="checkbox"
                      checked={resendTargetStatuses.includes(opt.id)}
                      onChange={() => {
                        setResendTargetStatuses((prev) =>
                          prev.includes(opt.id) ? prev.filter((s) => s !== opt.id) : [...prev, opt.id]
                        );
                      }}
                    />
                    {opt.label} ({recipientStatusCounts[opt.id] || 0})
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowResendModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleResend} disabled={resendMutation.isPending || resendPreviewCount === 0}>
                <RefreshCw size={14} className={resendMutation.isPending ? 'animate-spin' : ''} />
                {resendMutation.isPending ? 'Queuing…' : `Resend ${resendPreviewCount}`}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}


// Performance Optimization: useCallback(eventHandler) memoization guard
