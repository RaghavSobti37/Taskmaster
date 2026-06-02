import React from 'react';
import { ListPageLayout, DesktopRecommendedBanner } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';
import { Mail } from 'lucide-react';

const EmailsPage = () => {
  return (
    <ListPageLayout
      containerClassName="!py-4"
      icon={Mail}
      title="Email Campaigns"
    >
      <DesktopRecommendedBanner message="Email campaign editor and analytics are optimized for desktop." />
      <div className="w-full">
        <AdminMailContent />
      </div>
    </ListPageLayout>
  );
};

export default EmailsPage;
