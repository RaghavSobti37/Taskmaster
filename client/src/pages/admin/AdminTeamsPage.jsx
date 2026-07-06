import React, { useState, useCallback } from 'react';
import { Building2, Users } from 'lucide-react';
import { ListPageLayout, PageSkeleton, QueryErrorBanner, getQueryErrorMessage, Button } from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import AdminBulkActionBar from '../../components/admin/AdminBulkActionBar';
import DepartmentsPanel from '../../components/admin/DepartmentsPanel';
import { useUserDirectory, useDepartments, useUpdateUser } from '../../hooks/useTaskmasterQueries';
import { distributionFromField } from '../../utils/buildChartSeries';

const AdminTeamsPage = () => {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDepartmentId, setBulkDepartmentId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const updateUserMutation = useUpdateUser();
  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersErr,
    refetch: refetchUsers,
  } = useUserDirectory();
  const {
    data: departments = [],
    isLoading: departmentsLoading,
    isError: deptError,
    error: deptErr,
    refetch: refetchDepartments,
  } = useDepartments();
  const loadError = usersError ? usersErr : deptError ? deptErr : null;

  const deptChart = React.useMemo(
    () =>
      distributionFromField(users, 'departmentId', {
        labelFn: (d) => d?.name || 'Unassigned',
      }),
    [users]
  );

  const unassignedUsers = React.useMemo(
    () => users.filter((u) => !u.departmentId),
    [users],
  );

  const toggleSelection = useCallback((userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkAssign = useCallback(async () => {
    if (!bulkDepartmentId || selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      for (const id of selectedIds) {
        await updateUserMutation.mutateAsync({ id, data: { departmentId: bulkDepartmentId } });
      }
      clearSelection();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Bulk assign failed');
    } finally {
      setBulkBusy(false);
    }
  }, [bulkDepartmentId, selectedIds, updateUserMutation, clearSelection]);

  if (usersLoading || departmentsLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Teams & Departments"
      icon={Building2}
      backTo={ADMIN_CONSOLE_PATH}
      breadcrumbs={[{ label: 'Teams & Departments' }]}
      overview={{
        stats: [
          {
            id: 'departments',
            label: 'Departments',
            value: departments.length,
            icon: Building2,
            variant: 'info',
            info: 'Total department groups with page access presets.',
          },
          {
            id: 'assigned',
            label: 'Assigned Users',
            value: users.filter((u) => u.departmentId).length,
            icon: Users,
            variant: 'mint',
            info: 'Users assigned to a department.',
          },
          {
            id: 'unassigned',
            label: 'Unassigned',
            value: users.filter((u) => !u.departmentId).length,
            icon: Users,
            variant: 'slate',
            info: 'Users without a department.',
          },
        ],
        charts: deptChart.length
          ? [{ id: 'dept', title: 'By department', type: 'bar', data: deptChart, height: 120 }]
          : [],
      }}
    >
      {loadError && (
        <QueryErrorBanner
          className="mb-4"
          message={getQueryErrorMessage(loadError, 'Failed to load teams data')}
          onRetry={() => {
            if (usersError) refetchUsers();
            if (deptError) refetchDepartments();
          }}
        />
      )}
      {!loadError && (
        <>
          {unassignedUsers.length > 0 && (
            <section className="mb-6" aria-labelledby="unassigned-users-heading">
              <h2 id="unassigned-users-heading" className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
                Unassigned users
              </h2>
              <ul className="rounded-[var(--radius-atomic)] border border-[var(--color-bg-border)] divide-y divide-[var(--color-bg-border)] bg-[var(--color-bg-primary)]">
                {unassignedUsers.map((u) => (
                  <li key={u._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(u._id)}
                      onChange={() => toggleSelection(u._id)}
                      aria-label={`Select ${u.name}`}
                    />
                    <span className="font-medium text-[var(--color-text-primary)] truncate">{u.name}</span>
                    <span className="text-[var(--color-text-muted)] text-xs truncate">{u.email}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DepartmentsPanel users={users} departments={departments} />
          <AdminBulkActionBar selectedCount={selectedIds.size} onClear={clearSelection}>
            <select
              className="text-xs rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1.5"
              value={bulkDepartmentId}
              onChange={(e) => setBulkDepartmentId(e.target.value)}
              aria-label="Department for bulk assign"
            >
              <option value="">Assign to department…</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
            <Button type="button" size="sm" disabled={bulkBusy || !bulkDepartmentId} onClick={handleBulkAssign}>
              Assign selected
            </Button>
          </AdminBulkActionBar>
        </>
      )}
    </ListPageLayout>
  );
};

export default AdminTeamsPage;
