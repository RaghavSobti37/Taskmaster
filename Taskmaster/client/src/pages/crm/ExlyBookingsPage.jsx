import React from 'react';
import { PageContainer, PageHeader } from '../../components/ui';
import ExlyDataContent from '../../components/admin/ExlyDataContent';
import { BookOpen } from 'lucide-react';

const ExlyBookingsPage = () => {
  return (
    <PageContainer className="!py-4 !space-y-6">
      
      <div className="w-full">
        <ExlyDataContent mode="unlinked_bookings" />
      </div>
    </PageContainer>
  );
};

export default ExlyBookingsPage;
