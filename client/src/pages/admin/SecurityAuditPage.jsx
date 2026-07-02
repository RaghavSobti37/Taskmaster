import React, { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { Shield, History } from 'lucide-react';
import { PageContainer, PageHeader, PageSkeleton, DataTable, Badge } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import QueryErrorSlot from '../../components/ui/QueryErrorSlot';
import { formatDisplayDateTime12h } from '../../utils/dateDisplay';

const fetchAudits = async (params) => {
  const res = await axios.get('/api/admin/security-audit', { params });
  return res.data;
};

export default function SecurityAuditPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['security-audit', page],
    queryFn: () => fetchAudits({ page, limit: 50 }),
  });

  const columns = useMemo(() => [
    {
      key: 'timestamp',
      label: 'When',
      render: (row) => formatDisplayDateTime12h(row.timestamp),
    },
    { key: 'actorEmail', label: 'Actor' },
    {
      key: 'action',
      label: 'Action',
      render: (row) => <Badge variant="neutral">{row.action}</Badge>,
    },
    { key: 'resourceType', label: 'Resource' },
    { key: 'resourceId', label: 'ID', render: (row) => row.resourceId || '—' },
    { key: 'path', label: 'Path' },
  ], []);

  const rows = data?.logs || [];

  if (isLoading) return <PageSkeleton />;

  return (
    <PageContainer>
      <PageHeader
        title="Security Audit Log"
        subtitle="Finance, permissions, admin, and data-hub mutations"
        icon={Shield}
        backTo={ADMIN_CONSOLE_PATH}
      />
      {isError ? (
        <QueryErrorSlot error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 text-sm text-[var(--color-text-secondary)]">
            <History size={14} />
            {data?.total ?? 0} events · page {data?.page ?? 1} of {data?.pages ?? 1}
          </div>
          <DataTable columns={columns} data={rows} rowKey={(r) => r._id} />
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              className="text-sm text-[var(--color-action-primary)] disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="text-sm text-[var(--color-action-primary)] disabled:opacity-40"
              disabled={page >= (data?.pages || 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </PageContainer>
  );
}
