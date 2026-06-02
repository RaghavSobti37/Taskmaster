// UDIF 2.0 - Admin Control Center
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldCheck, Send, XCircle, Eye, Zap, Play, Settings, Plus, Users, 
  Search, PlusCircle, Database, Phone, UserCheck, TrendingUp, FileBarChart,
  X, Trash2, MoreVertical, Edit2, ShieldAlert, Activity, Clock, Shield, LogIn, Layers
} from 'lucide-react';
import { 
  Badge, 
  PageHeader, 
  TabSwitcher, 
  PageContainer, 
  Card, 
  StatCard,
  Button, 
  DataTable,
  ProgressBar,
  PageSkeleton,
  Input,
  FullScreenWorkspace,
  InfoButton
} from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { DataHubContent } from './DataHubPage';
import { 
  useUserDirectory, useTeams, useCRMStats, useRepSummary, useMailStats, useUpdateUser, useDeleteUser, useCreateTeam, useDeleteTeam
} from '../../hooks/useTaskmasterQueries';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useAuth } from '../../contexts/AuthContext';
import { isRootAdminEmail } from '../../utils/rootAdminEmails';
import UserDeleteAction from '../../components/admin/UserDeleteAction';

const AdminPanel = () => {
  const { confirm } = useConfirm();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  }, [setSearchParams]);
  
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: teams = [] } = useTeams();
  const { data: crmStats } = useCRMStats();
  const { data: repSummary } = useRepSummary();
  const { data: mailStats } = useMailStats();

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createTeamMutation = useCreateTeam();
  const deleteTeamMutation = useDeleteTeam();

  useEffect(() => {
    if (selectedUser) {
      setEditUserData({
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        role: selectedUser.role || 'user',
        teams: selectedUser.teams || []
      });
    }
  }, [selectedUser]);

  const handleSaveUser = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await updateUserMutation.mutateAsync({
        id: selectedUser._id,
        data: editUserData
      });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      alert(`User modification error: ${err.message}`);
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
    if (currentUser?._id && String(targetUser._id) === String(currentUser._id)) {
      return 'You cannot delete your own account';
    }
    if (isRootAdminEmail(targetUser.email)) return 'Root admin accounts are protected';
    return null;
  }, [currentUser?._id]);

  const handleCreateTeam = useCallback(async () => {
    if (!newTeamName) return;
    try {
      await createTeamMutation.mutateAsync({ name: newTeamName });
      setNewTeamName('');
    } catch (err) {
      alert('Failed to create team: ' + err.message);
    }
  }, [newTeamName, createTeamMutation]);

  const pageMeta = {
    users: { title: "Users & Teams", subtitle: "Manage system access credentials, security profiles, and operational teams." },
    crm: { title: "Data Hub", subtitle: "Unified people data across Exly, Leads, TSC, Booked Calls, Enquiries, Mail, and more." },
  };

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
              <Badge variant={u.role === 'admin' ? 'rose' : 'info'} className="!text-[9px] uppercase font-mono">
                {u.role}
              </Badge>
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{u.email}</span>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned Team',
      render: (u) => (
        <span className="text-xs font-bold uppercase text-[var(--color-text-secondary)]">
          {u.teams?.length > 0 ? u.teams.join(', ') : 'Unassigned'}
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
    },
    {
      header: 'Delete',
      render: (u) => (
        <UserDeleteAction
          compact
          blockReason={getDeleteBlockReason(u)}
          isPending={deleteUserMutation.isPending}
          onDelete={() => handleDeleteUser(u._id)}
        />
      ),
    },
  ];

  const currentMeta = pageMeta[activeTab] || { title: "Admin Panel", subtitle: "Manage users, teams, and system data." };

  if (usersLoading) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
         title={currentMeta.title} 
         subtitle={currentMeta.subtitle}
         icon={ShieldCheck}
         actions={
           <div className="flex items-center gap-2">
             <TabSwitcher 
               activeTab={activeTab} 
               onChange={handleTabChange} 
               tabs={[
                 { id: 'users', label: 'Users' }, 
                 { id: 'crm', label: 'Data Hub' },
               ]} 
             />
           </div>
         }
      />

      {/* Analytical Ribbon - Only on users and teams subpage */}
      {(activeTab === 'users' || activeTab === 'teams') && (
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
      )}

      {/* Main Surface */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={activeTab === 'users' ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <Card className="flex flex-col h-full">
            <div className="p-3 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
               <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                 <ShieldCheck size={14} className="text-[var(--color-action-primary)]" />
                 {activeTab.toUpperCase()}
               </h3>
               {(activeTab === 'users' || activeTab === 'teams') && (
                 <div className="flex items-center gap-2 max-w-xs flex-1">
                   <Input 
                     icon={Search} 
                     placeholder="Search..." 
                     value={searchTerm} 
                     onChange={e => setSearchTerm(e.target.value)}
                     className="!py-1 !text-[11px]"
                   />
                 </div>
               )}
            </div>
            
            <div className="p-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'users' && (
                    <DataTable 
                      columns={userColumns} 
                      data={filteredUsers} 
                      className="!border-none"
                      onRowClick={(u) => setSelectedUser(u)}
                    />
                  )}
                  {activeTab === 'crm' && <DataHubContent />}
                </motion.div>
              </AnimatePresence>
            </div>
          </Card>
        </div>

        {activeTab === 'users' && (
          <aside className="lg:col-span-4 space-y-6">
            <Card className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Users size={14} className="text-[var(--color-action-primary)]" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Teams & Workgroups</h4>
                 </div>
              </div>
              <div className="flex gap-2">
                 <Input 
                   placeholder="New team name..." 
                   value={newTeamName} 
                   onChange={e => setNewTeamName(e.target.value)} 
                   className="!py-1 !text-[11px]"
                 />
                 <Button 
                   onClick={handleCreateTeam} 
                   disabled={createTeamMutation.isPending || !newTeamName.trim()}
                   size="sm"
                   className="whitespace-nowrap font-black uppercase text-[10px]"
                 >
                   Add
                 </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                 {teams.map(team => {
                   const memberCount = users.filter(u => u.teams?.includes(team.name)).length;
                   return (
                     <div key={team._id} className="p-2 bg-[var(--color-bg-primary)] border border-[var(--color-bg-border)] rounded-lg flex items-center justify-between">
                        <span className="font-bold uppercase tracking-tight text-[10px]">{team.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="!text-[9px]">{memberCount} Members</Badge>
                          <button 
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Decommission team?',
                                  message: 'Are you sure you want to decommission this workgroup/team?',
                                  confirmLabel: 'Decommission',
                                  type: 'danger',
                                });
                                if (!ok) return;
                                try {
                                  await deleteTeamMutation.mutateAsync(team._id);
                                } catch (err) {
                                  console.error(err);
                                  alert(`Team removal error: ${err.message}`);
                                }
                              }}
                            disabled={deleteTeamMutation.isPending}
                            className="text-rose-500 hover:text-rose-600 transition-colors p-1"
                            title="Delete Team"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                     </div>
                   );
                 })}
              </div>
            </Card>
          </aside>
        )}
      </div>

      {/* User Management Workspace */}
      <FullScreenWorkspace
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={['System ID:', selectedUser?._id?.substring(0, 8), '• Role:', selectedUser?.role?.toUpperCase()].join(' ')}
        onSave={handleSaveUser}
        isSaving={updateUserMutation.isPending}
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
                   onChange={e => setEditUserData({...editUserData, name: e.target.value})} 
                 />
                 <Input 
                   label="Email Address" 
                   value={editUserData.email || ''} 
                   onChange={e => setEditUserData({...editUserData, email: e.target.value})} 
                 />
                 <Input 
                   label="Phone Number" 
                   placeholder="No phone listed" 
                   value={editUserData.phone || ''} 
                   onChange={e => setEditUserData({...editUserData, phone: e.target.value})} 
                 />
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Role</label>
                    <select 
                      value={editUserData.role || 'user'}
                      onChange={e => setEditUserData({...editUserData, role: e.target.value})}
                      className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                    >
                       <option value="admin">Administrator</option>
                       <option value="artist_management">Artist Management</option>
                       <option value="operations">Operations</option>
                       <option value="sales">Sales Rep</option>
                       <option value="user">Standard User</option>
                    </select>
                 </div>
              </div>
           </section>

           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <Shield size={14} /> Assigned Workgroups
              </h3>
              <div className="grid grid-cols-3 gap-3">
                 {teams.map(t => {
                   const isAssigned = editUserData.teams?.includes(t.name);
                   return (
                     <Card 
                       key={t._id} 
                       onClick={() => {
                         const currentTeams = editUserData.teams || [];
                         const nextTeams = isAssigned 
                           ? currentTeams.filter(name => name !== t.name)
                           : [...currentTeams, t.name];
                         setEditUserData(prev => ({ ...prev, teams: nextTeams }));
                       }}
                       className={`p-3 cursor-pointer transition-all border ${isAssigned ? 'bg-[var(--color-bg-secondary)] border-[var(--color-action-primary)]' : 'bg-[var(--color-bg-primary)] border-[var(--color-bg-border)] opacity-60'}`}
                     >
                       <p className="text-[10px] font-black uppercase tracking-tight">{t.name}</p>
                       <p className="text-[8px] font-bold text-[var(--color-text-muted)] mt-1">{isAssigned ? 'Assigned (Click to Remove)' : 'Click to Assign'}</p>
                     </Card>
                   );
                 })}
              </div>
           </section>
        </div>
      </FullScreenWorkspace>
    </PageContainer>
  );
};

export default AdminPanel;
