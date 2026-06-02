import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck, Users, Search, Trash2, UserCheck, TrendingUp,
  Database, Zap, CalendarDays, KeyRound
} from 'lucide-react';
import {
  Badge,
  PageContainer,
  Card,
  StatCard,
  Button,
  DataTable,
  Input,
  FullScreenWorkspace,
  PageSkeleton,
} from '../../components/ui';
import { formatLastActivity } from '../../utils/formatLastActivity';
import DepartmentsPanel from '../../components/admin/DepartmentsPanel';
import MonthlyReportPanel from '../../components/admin/MonthlyReportPanel';
import {
  useUserDirectory, useCRMStats, useRepSummary, useMailStats,
  useUpdateUser, useDeleteUser,
  useDepartments
} from '../../hooks/useTaskmasterQueries';
import { isAdminUser } from '../../utils/departmentPermissions';
import { isRootAdminEmail } from '../../utils/rootAdminEmails';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';

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

  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: departments = [] } = useDepartments();
  const { data: crmStats } = useCRMStats();
  const { data: repSummary } = useRepSummary();
  const { data: mailStats } = useMailStats();

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  useEffect(() => {
    if (selectedUser) {
      setEditUserData({
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        dateOfBirth: formatDateInput(selectedUser.dateOfBirth),
        departmentId: selectedUser.departmentId?._id || selectedUser.departmentId || '',
        newPassword: '',
        confirmPassword: '',
      });
    }
  }, [selectedUser]);

  const handleSaveUser = useCallback(async () => {
    if (!selectedUser) return;
    if (editUserData.newPassword && editUserData.newPassword !== editUserData.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
    if (editUserData.newPassword && editUserData.newPassword.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    try {
      const payload = {
        name: editUserData.name,
        email: editUserData.email,
        phone: editUserData.phone,
        departmentId: editUserData.departmentId || null,
        dateOfBirth: editUserData.dateOfBirth || null,
        teams: [],
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

  const getDeleteBlockReason = useCallback((targetUser) => {
    if (!targetUser) return 'No user selected';
    if (currentUser?._id && targetUser._id === currentUser._id) return 'You cannot delete your own account';
    if (isRootAdminEmail(targetUser.email)) return 'Root admin accounts are protected';
    return null;
  }, [currentUser?._id]);

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const userColumns = [
    {
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] flex items-center justify-center font-bold text-xs select-none">
            {u.avatar ? <img src={u.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : u.name?.substring(0, 2).toUpperCase()}
          </div>
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
      render: (u) => (
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
          {formatLastActivity(u.lastOnline)}
        </span>
      )
    },
    {
      header: 'Actions',
      render: (u) => {
        const blockReason = getDeleteBlockReason(u);
        return (
          <button
            type="button"
            title={blockReason || 'Delete user'}
            disabled={Boolean(blockReason) || deleteUserMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (blockReason) return;
              handleDeleteUser(u._id);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              blockReason
                ? 'opacity-30 cursor-not-allowed text-[var(--color-text-muted)]'
                : 'text-rose-500 hover:bg-rose-500/10 hover:text-rose-600'
            }`}
          >
            <Trash2 size={14} />
          </button>
        );
      },
    },
  ];

  if (usersLoading) return <PageContainer><PageSkeleton /></PageContainer>;

  return (
    <PageContainer className="!py-4 !space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Users"
          value={users.length}
          icon={Users}
          variant="info"
          subValue="Active"
          info="Total number of registered user accounts."
        />
        <StatCard
          label="Total Data"
          value={crmStats?.totalLeads || 0}
          icon={Database}
          variant="mint"
          subValue="Records"
          info="Count of all entries in the master data archive."
        />
        <StatCard
          label="Conversion"
          value={`${repSummary?.avgConversion || 0}%`}
          icon={TrendingUp}
          variant="apricot"
          subValue="Team Avg"
          info="The percentage of data entries successfully processed into closed business."
        />
        <StatCard
          label="Emails Sent"
          value={mailStats?.totalSent || 0}
          icon={Zap}
          variant="slate"
          subValue="System"
          info="Total number of automated emails sent."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <Card className="flex flex-col h-full">
            <div className="p-3 border-b border-[var(--color-bg-border)] flex flex-col sm:flex-row sm:items-center gap-3 bg-[var(--color-bg-secondary)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shrink-0">
                <ShieldCheck size={14} className="text-[var(--color-action-primary)]" />
                Users
              </h3>
              <div className="flex-1 w-full min-w-0">
                <Input
                  icon={Search}
                  placeholder="Search users by name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="!py-1 !text-[11px] w-full"
                />
              </div>
            </div>

            <div className="p-0">
              <DataTable
                columns={userColumns}
                data={filteredUsers}
                className="!border-none"
                onRowClick={(u) => setSelectedUser(u)}
              />
            </div>
          </Card>
        </div>

        <aside className="lg:col-span-4">
          <DepartmentsPanel users={users} departments={departments} />
        </aside>
      </div>

      <FullScreenWorkspace
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={['System ID:', selectedUser?._id?.substring(0, 8), '• Department:', selectedUser?.departmentId?.name || 'Unassigned'].join(' ')}
        onSave={handleSaveUser}
        mainClassName="max-w-6xl"
        sidebar={
          <>
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

            <Card className="p-4 bg-[var(--color-bg-primary)] border border-rose-500/30">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-3">Danger Zone</h4>
              {getDeleteBlockReason(selectedUser) && (
                <p className="text-[10px] text-[var(--color-text-muted)] mb-3">{getDeleteBlockReason(selectedUser)}</p>
              )}
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-center !py-2"
                onClick={() => handleDeleteUser(selectedUser._id)}
                disabled={Boolean(getDeleteBlockReason(selectedUser)) || deleteUserMutation.isPending}
              >
                <Trash2 size={14} className="mr-2" />
                {deleteUserMutation.isPending ? 'Removing...' : 'Remove User Account'}
              </Button>
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
    </PageContainer>
  );
};

export default AdminUsers;
