import React from 'react';
import { ListPageLayout, DesktopRecommendedBanner } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';
import { Mail, Send, Play, Pause } from 'lucide-react';
import { useMailStats, useMailCampaigns } from '../../hooks/useTaskmasterQueries';

const EmailsPage = () => {
  const { data: stats, isLoading: statsLoading } = useMailStats();
  const { data: campaigns = [], isLoading: campaignsLoading } = useMailCampaigns();
  const overviewLoading = statsLoading || campaignsLoading;
  const sending = campaigns.filter((c) => c.status === 'Sending').length;
  const completed = campaigns.filter((c) => c.status === 'Completed').length;
  const statValue = (v) => (overviewLoading ? '—' : v);

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'sent',
            label: 'Emails Sent',
            value: statValue(stats?.totalSent ?? 0),
            className: overviewLoading ? 'animate-pulse' : undefined,
            icon: Send,
            variant: 'mint',
            info: 'Total emails dispatched across all campaigns.',
          },
          {
            id: 'sending',
            label: 'Sending Now',
            value: statValue(sending),
            className: overviewLoading ? 'animate-pulse' : undefined,
            icon: Play,
            variant: 'apricot',
            info: 'Campaigns currently in sending state.',
          },
          {
            id: 'done',
            label: 'Completed',
            value: statValue(completed),
            className: overviewLoading ? 'animate-pulse' : undefined,
            icon: Mail,
            variant: 'info',
            info: 'Campaigns that finished sending.',
          },
          {
            id: 'opens',
            label: 'Total Opens',
            value: statValue(stats?.totalOpened ?? 0),
            className: overviewLoading ? 'animate-pulse' : undefined,
            icon: Pause,
            variant: 'slate',
            info: 'Aggregate open events recorded (UI summary only).',
          },
        ],
      }}
    >
      <DesktopRecommendedBanner message="Email campaign editor and analytics are optimized for desktop." />
      <div className="w-full">
        <AdminMailContent />
      </div>
    </ListPageLayout>
  );
};

export default EmailsPage;
