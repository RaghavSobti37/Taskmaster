import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Play, Mail, Eye, Plus, ArrowRight, FileCode } from 'lucide-react';
import { Button } from '../../components/ui';
import QueryErrorBanner, { getQueryErrorMessage } from '../../components/ui/QueryErrorBanner';
import MailStatsSummary from '../../components/admin/MailStatsSummary';
import MailCampaignList from '../../components/emails/MailCampaignList';
import { useMailStats, useMailCampaigns } from '../../hooks/useTaskmasterQueries';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';

const QUICK_ACTION_ACCENTS = {
  mint: {
    card: 'bg-[var(--color-pastel-mint-bg)] border-[color-mix(in_srgb,var(--color-pastel-mint-text)_28%,transparent)] hover:border-[var(--color-pastel-mint-text)]/55',
    iconWrap: 'bg-[color-mix(in_srgb,var(--color-pastel-mint-text)_16%,transparent)]',
    icon: 'text-[var(--color-pastel-mint-text)]',
  },
  blue: {
    card: 'bg-[var(--color-pastel-blue-bg)] border-[color-mix(in_srgb,var(--color-pastel-blue-text)_28%,transparent)] hover:border-[var(--color-pastel-blue-text)]/55',
    iconWrap: 'bg-[color-mix(in_srgb,var(--color-pastel-blue-text)_16%,transparent)]',
    icon: 'text-[var(--color-pastel-blue-text)]',
  },
};

export default function EmailsOverviewPage() {  const navigate = useNavigate();
  const {
    data: stats,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useMailStats();
  const deferMailSecondary = useDeferredQueryEnabled(true, { tier: 0 });
  const { data: campaigns = [] } = useMailCampaigns(deferMailSecondary);
  const sending = campaigns.filter((c) => c.status === 'Sending').length;

  return (
    <div className="space-y-8">
      {statsError && (
        <QueryErrorBanner
          message={getQueryErrorMessage(statsErr, 'Failed to load mail stats')}
          onRetry={() => refetchStats()}
        />
      )}
      <div>
        <h2 className="text-base font-bold tracking-tight">Overview</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {sending > 0 ? `${sending} campaign(s) sending now` : 'Campaign performance at a glance'}
        </p>
      </div>

      <MailStatsSummary stats={stats} campaignCount={campaigns.length} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'New campaign', desc: 'Template → audience → send', to: '/emails/create', icon: Plus, accent: 'mint' },
          { label: 'Templates', desc: 'Draft, preview, approve', to: '/emails/templates', icon: FileCode, accent: 'blue' },
        ].map(({ label, desc, to, icon: Icon, accent }) => {
          const styles = QUICK_ACTION_ACCENTS[accent];
          return (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className={`flex items-start gap-3 p-4 rounded-xl text-left border transition-colors ${styles.card}`}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${styles.iconWrap}`}>
                <Icon size={16} className={styles.icon} />
              </span>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{desc}</p>
              </div>
            </button>
          );
        })}
      </div>

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
