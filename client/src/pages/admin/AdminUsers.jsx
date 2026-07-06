import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, TrendingUp,
  Database, Zap, UserPlus, CalendarDays
} from 'lucide-react';
import {
  Button,
  FullScreenWorkspace,
  Input,
  PasswordInput,
  PageSkeleton,
  ListPageLayout,
  SearchInput,
  QueryErrorBanner,
  getQueryErrorMessage,
  DetailSidebarShell,
  DetailSidebarSection,
} from '../../components/ui';
import { ADMIN_CONSOLE_PATH } from '../../components/admin/AdminConsoleBackButton';
import { distributionFromField } from '../../utils/buildChartSeries';
import MonthlyReportPanel from '../../components/admin/MonthlyReportPanel';
import AdminUserGridCard from '../../components/admin/AdminUserGridCard';
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
import { getDeleteUserBlockReason } from '../../utils/rootAdminEmails';
import { validatePasswordStrength } from '../../utils/passwordValidation';
import { stableJsonEqual } from '../../hooks/useUnsavedChanges';
import { useConfirm } from '../../contexts/confirmContext';
import { useAuth } from '../../contexts/AuthContext';
import UserDeleteAction from '../../components/admin/UserDeleteAction';
import CreateUserModal from '../../components/admin/CreateUserModal';
import ClerkDashboardUsersButton from '../../components/admin/ClerkDashboardUsersButton';
import PagePermissionsEditor from '../../components/admin/PagePermissionsEditor';
import { resolveDepartmentPages } from '../../utils/pagePermissions';
import { formatDobInput, parseDobInput } from '../../utils/dateDisplay';
import TenantMemberRoleBadge, { getTenantMembershipFromUser } from '../../components/org/TenantMemberRoleBadge';
import AdminBulkActionBar from '../../components/admin/AdminBulkActionBar';

const AdminUsers = () => {
  const { confirm } = useConfirm();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [editUserBaseline, setEditUserBaseline] = useState(null);
  const [dobError, setDobError] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [reportUser, setReportUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDepartmentId, setBulkDepartmentId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const {
    data: users = [],
    isLoading: usersLoading,
    isError: usersError,
    error: usersErr,
    refetch: refetchUsers,
  } = useUserDirectory();
  const userList = useMemo(() => (Array.isArray(users) ? users : []), [users]);
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
        dateOfBirth: formatDobInput(selectedUser.dateOfBirth),
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
      setDobError('');
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
    const dobParsed = parseDobInput(editUserData.dateOfBirth);
    if (!dobParsed.ok) {
      setDobError(dobParsed.error);
      return;
    }
    setDobError('');
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
        dateOfBirth: dobParsed.value,
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
    return userList
      .filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }, [userList, searchTerm]);

  const toggleUserSelection = useCallback((userId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const runBulkUpdate = useCallback(async (patchFn) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      for (const id of ids) {
        const user = userList.find((u) => u._id === id);
        if (!user) continue;
        await patchFn(user);
      }
      clearSelection();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Bulk update failed');
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, userList, clearSelection]);

  const handleBulkSuspend = useCallback(() => {
    runBulkUpdate((user) => updateUserMutation.mutateAsync({
      id: user._id,
      data: { suspended: true, suspensionReason: 'Bulk suspend from admin' },
    }));
  }, [runBulkUpdate, updateUserMutation]);

  const handleBulkActivate = useCallback(() => {
    runBulkUpdate((user) => updateUserMutation.mutateAsync({
      id: user._id,
      data: { suspended: false, suspensionReason: '' },
    }));
  }, [runBulkUpdate, updateUserMutation]);

  const handleBulkAssignDepartment = useCallback(() => {
    if (!bulkDepartmentId) {
      alert('Choose a department first.');
      return;
    }
    runBulkUpdate((user) => updateUserMutation.mutateAsync({
      id: user._id,
      data: { departmentId: bulkDepartmentId },
    }));
  }, [runBulkUpdate, updateUserMutation, bulkDepartmentId]);

  const deptChart = useMemo(
    () =>
      distributionFromField(userList, 'departmentId', {
        labelFn: (d) => d?.name || 'Unassigned',
      }),
    [userList]
  );

  if (usersLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title="Users"
      icon={Users}
      backTo={ADMIN_CONSOLE_PATH}
      breadcrumbs={[{ label: 'Users' }]}
      overviewMobileMaxStats={2}
      overview={{
        stats: [
          {
            id: 'users',
            label: 'Total Users',
            value: userList.length,
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
      toolbarFill
      searchBar={(
        <SearchInput
          variant="toolbar"
          placeholder="Search name, email…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-full"
        />
      )}
      toolbarActions={
        <div className="flex items-center gap-2 shrink-0">
          <ClerkDashboardUsersButton />
          <Button onClick={() => setShowCreateUser(true)} size="sm" className="gap-2 shrink-0">
            <UserPlus size={14} />
            Add user
          </Button>
        </div>
      }
    >
      {usersError && (
        <QueryErrorBanner
          className="mb-4"
          message={getQueryErrorMessage(usersErr, 'Failed to load user directory')}
          onRetry={() => refetchUsers()}
        />
      )}
      {!usersError && (
        filteredUsers.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">No users match your search.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredUsers.map((u) => {
              const tenantMembership = getTenantMembershipFromUser(u);
              return (
                <div key={u._id} className="flex flex-col gap-1.5">
                  {tenantMembership && (
                    <div className="px-1">
                      <TenantMemberRoleBadge {...tenantMembership} />
                    </div>
                  )}
                  <AdminUserGridCard
                    user={u}
                    onEdit={setSelectedUser}
                    onViewReport={setReportUser}
                    selectionMode
                    selected={selectedIds.has(u._id)}
                    onSelectToggle={toggleUserSelection}
                  />
                </div>
              );
            })}
          </div>
        )
      )}

      <AdminBulkActionBar selectedCount={selectedIds.size} onClear={clearSelection}>
        <Button type="button" size="sm" variant="secondary" disabled={bulkBusy} onClick={handleBulkActivate}>
          Activate
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={bulkBusy} onClick={handleBulkSuspend}>
          Suspend
        </Button>
        <select
          className="text-xs rounded border border-[var(--color-bg-border)] bg-[var(--color-bg-primary)] px-2 py-1.5"
          value={bulkDepartmentId}
          onChange={(e) => setBulkDepartmentId(e.target.value)}
          aria-label="Department for bulk assign"
        >
          <option value="">Assign department…</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
        <Button type="button" size="sm" disabled={bulkBusy || !bulkDepartmentId} onClick={handleBulkAssignDepartment}>
          Apply dept
        </Button>
      </AdminBulkActionBar>

      <FullScreenWorkspace
        isOpen={!!reportUser}
        onClose={() => setReportUser(null)}
        title={reportUser ? `Report — ${reportUser.name}` : 'Report'}
        subtitle={reportUser?.email}
        mainClassName="max-w-5xl"
      >
        {reportUser && (
          <MonthlyReportPanel userId={reportUser._id} userName={reportUser.name} />
        )}
      </FullScreenWorkspace>

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
          <DetailSidebarShell
            actions={
              selectedUser ? (
                <UserDeleteAction
                  blockReason={getDeleteBlockReason(selectedUser)}
                  isPending={deleteUserMutation.isPending}
                  onDelete={() => handleDeleteUser(selectedUser._id)}
                />
              ) : null
            }
          >
            <DetailSidebarSection label="User Details">
              <div className="tm-stat-shell p-4 space-y-4">
                {selectedUser && getTenantMembershipFromUser(selectedUser) && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">
                      Organization role
                    </label>
                    <TenantMemberRoleBadge {...getTenantMembershipFromUser(selectedUser)} />
                  </div>
                )}
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
                  type="text"
                  inputMode="numeric"
                  label="Date of Birth"
                  placeholder="DD/MM/YYYY"
                  icon={CalendarDays}
                  value={editUserData.dateOfBirth || ''}
                  onChange={e => {
                    setEditUserData({ ...editUserData, dateOfBirth: e.target.value });
                    setDobError('');
                  }}
                />
                {dobError && <p className="text-xs text-rose-500 font-medium -mt-2">{dobError}</p>}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Department</label>
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
              </div>
            </DetailSidebarSection>

            <DetailSidebarSection label="Page Access Override">
              <div className="tm-stat-shell p-4 space-y-4">
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
              </div>
            </DetailSidebarSection>

            <DetailSidebarSection label="Account Access">
              <div className="tm-stat-shell p-4 space-y-4">
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
              </div>
            </DetailSidebarSection>

            <DetailSidebarSection label="Password">
              <div className="tm-stat-shell p-4 space-y-4">
                <p className="text-[10px] text-[var(--color-text-muted)] m-0">
                  {selectedUser?.hasPassword ? 'Password is set for this account.' : 'OAuth only — no password on file.'}
                </p>
                <PasswordInput
                  label="New Password"
                  placeholder="Leave blank to keep current"
                  value={editUserData.newPassword || ''}
                  onChange={e => setEditUserData({ ...editUserData, newPassword: e.target.value })}
                />
                <PasswordInput
                  label="Confirm Password"
                  placeholder="Repeat new password"
                  value={editUserData.confirmPassword || ''}
                  onChange={e => setEditUserData({ ...editUserData, confirmPassword: e.target.value })}
                />
              </div>
            </DetailSidebarSection>
          </DetailSidebarShell>
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
