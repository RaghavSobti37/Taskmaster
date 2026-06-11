import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Play, Mail, Eye, Plus, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import MailStatsSummary from '../../components/admin/MailStatsSummary';
import MailCampaignList from '../../components/emails/MailCampaignList';
import { useMailStats, useMailCampaigns } from '../../hooks/useTaskmasterQueries';

export default function EmailsOverviewPage() {
  const navigate = useNavigate();
  const {
    data: stats,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useMailStats();
  const { data: campaigns = [] } = useMailCampaigns();
  const sending = campaigns.filter((c) => c.status === 'Sending').length;

  return (
    <div className="space-y-8">
      {statsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(statsErr, 'Failed to load mail stats')}
          onRetry={() => refetchStats()}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight">Overview</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {sending > 0 ? `${sending} campaign(s) sending now` : 'Campaign performance at a glance'}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => navigate('/emails/create')}>
          <Plus size={14} /> Create Campaign
        </Button>
      </div>

      <MailStatsSummary stats={stats} campaignCount={campaigns.length} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Sent', value: stats?.totalSent ?? 0, icon: Send },
          { label: 'Opens', value: stats?.totalOpened ?? 0, icon: Eye },
          { label: 'Sending', value: sending, icon: Play },
          { label: 'Campaigns', value: campaigns.length, icon: Mail },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)]"
          >
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
              <Icon size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Recent campaigns</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/emails/campaigns')}>
            View all <ArrowRight size={14} />
          </Button>
        </div>
        <MailCampaignList limit={5} />
      </div>
    </div>
  );
}
