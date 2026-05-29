import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Users, Search, Trash2, UserCheck, TrendingUp,
  Database, Zap, Clock, ShieldAlert, LogIn, CalendarDays
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
import { format, isToday } from 'date-fns';
import {
  useUserDirectory, useCRMStats, useRepSummary, useMailStats,
  useLogs, useUpdateUser, useDeleteUser, useLeadAudits,
  useDepartments
} from '../../hooks/useTaskmasterQueries';
import { isAdminUser } from '../../utils/departmentPermissions';
import { useConfirm } from '../../contexts/ConfirmContext';

const formatDateInput = (value) => {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
};

const AdminUsers = () => {
  const { confirm } = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});

  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: departments = [] } = useDepartments();
  const { data: crmStats } = useCRMStats();
  const { data: repSummary } = useRepSummary();
  const { data: mailStats } = useMailStats();
  const { data: allLogs = [] } = useLogs('all', 100);

  const { data: userAuditsData } = useLeadAudits(
    { userId: selectedUser?._id, limit: 50 },
    !!selectedUser?._id
  );
  const userAudits = userAuditsData?.logs || [];

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
      });
    }
  }, [selectedUser]);

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      await updateUserMutation.mutateAsync({
        id: selectedUser._id,
        data: {
          name: editUserData.name,
          email: editUserData.email,
          phone: editUserData.phone,
          departmentId: editUserData.departmentId || null,
          dateOfBirth: editUserData.dateOfBirth || null,
          teams: [],
        },
      });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert(`User modification error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId) => {
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
  };

  const loginAlerts = useMemo(() => {
    return allLogs
      .filter(log => log.action === 'LOGIN' && isToday(new Date(log.createdAt)))
      .slice(0, 5);
  }, [allLogs]);

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
      header: 'Date of Birth',
      render: (u) => (
        <span className="text-[11px] font-mono text-[var(--color-text-secondary)]">
          {u.dateOfBirth ? format(new Date(u.dateOfBirth), 'MMM dd, yyyy') : '—'}
        </span>
      )
    },
    {
      header: 'Last Activity',
      render: (u) => (
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
          {u.lastOnline ? format(new Date(u.lastOnline), 'MMM dd, yyyy h:mm a') : 'No record'}
        </span>
      )
    }
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

        <aside className="lg:col-span-4 space-y-6">
          <Card className="p-4 bg-[var(--color-bg-secondary)] border-dashed h-fit">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert size={14} className="text-rose-500" />
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Security Alerts</h4>
            </div>
            <div className="space-y-4">
              {loginAlerts.length === 0 ? (
                <div className="text-center py-6 opacity-30">
                  <p className="text-[9px] font-black uppercase tracking-widest">No alerts today</p>
                </div>
              ) : loginAlerts.map(log => (
                <div key={log._id} className="flex gap-3">
                  <div className="w-1 h-8 bg-rose-500/40 rounded-full" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-tight flex items-center gap-1.5">
                      <LogIn size={10} className="text-rose-500" />
                      {log.userId?.name || 'System User'}
                    </p>
                    <p className="text-[8px] text-[var(--color-text-muted)] font-bold uppercase tracking-wider">
                      Logged in at {format(new Date(log.createdAt), 'h:mm a')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      <FullScreenWorkspace
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={['System ID:', selectedUser?._id?.substring(0, 8), '• Department:', selectedUser?.departmentId?.name || 'Unassigned'].join(' ')}
        onSave={handleSaveUser}
        isSaving={updateUserMutation.isPending}
        sidebar={
          <>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Activity Trail</h4>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3">
                    <Clock size={12} className="text-[var(--color-text-muted)] mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold">Modified Project Settings</p>
                      <p className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest">Oct 24, 2023 • 14:00</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-4 space-y-4 bg-[var(--color-bg-primary)]">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Security Configuration</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold">Two-Factor Auth</span>
                  <Badge variant="success">Enabled</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold">Access Token</span>
                  <span className="text-[9px] font-mono opacity-50">••••••••</span>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-[var(--color-bg-primary)] border border-rose-500/30">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-3">Danger Zone</h4>
              <Button
                variant="danger"
                size="sm"
                className="w-full justify-center !py-2"
                onClick={() => handleDeleteUser(selectedUser._id)}
                disabled={deleteUserMutation.isPending}
              >
                <Trash2 size={14} className="mr-2" />
                {deleteUserMutation.isPending ? 'Removing...' : 'Remove User Account'}
              </Button>
            </Card>
          </>
        }
      >
        <div className="space-y-8">
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
              <UserCheck size={14} /> User Details
            </h3>
            <div className="grid grid-cols-2 gap-6">
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
            </div>
          </section>

          {userAudits.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                CRM Lead Audit Trail
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {userAudits.map(log => (
                  <div key={log._id} className="p-3 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold">
                        Lead: <span className="text-[var(--color-text-primary)]">{log.leadId?.name || 'Unknown'}</span>
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        Field <span className="font-mono text-blue-400">{log.fieldChanged}</span> modified:
                        <span className="line-through mx-1">{log.oldValue || '(empty)'}</span>
                        &rarr;
                        <span className="text-emerald-400 ml-1">{log.newValue || '(empty)'}</span>
                      </p>
                    </div>
                    <span className="text-[9px] font-mono text-[var(--color-text-muted)] shrink-0 pl-2">
                      {log.timestamp ? format(new Date(log.timestamp), 'dd-MM-yyyy HH:mm') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
};

export default AdminUsers;
