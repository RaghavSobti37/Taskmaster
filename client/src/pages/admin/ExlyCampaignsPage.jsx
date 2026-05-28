import React from 'react';
import { PageContainer, PageHeader, PageSkeleton } from '../../components/ui';
import ExlyDataContent from '../../components/admin/ExlyDataContent';
import { Layers } from 'lucide-react';

const ExlyCampaignsPage = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      
      <div className="w-full">
        <ExlyDataContent mode="campaigns" />
      </div>
    </PageContainer>
  );
};

export default ExlyCampaignsPage;
