// UDIF 2.0 - Admin Control Center
import React, { useState, useEffect, useMemo } from 'react';
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
import { AdminLogsContent } from './AdminLogsPage';
import TscDataContent from '../../components/admin/TscDataContent';
import AdminMailContent from '../../components/admin/AdminMailContent';
import WorkflowCanvas from '../productivity/WorkflowCanvas';
import { 
  useUserDirectory, useTeams, useCRMStats, useRepSummary, useMailStats, useLogs, useUpdateUser, useDeleteUser, useCreateTeam 
} from '../../hooks/useTaskmasterQueries';

const AdminPanel = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };
  
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: teams = [] } = useTeams();
  const { data: crmStats } = useCRMStats();
  const { data: repSummary } = useRepSummary();
  const { data: mailStats } = useMailStats();
  const { data: allLogs = [] } = useLogs('all', 100);

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createTeamMutation = useCreateTeam();

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

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    try {
      await updateUserMutation.mutateAsync({
        id: selectedUser._id,
        data: editUserData
      });
      setSelectedUser(null);
    } catch (err) {
      alert('Failed to update user: ' + err.message);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to permanently remove this user account?")) return;
    try {
      await deleteUserMutation.mutateAsync(userId);
      setSelectedUser(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName) return;
    try {
      await createTeamMutation.mutateAsync({ name: newTeamName });
      setNewTeamName('');
    } catch (err) {
      alert('Failed to create team: ' + err.message);
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
    }
  ];

  const pageMeta = {
    users: { title: "Users", subtitle: "Manage system access credentials, security profiles, and registered personnel." },
    teams: { title: "Teams", subtitle: "Organize personnel into functional task forces and operational teams." },
    workflows: { title: "Workflows", subtitle: "Configure intelligent triggers, automated sequences, and system logic." },
    crm: { title: "All Data", subtitle: "Inspect, filter, and export all unified customer and engagement records." },
    logs: { title: "System Logs", subtitle: "Review chronological activity trails, security events, and system transactions." },
    mail: { title: "Email Campaigns", subtitle: "Manage SMTP profiles, email campaigns, and delivery analytics." }
  };

  const currentMeta = pageMeta[activeTab] || { title: "Admin Panel", subtitle: "Manage users, teams, automation workflows, and system data." };

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
                 { id: 'teams', label: 'Teams' },
                 { id: 'workflows', label: 'Workflows' },
                 { id: 'crm', label: 'All Data' },
                 { id: 'logs', label: 'Logs' },
                 { id: 'mail', label: 'Emails' }
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
                  {activeTab === 'workflows' && (
                    <div className="min-h-fit p-2">
                      <WorkflowCanvas />
                    </div>
                  )}
                  {activeTab === 'crm' && <TscDataContent />}
                  {activeTab === 'logs' && <AdminLogsContent />}
                  {activeTab === 'mail' && <AdminMailContent />}
                  {activeTab === 'teams' && (
                    <div className="p-8 space-y-6">
                       <div className="flex gap-4 items-end">
                          <div className="flex-1">
                            <Input 
                              placeholder="New team name..." 
                              value={newTeamName} 
                              onChange={e => setNewTeamName(e.target.value)} 
                            />
                          </div>
                          <Button onClick={handleCreateTeam} disabled={createTeamMutation.isPending || !newTeamName.trim()}>Create Team</Button>
                       </div>
                       <div className="grid grid-cols-1 gap-3">
                          {teams.map(team => {
                            const memberCount = users.filter(u => u.teams?.includes(team.name)).length;
                            return (
                              <div key={team._id} className="p-4 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-xl flex items-center justify-between">
                                 <span className="font-bold uppercase tracking-tight text-xs">{team.name}</span>
                                 <Badge variant="info">{memberCount} Members</Badge>
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </Card>
        </div>

        {activeTab === 'users' && (
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
        )}
      </div>

      {/* User Management Workspace */}
      <FullScreenWorkspace
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || 'User Profile'}
        subtitle={`System ID: ${selectedUser?._id?.substring(0, 8)} • Role: ${selectedUser?.role?.toUpperCase()}`}
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
