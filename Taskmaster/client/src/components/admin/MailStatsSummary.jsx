import { Mail, Send, AlertCircle, UserMinus } from 'lucide-react';
import { StatCard } from '../ui';

const UNSUB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1BuHfbhY21cFoSHaanH8Q5Rg_80s3zHZY9snwzCroRe0/edit?usp=sharing';

export default function MailStatsSummary({ stats, campaignCount = 0 }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Total Campaigns" value={stats?.totalCampaigns || campaignCount} icon={Mail} variant="info" />
      <StatCard
        label="Emails Dispatched"
        value={stats?.totalSent || 0}
        icon={Send}
        variant="mint"
        subValue={stats?.totalOpened ? `${stats.totalOpened} opens` : undefined}
      />
      <StatCard
        label="Delivery failures"
        value={stats?.totalBounced || 0}
        icon={AlertCircle}
        variant="rose"
        info="Combined bounced, failed, and invalid delivery attempts across all campaigns."
      />
      <StatCard
        label="Unsubscribed"
        value={stats?.totalUnsubscribed || 0}
        icon={UserMinus}
        variant="warning"
        subValue="view list ↗"
        info="Opens tracked in campaign detail views."
        onClick={() => window.open(UNSUB_SHEET_URL, '_blank', 'noopener,noreferrer')}
      />
    </div>
  );
}
