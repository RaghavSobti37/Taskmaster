// UDIF 2.0 - Admin Control Center
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldCheck, Send, XCircle, Eye, Zap, Play, Settings, Plus, Users, 
  Search, PlusCircle, Database, Phone, UserCheck, TrendingUp, FileBarChart,
  X, Trash2, MoreVertical, Edit2, ShieldAlert, Activity, Clock, Shield, LogIn
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
import { 
  useUserDirectory, useTeams, useCRMStats, useRepSummary, useMailStats, useLogs, useUpdateUser, useCreateTeam 
} from '../../hooks/useTaskmasterQueries';

const AdminPanel = () => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: teams = [] } = useTeams();
  const { data: crmStats } = useCRMStats();
  const { data: repSummary } = useRepSummary();
  const { data: mailStats } = useMailStats();
  const { data: allLogs = [] } = useLogs('all', 100);

  const updateUserMutation = useUpdateUser();
  const createTeamMutation = useCreateTeam();

  useEffect(() => {
    if (selectedUser) {
      setEditUserData({
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
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
      alert(err.response?.data?.error || err.message);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await createTeamMutation.mutateAsync({ name: newTeamName.trim(), description: 'Workgroup' });
      setNewTeamName('');
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const loginAlerts = useMemo(() => {
    return allLogs
      .filter(log => log.action === 'LOGIN' && isToday(new Date(log.createdAt)))
      .slice(0, 5);
  }, [allLogs]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const userColumns = [
    { 
      header: 'User', 
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] overflow-hidden shrink-0">
            {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">{u.name.substring(0, 2)}</div>}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-tight truncate">{u.name}</p>
            <p className="text-[9px] text-[var(--color-text-muted)] font-bold truncate">{u.email}</p>
          </div>
        </div>
      )
    },
    { 
      header: 'Role', 
      info: 'Privilege levels define what system areas this user can modify.',
      render: (u) => (
        <Badge variant={u.role === 'admin' ? 'danger' : u.role === 'sales' ? 'warning' : 'info'}>
          {u.role}
        </Badge>
      )
    },
    { 
      header: 'Activity', 
      info: 'Status is tracked in real-time based on session signals.',
      render: (u) => (
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600">Active</span>
        </div>
      )
    }
  ];

  if (usersLoading && users.length === 0) return <PageSkeleton />;

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader 
         title="Admin Panel" 
         subtitle="Manage users, teams, and system data."
         icon={ShieldCheck}
         actions={
           <div className="flex items-center gap-2">
             <TabSwitcher 
               activeTab={activeTab} 
               onChange={setActiveTab} 
               tabs={[
                 { id: 'users', label: 'Users' }, 
                 { id: 'teams', label: 'Teams' },
                 { id: 'crm', label: 'All Data' },
                 { id: 'logs', label: 'Logs' },
                 { id: 'mail', label: 'Emails' }
               ]} 
             />
           </div>
         }
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatCard 
          label="Total Users" 
          value={users.length} 
          icon={Users} 
          variant="info" 
          subValue="Active" 
          info="Current total of registered system personnel across all roles."
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
          info="Total signals dispatched by the platform communication engine."
        />
      </div>

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
          </>
        }
      >
        <div className="space-y-8">
           <section>
              <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4 flex items-center gap-2">
                 <UserCheck size={14} /> Personnel Data
              </h3>
              <div className="grid grid-cols-2 gap-6">
                 <Input 
                   label="Full Identity" 
                   value={editUserData.name || ''} 
                   onChange={e => setEditUserData({...editUserData, name: e.target.value})} 
                 />
                 <Input 
                   label="Communication Link (Email)" 
                   value={editUserData.email || ''} 
                   onChange={e => setEditUserData({...editUserData, email: e.target.value})} 
                 />
                 <Input 
                   label="Direct Line (Phone)" 
                   placeholder="No phone listed" 
                   value={editUserData.phone || ''} 
                   onChange={e => setEditUserData({...editUserData, phone: e.target.value})} 
                 />
                 <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block">Access Privilege</label>
                    <select 
                      value={editUserData.role || 'user'}
                      onChange={e => setEditUserData({...editUserData, role: e.target.value})}
                      className="w-full px-3 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-bg-border)] rounded-[var(--radius-atomic)] text-sm outline-none"
                    >
                       <option value="admin">Administrator</option>
                       <option value="sales">Sales Executive</option>
                       <option value="user">General Staff</option>
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
