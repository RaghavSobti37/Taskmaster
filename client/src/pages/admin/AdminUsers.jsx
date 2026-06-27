import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, TrendingUp,
  Database, Zap, UserPlus, UserCheck, CalendarDays, KeyRound
} from 'lucide-react';
import {
  Badge,
  Card,
  Button,
  DataTable,
  FullScreenWorkspace,
  Input,
  PageSkeleton,
  ListPageLayout,
  SearchInput,
  UserAvatar,
} from '../../components/ui';
import { distributionFromField } from '../../utils/buildChartSeries';
import { formatLastActivity } from '../../utils/formatLastActivity';
import MonthlyReportPanel from '../../components/admin/MonthlyReportPanel';
import { useDeferredQueryEnabled } from '../../hooks/useDeferredQuery';
import {
  useUserDirectory, useCRMStats, useMailStats, useDataHubFolders,
  useUpdateUser, useDeleteUser, useCreateUser,
  useDepartments, usePlatformExclusions,
} from '../../hooks/useTaskmasterQueries';
import {
  ADMIN_RIBBON_QUERY_OPTS,
  ADMIN_DATA_HUB_FOLDER_OPTS,
  getTeamConversionPercent,
  getTotalDataRecords,
} from '../../utils/adminRibbonMetrics';
import { isAdminUser } from '../../utils/departmentPermissions';
import { getDeleteUserBlockReason } from '../../utils/rootAdminEmails';
import { validatePasswordStrength } from '../../utils/passwordValidation';
import { stableJsonEqual } from '../../hooks/useUnsavedChanges';
import { useConfirm } from '../../contexts/confirmContext';
import { useAuth } from '../../contexts/AuthContext';
import UserDeleteAction from '../../components/admin/UserDeleteAction';
import CreateUserModal from '../../components/admin/CreateUserModal';
import PagePermissionsEditor from '../../components/admin/PagePermissionsEditor';
import { resolveDepartmentPages } from '../../utils/pagePermissions';

const formatDateInput = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const AdminUsers = () => {
  const { confirm } = useConfirm();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [editUserBaseline, setEditUserBaseline] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const { data: users = [], isLoading: usersLoading, isError: usersError, error: usersErr } = useUserDirectory();
  const deferAdminRibbon = useDeferredQueryEnabled(!usersLoading);
  const { data: departments = [] } = useDepartments(false, deferAdminRibbon);
  const { data: platformExclusions = {} } = usePlatformExclusions(deferAdminRibbon);
  const { data: crmStats } = useCRMStats(deferAdminRibbon, ADMIN_RIBBON_QUERY_OPTS);
  const { data: mailStats } = useMailStats(deferAdminRibbon, ADMIN_RIBBON_QUERY_OPTS);
  const { data: folderData } = useDataHubFolders({ ...ADMIN_DATA_HUB_FOLDER_OPTS, enabled: deferAdminRibbon });

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createUserMutation = useCreateUser();

  useEffect(() => {
    if (selectedUser) {
      const loaded = {
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        dateOfBirth: formatDateInput(selectedUser.dateOfBirth),
        departmentId: selectedUser.departmentId?._id || selectedUser.departmentId || '',
        useCustomPagePermissions: Array.isArray(selectedUser.pagePermissions) && selectedUser.pagePermissions.length > 0,
        pagePermissions: selectedUser.pagePermissions?.length
          ? [...selectedUser.pagePermissions]
          : resolveDepartmentPages(selectedUser.departmentId || {}),
        suspended: !!selectedUser.suspended,
        suspensionReason: selectedUser.suspensionReason || '',
        newPassword: '',
        confirmPassword: '',
      };
      setEditUserData(loaded);
      setEditUserBaseline(loaded);
    } else {
      setEditUserBaseline(null);
    }
  }, [selectedUser]);

  const hasUserChanges = !!editUserBaseline && !stableJsonEqual(editUserData, editUserBaseline);
  const handleRevertUserEdits = () => {
    if (editUserBaseline) setEditUserData(editUserBaseline);
  };

  const handleSaveUser = useCallback(async () => {
    if (!selectedUser) return;
    if (editUserData.newPassword && editUserData.newPassword !== editUserData.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    if (editUserData.newPassword) {
      const passwordError = validatePasswordStrength(editUserData.newPassword);
      if (passwordError) {
        alert(passwordError);
        return;
      }
    }
    try {
      const payload = {
        name: editUserData.name,
        email: editUserData.email,
        phone: editUserData.phone,
        departmentId: editUserData.departmentId || null,
        dateOfBirth: editUserData.dateOfBirth || null,
        teams: [],
        pagePermissions: editUserData.useCustomPagePermissions ? editUserData.pagePermissions : [],
        suspended: !!editUserData.suspended,
        suspensionReason: editUserData.suspended ? (editUserData.suspensionReason || '') : '',
      };
      if (editUserData.newPassword) payload.newPassword = editUserData.newPassword;
      await updateUserMutation.mutateAsync({ id: selectedUser._id, data: payload });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.message || 'User modification error');
    }
  }, [selectedUser, editUserData, updateUserMutation]);

  const handleDeleteUser = useCallback(async (userId) => {
    const ok = await confirm({
      title: 'Remove user?',
      message: 'Are you sure you want to permanently remove this user account?',
      confirmLabel: 'Remove',
      type: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUserMutation.mutateAsync(userId);
      setSelectedUser(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  }, [confirm, deleteUserMutation]);

  const getDeleteBlockReason = useCallback(
    (targetUser) => getDeleteUserBlockReason(currentUser, targetUser, platformExclusions),
    [currentUser, platformExclusions]
  );

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const deptChart = useMemo(
    () =>
      distributionFromField(users, 'departmentId', {
        labelFn: (d) => d?.name || 'Unassigned',
      }),
    [users]
  );

  const userColumns = [
    {
      header: 'User',
      sortKey: 'name',
      render: (u) => (
        <div className="flex items-center gap-3">
          <UserAvatar user={u} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs">{u.name}</span>
              <Badge variant={isAdminUser(u) ? 'rose' : 'info'} className="!text-[9px] uppercase font-mono">
                {u.departmentId?.name || 'Unassigned'}
              </Badge>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{u.email}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Last Activity',
      sortKey: 'lastOnline',
      sortFn: (u) => (u.lastOnline ? new Date(u.lastOnline) : null),
      render: (u) => (
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
          {formatLastActivity(u.lastOnline)}
        </span>
      )
    },
  ];

  if (usersLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overviewMobileMaxStats={2}
      overview={{
        stats: [
          {
            id: 'users',
            label: 'Total Users',
            value: users.length,
            icon: Users,
            variant: 'info',
            info: 'Total number of registered user accounts.',
          },
          {
            id: 'data',
            label: 'Total Data',
            value: getTotalDataRecords(folderData, crmStats),
            icon: Database,
            variant: 'mint',
            info: 'Unified people count in Data Hub (all inlets). Falls back to CRM leads if hub is unavailable.',
          },
          {
            id: 'conversion',
            label: 'Conversion',
            value: `${getTeamConversionPercent(crmStats)}%`,
            icon: TrendingUp,
            variant: 'apricot',
            info: 'Share of CRM leads marked Converted (live stats, refreshed every few minutes).',
          },
          {
            id: 'emails',
            label: 'Emails Sent',
            value: mailStats?.totalSent || 0,
            icon: Zap,
            variant: 'slate',
            info: 'Total number of automated emails sent.',
          },
        ],
        charts: deptChart.length
          ? [{ id: 'dept', title: 'By department', type: 'donut', data: deptChart }]
          : [],
      }}
      toolbar={
        <SearchInput
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      }
      toolbarActions={
        <Button onClick={() => setShowCreateUser(true)} size="sm" className="gap-2 shrink-0">
          <UserPlus size={14} />
          Add user
        </Button>
      }
    >
      {usersError && (
        <p className="text-sm text-rose-500 mb-4">
          {usersErr?.response?.data?.error || usersErr?.message || 'Failed to load user directory.'}
        </p>
      )}
      {!usersError && (
      <DataTable
        columns={userColumns}
        data={filteredUsers}
        onRowClick={(u) => setSelectedUser(u)}
        getRowId={(u) => u._id}
      />
      )}

      <FullScreenWorkspace
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={['System ID:', selectedUser?._id?.substring(0, 8), '• Department:', selectedUser?.departmentId?.name || 'Unassigned'].join(' ')}
        onSave={handleSaveUser}
        onCancel={handleRevertUserEdits}
        hasChanges={hasUserChanges}
        mainClassName="max-w-6xl"
        extraActions={
          selectedUser ? (
            <UserDeleteAction
              blockReason={getDeleteBlockReason(selectedUser)}
              isPending={deleteUserMutation.isPending}
              onDelete={() => handleDeleteUser(selectedUser._id)}
            />
          ) : null
        }
        sidebar={
          <>
            <Card className="p-4 bg-[var(--color-bg-primary)] border border-rose-500/30">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-3">Delete User</h4>
              {getDeleteBlockReason(selectedUser) && (
                <p className="text-[10px] text-[var(--color-text-muted)] mb-3">{getDeleteBlockReason(selectedUser)}</p>
              )}
              <UserDeleteAction
                blockReason={getDeleteBlockReason(selectedUser)}
                isPending={deleteUserMutation.isPending}
                onDelete={() => handleDeleteUser(selectedUser._id)}
              />
            </Card>

            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                <UserCheck size={12} /> User Details
              </h4>
              <Input
                label="Full Name"
                value={editUserData.name || ''}
                onChange={e => setEditUserData({ ...editUserData, name: e.target.value })}
              />
              <Input
                label="Email Address"
                value={editUserData.email || ''}
                onChange={e => setEditUserData({ ...editUserData, email: e.target.value })}
              />
              <Input
                label="Phone Number"
                placeholder="No phone listed"
                value={editUserData.phone || ''}
                onChange={e => setEditUserData({ ...editUserData, phone: e.target.value })}
              />
              <Input
                type="date"
                label="Date of Birth"
                icon={CalendarDays}
                value={editUserData.dateOfBirth || ''}
                onChange={e => setEditUserData({ ...editUserData, dateOfBirth: e.target.value })}
              />
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Department</label>
                <select
                  value={editUserData.departmentId || ''}
                  onChange={e => setEditUserData({ ...editUserData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </Card>

            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                <Database size={12} /> Page Access Override
              </h4>
              <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editUserData.useCustomPagePermissions}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setEditUserData((prev) => ({
                      ...prev,
                      useCustomPagePermissions: enabled,
                      pagePermissions: enabled
                        ? (prev.pagePermissions?.length
                          ? prev.pagePermissions
                          : resolveDepartmentPages(
                            departments.find((d) => String(d._id) === String(prev.departmentId)) || selectedUser?.departmentId || {}
                          ))
                        : [],
                    }));
                  }}
                  className="rounded border-[var(--color-bg-border)]"
                />
                Custom page access (overrides role defaults)
              </label>
              {editUserData.useCustomPagePermissions && (
                <PagePermissionsEditor
                  selectedPages={editUserData.pagePermissions || []}
                  onChange={(pages) => setEditUserData({ ...editUserData, pagePermissions: pages })}
                />
              )}
            </Card>

            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                Account Access
              </h4>
              <label className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!editUserData.suspended}
                  onChange={(e) => setEditUserData((prev) => ({ ...prev, suspended: e.target.checked }))}
                  className="rounded border-[var(--color-bg-border)]"
                />
                Suspend account (blocks Coreknot access, keeps data)
              </label>
              {editUserData.suspended && (
                <Input
                  label="Suspension reason (optional)"
                  placeholder="Internal note"
                  value={editUserData.suspensionReason || ''}
                  onChange={(e) => setEditUserData({ ...editUserData, suspensionReason: e.target.value })}
                />
              )}
            </Card>

            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] flex items-center gap-2">
                <KeyRound size={12} /> Password
              </h4>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {selectedUser?.hasPassword ? 'Password is set for this account.' : 'OAuth only — no password on file.'}
              </p>
              <Input
                type="password"
                label="New Password"
                placeholder="Leave blank to keep current"
                value={editUserData.newPassword || ''}
                onChange={e => setEditUserData({ ...editUserData, newPassword: e.target.value })}
              />
              <Input
                type="password"
                label="Confirm Password"
                placeholder="Repeat new password"
                value={editUserData.confirmPassword || ''}
                onChange={e => setEditUserData({ ...editUserData, confirmPassword: e.target.value })}
              />
            </Card>
          </>
        }
      >
        <div className="space-y-8">
          {selectedUser && (
            <MonthlyReportPanel userId={selectedUser._id} userName={selectedUser.name} />
          )}
        </div>
      </FullScreenWorkspace>

      <CreateUserModal
        isOpen={showCreateUser}
        onClose={() => setShowCreateUser(false)}
        departments={departments}
        isPending={createUserMutation.isPending}
        onCreate={(data) => createUserMutation.mutateAsync(data)}
      />
    </ListPageLayout>
  );
};

export default AdminUsers;
