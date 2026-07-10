import React from 'react';
import { Database } from 'lucide-react';
import { PageHeader, PageContainer } from '../../components/ui';
import ExlyDataContent from '../../components/admin/ExlyDataContent';

const AdminExly = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      <ExlyDataContent />
    </PageContainer>
  );
};

export default AdminExly;
