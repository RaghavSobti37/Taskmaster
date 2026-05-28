import React from 'react';
import { Mail } from 'lucide-react';
import { PageHeader, PageContainer } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';

const AdminMail = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Email Campaigns"
        subtitle="Manage SMTP profiles, email campaigns, and delivery analytics."
        icon={Mail}
      />
      <AdminMailContent />
    </PageContainer>
  );
};

export default AdminMail;
