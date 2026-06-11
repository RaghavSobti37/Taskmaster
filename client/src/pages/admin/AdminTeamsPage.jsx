import React from 'react';
import { Building2, Users } from 'lucide-react';
import { ListPageLayout, PageSkeleton } from '../../components/ui';
import DepartmentsPanel from '../../components/admin/DepartmentsPanel';
import { useUserDirectory, useDepartments } from '../../hooks/useTaskmasterQueries';
import { distributionFromField } from '../../utils/buildChartSeries';

const AdminTeamsPage = () => {
  const { data: users = [], isLoading: usersLoading, isError: usersError, error: usersErr } = useUserDirectory();
  const { data: departments = [], isLoading: departmentsLoading, isError: deptError, error: deptErr } = useDepartments();
  const loadError = usersError ? usersErr : deptError ? deptErr : null;

  const deptChart = React.useMemo(
    () =>
      distributionFromField(users, 'departmentId', {
        labelFn: (d) => d?.name || 'Unassigned',
      }),
    [users]
  );

  if (usersLoading || departmentsLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Teams & Departments"
      icon={Building2}
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
          ? [{ id: 'dept', title: 'By department', type: 'donut', data: deptChart }]
          : [],
      }}
    >
      {loadError && (
        <p className="text-sm text-rose-500 mb-4">
          {loadError?.response?.data?.error || loadError?.message || 'Failed to load teams data.'}
        </p>
      )}
      {!loadError && (
      <div className="max-w-2xl">
        <DepartmentsPanel users={users} departments={departments} />
      </div>
      )}
    </ListPageLayout>
  );
};

export default AdminTeamsPage;
