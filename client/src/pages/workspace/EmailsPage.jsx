import React from 'react';
import { PageContainer, PageHeader } from '../../components/ui';
import AdminMailContent from '../../components/admin/AdminMailContent';
import { MessageSquare } from 'lucide-react';

const EmailsPage = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
        title="Email Campaigns" 
        subtitle="Manage SMTP profiles, email campaigns, and delivery analytics."
        icon={MessageSquare}
      />
      
      <div className="w-full">
        <AdminMailContent />
      </div>
    </PageContainer>
  );
};

export default EmailsPage;
