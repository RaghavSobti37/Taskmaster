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
  TabSwitcher, 
  Button, 
  DataTable,
  ProgressBar,
  PageSkeleton,
  Input,
  FullScreenWorkspace,
  InfoButton,
  ListPageLayout,
  SearchInput,
  UserAvatar,
} from '../../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, isToday } from 'date-fns';
import { DataHubContent } from './DataHubPage';
import {
  useUserDirectory, useTeams, useCRMStats, useMailStats, useDataHubFolders, useUpdateUser, useDeleteUser, useCreateTeam, useDeleteTeam, usePlatformExclusions
} from '../../hooks/useTaskmasterQueries';
import {
  ADMIN_RIBBON_QUERY_OPTS,
  ADMIN_DATA_HUB_FOLDER_OPTS,
  getTeamConversionPercent,
  getTotalDataRecords,
} from '../../utils/adminRibbonMetrics';
import { useConfirm } from '../../contexts/confirmContext';
import { useToast } from '../../contexts/ToastContext';
import { stableJsonEqual } from '../../hooks/useUnsavedChanges';
import { useAuth } from '../../contexts/AuthContext';
import { getDeleteUserBlockReason } from '../../utils/rootAdminEmails';
import UserDeleteAction from '../../components/admin/UserDeleteAction';

const AdminPanel = () => {
  const { confirm } = useConfirm();
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');
  const [searchTerm, setSearchTerm] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [editUserBaseline, setEditUserBaseline] = useState(null);

  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  }, [setSearchParams]);
  
  const { data: users = [], isLoading: usersLoading } = useUserDirectory();
  const { data: teams = [] } = useTeams();
  const { data: crmStats } = useCRMStats(true, ADMIN_RIBBON_QUERY_OPTS);
  const { data: mailStats } = useMailStats(true, ADMIN_RIBBON_QUERY_OPTS);
  const { data: folderData } = useDataHubFolders(ADMIN_DATA_HUB_FOLDER_OPTS);
  const { data: platformExclusions = {} } = usePlatformExclusions();

  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const createTeamMutation = useCreateTeam();
  const deleteTeamMutation = useDeleteTeam();

  useEffect(() => {
    if (selectedUser) {
      const loaded = {
        name: selectedUser.name || '',
        email: selectedUser.email || '',
        phone: selectedUser.phone || '',
        role: selectedUser.role || 'user',
        teams: selectedUser.teams || [],
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
    try {
      await updateUserMutation.mutateAsync({
        id: selectedUser._id,
        data: editUserData
      });
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || err.message || 'Failed to update user');
    }
  }, [selectedUser, editUserData, updateUserMutation, toast]);

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
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  }, [confirm, deleteUserMutation, toast]);

  const getDeleteBlockReason = useCallback(
    (targetUser) => getDeleteUserBlockReason(currentUser, targetUser, platformExclusions),
    [currentUser, platformExclusions]
  );

  const handleCreateTeam = useCallback(async () => {
    if (!newTeamName) return;
    try {
      await createTeamMutation.mutateAsync({ name: newTeamName });
      setNewTeamName('');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to create team');
    }
  }, [newTeamName, createTeamMutation, toast]);

  const pageMeta = {
    users: { title: 'Users & Teams' },
    crm: { title: 'Data Hub' },
  };

  const showRibbon = activeTab === 'users' || activeTab === 'teams';

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

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
      sortKey: 'lastOnline',
      sortFn: (u) => (u.lastOnline ? new Date(u.lastOnline) : null),
      render: (u) => (
        <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
          {u.lastOnline ? format(new Date(u.lastOnline), 'MMM dd, yyyy h:mm a') : 'No record'}
        </span>
      )
    },
  ];

  const currentMeta = pageMeta[activeTab] || { title: 'Admin Panel' };

  if (usersLoading) return <PageSkeleton />;

  return (
    <ListPageLayout
      containerClassName="!py-4"
      title={currentMeta.title}
      icon={ShieldCheck}
      overview={
        showRibbon
          ? {
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
              charts: [],
            }
          : undefined
      }
      toolbar={
        showRibbon ? (
          <SearchInput
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="!w-44 shrink min-w-[9rem]"
          />
        ) : null
      }
      toolbarActions={
        <TabSwitcher
          activeTab={activeTab}
          onChange={handleTabChange}
          tabs={[
            { id: 'users', label: 'Users' },
            { id: 'crm', label: 'Data Hub' },
          ]}
        />
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={activeTab === 'users' ? 'lg:col-span-8' : 'lg:col-span-12'}>
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
                  onRowClick={(u) => setSelectedUser(u)}
                />
              )}
              {activeTab === 'crm' && <DataHubContent />}
            </motion.div>
          </AnimatePresence>
        </div>

        {activeTab === 'users' && (
          <aside className="lg:col-span-4 space-y-6">
            <div className="p-4 border border-[var(--color-bg-border)] space-y-4">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Users size={14} className="text-[var(--color-action-primary)]" />
                    <h4 className="tm-widget-label">Teams & Workgroups</h4>
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
                                  toast.error(err.response?.data?.error || err.message || 'Failed to remove team');
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
            </div>
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
        onCancel={handleRevertUserEdits}
        hasChanges={hasUserChanges}
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
            <div className="p-4 border border-rose-500/30 space-y-3">
               <h4 className="tm-widget-label text-rose-500">Delete User</h4>
               {getDeleteBlockReason(selectedUser) && (
                 <p className="text-[10px] text-[var(--color-text-muted)] mb-3">{getDeleteBlockReason(selectedUser)}</p>
               )}
               <UserDeleteAction
                 blockReason={getDeleteBlockReason(selectedUser)}
                 isPending={deleteUserMutation.isPending}
                 onDelete={() => handleDeleteUser(selectedUser._id)}
               />
            </div>
            <div className="p-4 border-b border-[var(--color-bg-border)] space-y-4">
               <h4 className="tm-widget-label">Activity Trail</h4>
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
            </div>
            <div className="p-4 space-y-4">
               <h4 className="tm-widget-label">Security Configuration</h4>
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
            </div>
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
                     <div 
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
                     </div>
                   );
                 })}
              </div>
           </section>
        </div>
      </FullScreenWorkspace>
    </ListPageLayout>
  );
};

export default AdminPanel;
