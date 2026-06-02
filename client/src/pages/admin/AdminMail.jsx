import React from 'react';
import { Mail } from 'lucide-react';
import { PageHeader, PageContainer, DesktopRecommendedBanner } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';

const AdminMail = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Email Campaigns"
        icon={Mail}
      />
      <DesktopRecommendedBanner message="Email campaign editor and analytics are optimized for desktop. View campaign summaries on mobile from the campaigns list." />
      <AdminMailContent />
    </PageContainer>
  );
};

export default AdminMail;
