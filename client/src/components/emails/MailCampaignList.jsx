import { formatDisplayDate, formatDisplayDateTime, formatDisplayDateShort, formatDisplayDateTime12h, formatDisplayDateTime12hComma, formatWeekdayDate, formatWeekdayDateLong } from '../../utils/dateDisplay';
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { Mail, Play, Trash2 } from 'lucide-react';
import { Card, Button, Badge, DataTable, PageSkeleton } from '../ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../ui/QueryErrorBanner';
import {
  useMailCampaigns, useMailProfiles, useSendCampaign, useDeleteCampaign,
} from '../../hooks/useTaskmasterQueries';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useQueryClient } from '@tanstack/react-query';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

export default function MailCampaignList({ limit }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useConfirm();
  const toast = useToast();
  const queryClient = useQueryClient();
  const {
    data: campaigns = [],
    isLoading: campaignsLoading,
    isError: campaignsError,
    error: campaignsErr,
    refetch: refetchCampaigns,
  } = useMailCampaigns();
  const deferProfiles = useDeferredQueryEnabled(!campaignsLoading);
  const { isLoading: profilesLoading } = useMailProfiles(deferProfiles);
  const sendCampaignMutation = useSendCampaign();
  const deleteCampaignMutation = useDeleteCampaign();
  const [dispatchingId, setDispatchingId] = React.useState(null);

  const displayCampaigns = limit ? campaigns.slice(0, limit) : campaigns;

  const campaignColumns = [
    {
      header: 'Campaign',
      render: (row) => (
        <div>
          <span className="font-semibold text-sm tracking-tight">{row.title}</span>
          <span className="text-xs text-[var(--color-text-muted)] block">{row.subject}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      render: (row) => (
        <Badge
          variant={
            row.status === 'Completed' ? 'success'
              : row.status === 'Sending' ? 'warning'
                : row.status === 'Stopped' ? 'danger'
                  : 'info'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    {
      header: 'Recipients',
      render: (row) => {
        const total = row.recipientCount ?? row.stats?.total ?? 0;
        const sent = row.stats?.sent || 0;
        const isSending = row.status === 'Sending';
        const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
        return (
          <div className="space-y-1 text-xs font-medium min-w-[7rem]">
            <div className="flex items-center gap-4">
              <span>{total} target</span>
              <span className="text-[var(--color-pastel-mint-text)]">{sent} sent</span>
            </div>
            {isSending && total > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 rounded-full bg-[var(--color-bg-border)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-action-primary)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">{pct}%</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: 'Engagement',
      render: (row) => (
        <div className="text-xs text-[var(--color-text-muted)] tabular-nums">
          <span className="text-[var(--color-text-primary)]">{row.stats?.opened ?? 0}</span> opens
          <span className="mx-1">·</span>
          <span className="text-[var(--color-text-primary)]">{row.stats?.clicked ?? 0}</span> clicks
        </div>
      ),
    },
    {
      header: 'Created',
      render: (row) => (
        <div className="flex items-center justify-between gap-2 min-w-[10rem]">
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatDisplayDate(new Date(row.createdAt))}
          </span>
          {!limit && (
            <div
              className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {row.status === 'Draft' && (
                <Button
                  size="xs"
                  variant="primary"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const id = row.campaignId || row._id;
                    setDispatchingId(id);
                    try {
                      await sendCampaignMutation.mutateAsync(id);
                      toast.success('Campaign dispatch started.');
                      navigate(`/campaign/${id}`, { state: { from: location.pathname } });
                    } catch (err) {
                      toast.error(err.response?.data?.error || err.message || 'Dispatch failed.');
                    } finally {
                      setDispatchingId(null);
                    }
                  }}
                  disabled={dispatchingId === (row.campaignId || row._id)}
                >
                  <Play size={12} /> {dispatchingId === (row.campaignId || row._id) ? 'Dispatching…' : 'Dispatch'}
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                className="text-[var(--color-pastel-rose-text)] hover:bg-[var(--color-pastel-rose-bg)]"
                onClick={async (e) => {
                  e.stopPropagation();
                  const ok = await confirm({
                    title: 'Delete campaign?',
                    message: 'All associated metrics and tracking data will be permanently removed.',
                    confirmLabel: 'Delete',
                    type: 'danger',
                  });
                  if (!ok) return;
                  deleteCampaignMutation.mutate(row.campaignId || row._id, {
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: ['mail', 'campaigns'] });
                      toast.success('Campaign deleted');
                    },
                  });
                }}
                disabled={deleteCampaignMutation.isPending}
                title="Delete campaign"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];

  if (profilesLoading && campaignsLoading) return <PageSkeleton />;

  return (
    <Card className="p-0 overflow-hidden">
      {campaignsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(campaignsErr, 'Failed to load campaigns')}
          onRetry={() => refetchCampaigns()}
          className="m-3"
        />
      )}
      <DataTable
        columns={campaignColumns}
        data={displayCampaigns}
        onRowClick={(row) => navigate(`/campaign/${row.campaignId || row._id}`, { state: { from: location.pathname } })}
      />
      {displayCampaigns.length === 0 && (
        <div className="p-16 text-center opacity-40">
          <Mail size={48} className="mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest">No campaigns yet</p>
        </div>
      )}
    </Card>
  );
}
