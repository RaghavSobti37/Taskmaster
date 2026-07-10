import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { History, Trash2 } from 'lucide-react';
import { PageContainer, PageHeader, Button } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import LeadAuditsContent from '../../components/admin/LeadAuditsContent';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/confirmContext';
import { useLeadAudits } from '../../hooks/useTaskmasterQueries';

const LeadAuditsPage = () => {
  const { user, loading } = useAuth();
  const { confirm } = useConfirm();
  const [purging, setPurging] = useState(false);
  const { refetch } = useLeadAudits({ page: 1, limit: 10 }, isAdminUser(user));

  if (!loading && !isAdminUser(user)) {
    return <Navigate to="/admin/console" replace />;
  }

  const handlePurgeLogs = async () => {
    const ok = await confirm({
      title: 'Delete all logs?',
      message: 'Are you sure you want to permanently delete all lead change logs? This cannot be undone.',
      confirmLabel: 'Delete all',
      type: 'danger',
    });
    if (!ok) return;
    try {
      setPurging(true);
      await axios.delete('/api/crm/leads/audit-logs/purge');
      refetch();
    } catch (err) {
      console.error('Failed to purge logs:', err);
      alert(err.response?.data?.error || 'Failed to clear logs.');
    } finally {
      setPurging(false);
    }
  };

  return (
    <PageContainer className="!py-4 !space-y-0">
      <PageHeader
        title="Lead Audits"
        icon={History}
        backTo={ADMIN_CONSOLE_PATH}
        description="Immutable trail of lead field changes — who changed what and when."
        actions={isAdminUser(user) ? (
          <Button
            variant="danger"
            size="sm"
            onClick={handlePurgeLogs}
            disabled={purging}
            className="flex items-center justify-center gap-1.5 font-bold uppercase text-[10px] bg-red-600 hover:bg-red-700 text-white min-h-[40px]"
          >
            <Trash2 size={12} className={purging ? 'animate-pulse' : ''} />
            Clear logs
          </Button>
        ) : null}
      />
      <LeadAuditsContent />
    </PageContainer>
  );
};

export default LeadAuditsPage;
