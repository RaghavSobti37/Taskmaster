import React from 'react';
import { Navigate } from 'react-router-dom';
import { History } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import LeadAuditsContent from '../../components/admin/LeadAuditsContent';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';

const LeadAuditsPage = () => {
  const { user, loading } = useAuth();

  if (!loading && !isAdminUser(user)) {
    return <Navigate to="/admin/console" replace />;
  }

  return (
    <PageContainer className="!py-4 !space-y-0">
      <PageHeader title="Lead Audits" icon={History} backTo={ADMIN_CONSOLE_PATH} />
      <LeadAuditsContent />
    </PageContainer>
  );
};

export default LeadAuditsPage;
