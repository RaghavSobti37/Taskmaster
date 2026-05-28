import React from 'react';
import { Database } from 'lucide-react';
import { PageHeader, PageContainer } from '../../components/ui';
import TscDataContent from '../../components/admin/TscDataContent';

const AdminCRM = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
    
      <TscDataContent />
    </PageContainer>
  );
};

export default AdminCRM;
