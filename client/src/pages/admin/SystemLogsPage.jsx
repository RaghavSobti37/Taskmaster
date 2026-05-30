import React from 'react';
import { PageContainer } from '../../components/ui';
import { SystemLogsContent } from './SystemLogsPanel';

const SystemLogsPage = () => (
  <PageContainer className="!py-4 !space-y-4">
    <SystemLogsContent />
  </PageContainer>
);

export default SystemLogsPage;
