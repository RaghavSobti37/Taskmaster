import React from 'react';
import { History } from 'lucide-react';
import { PageHeader, PageContainer } from '../../components/ui';
import LeadAuditsContent from '../../components/admin/LeadAuditsContent';

const AdminAudits = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <LeadAuditsContent />
    </PageContainer>
  );
};

export default AdminAudits;
