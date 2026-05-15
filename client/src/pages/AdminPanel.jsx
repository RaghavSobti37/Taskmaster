import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Fingerprint, ShieldAlert, ShieldCheck,
  Mail as MailIcon, Send, XCircle, Eye, Zap, Play, Settings, Plus, Users, 
  Search, PlusCircle, Database, Phone, UserCheck, TrendingUp, FileBarChart,
  X, Trash2
} from 'lucide-react';
import { Badge, NexusModal, PageHeader, TabSwitcher, PageContainer, Card } from '../components/ui';
import { useSearchParams, useNavigate } from 'react-router-dom';
import CKDropdown from '../components/ui/CKDropdown';
import { format } from 'date-fns';
import { AdminLogsContent } from './AdminLogsPage';
import { 
  useUserDirectory, useTeams, useTasks, useLogs, 
  useCRMImports, useCRMStats, useRepSummary, useMailStats,
  useMailCampaigns, useMailProfiles 
} from '../hooks/useTaskmasterQueries';

const AdminSkeleton = () => (
  <div className="space-y-8 animate-pulse">
    <div className="flex justify-between items-center">
      <div className="h-8 w-48 bg-slate-200 rounded" />
      <div className="h-10 w-32 bg-slate-200 rounded-xl" />
    </div>
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-8 h-[600px] bg-slate-100 rounded-[2.5rem]" />
      <div className="col-span-4 space-y-8">
        <div className="h-48 bg-slate-100 rounded-[2rem]" />
        <div className="h-[400px] bg-slate-100 rounded-[2rem]" />
      </div>
    </div>
  </div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, color }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className={`p-3 rounded-2xl ${color} bg-white shadow-lg border border-slate-100`}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
    <div>
      <h3 className="text-sm font-black uppercase tracking-tight italic text-slate-900">{title}</h3>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</p>
    </div>
  </div>
);

const UserDetailModal = ({ user, onClose, onRoleChange, onDelete, allTeams, onTeamsChange }) => {
  const [userTasks, setUserTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const tasksRes = await axios.get('/api/tasks');
        setUserTasks(tasksRes.data.filter(t => t.assignees?.includes(user._id)));
      } catch (err) {
        console.error('Error fetching user details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserDetails();
  }, [user]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-bg-surface)] w-full max-w-4xl rounded-[3rem] border border-[var(--color-bg-border)] shadow-[0_32px_64px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh]">
        <header className="p-10 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-[1.5rem] bg-blue-600 flex items-center justify-center text-2xl font-black text-white shadow-2xl shadow-blue-500/30 overflow-hidden ring-4 ring-[var(--color-bg-surface)]">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--color-text-primary)] tracking-tight">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1.5">
                <Badge variant={user.role === 'admin' ? 'progress' : 'todo'}>{user.role.toUpperCase()}</Badge>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 font-black uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Active Session
                </div>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[var(--color-bg-workspace)] rounded-2xl transition-all border border-transparent hover:border-[var(--color-bg-border)] text-[var(--color-text-muted)]"><X size={20} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-8">
            <section className="p-8 bg-[var(--color-bg-workspace)]/30 rounded-[2.5rem] border border-[var(--color-bg-border)] space-y-6">
              <SectionHeader icon={Fingerprint} title="User Details" subtitle="Core info" color="text-blue-500" />
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] shadow-sm">
                  <MailIcon size={16} className="text-blue-500" />
                  <span className="text-xs font-black text-[var(--color-text-primary)]">{user.email}</span>
                </div>
                <div className="space-y-2 px-1">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Team Access</label>
                  <CKDropdown multi options={allTeams.map(t => ({ value: t.name, label: t.name }))} value={user.teams || []} onChange={(newTeams) => onTeamsChange(user._id, newTeams)} />
                </div>
              </div>
            </section>
            <section className="p-8 bg-rose-500/5 rounded-[2.5rem] border border-rose-500/10 space-y-6">
              <SectionHeader icon={ShieldAlert} title="Permissions" subtitle="Access control" color="text-rose-500" />
              <div className="grid grid-cols-3 gap-2">
                {['user', 'sales', 'admin'].map(r => (
                  <button key={r} onClick={() => onRoleChange(user._id, r)} className={`py-3 rounded-2xl text-[10px] font-black uppercase border transition-all ${user.role === r ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-rose-300'}`}>{r}</button>
                ))}
              </div>
              <button onClick={() => setShowDeleteModal(true)} className="w-full py-4 bg-[var(--color-bg-surface)] border border-rose-500/20 text-rose-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-3 shadow-sm active:scale-95"><Trash2 size={16} /> Delete User</button>
            </section>
          </div>
          <div className="lg:col-span-7">
            <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] overflow-hidden shadow-sm flex flex-col h-full">
              <div className="px-8 py-5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/30 flex items-center justify-between">
                <h3 className="font-black text-xs uppercase tracking-[0.2em] italic text-[var(--color-text-primary)]">Assigned Tasks</h3>
                <Badge variant="todo">{userTasks.length} Tasks</Badge>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {userTasks.length === 0 ? (
                  <div className="p-20 text-center opacity-20"><Zap size={48} className="mx-auto mb-4 text-[var(--color-text-muted)]" /><p className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">No Active Tasks</p></div>
                ) : (
                  <div className="divide-y divide-[var(--color-bg-border)]">
                    {userTasks.map(task => (
                      <div key={task._id} className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-workspace)] transition-all group">
                        <div className="flex items-center gap-4">
                          <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                          <span className="text-xs font-black text-[var(--color-text-primary)] tracking-tight">{task.title}</span>
                        </div>
                        <Badge variant={task.status}>{task.status.toUpperCase()}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
        <NexusModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Security Action" message={`Confirm permanent deletion of ${user.name}? This cannot be undone.`} type="danger" isConfirm onConfirm={() => onDelete(user._id)} />
      </motion.div>
    </motion.div>
  );
};

const EmailMarketingContent = ({ stats, campaigns, profiles, onRefresh }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ title: '', subject: '', content: '', senderProfileId: '' });

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/mail/profiles', newProfile);
      setShowProfileModal(false);
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const leadsRes = await axios.get('/api/crm/leads', { params: { limit: 10 } });
      const leadIds = leadsRes.data.leads.map(l => l._id);
      await axios.post('/api/mail/campaigns', { ...newCampaign, leadIds });
      setShowCampaignModal(false);
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleSend = async (id) => {
    try {
      await axios.post(`/api/mail/campaigns/${id}/send`);
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const metrics = [
    { label: 'Active Campaigns', value: stats.totalCampaigns, icon: MailIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Emails Sent', value: stats.totalSent, icon: Send, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Bounced Emails', value: stats.totalBounced, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Opened Emails', value: stats.totalOpened, icon: Eye, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <Card key={i} className="p-8 border-none bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-24 h-24 ${m.bg} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="flex items-center gap-5 relative z-10">
              <div className={`p-4 rounded-[1.25rem] ${m.bg} ${m.color} shadow-lg shadow-black/5 border border-white`}><m.icon size={24} strokeWidth={2.5} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{m.label}</p>
                <h4 className="text-2xl font-black text-slate-900">{m.value}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 space-y-6">
          <Card className="overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20"><Zap size={20} strokeWidth={2.5} /></div>
                <div>
                  <h3 className="text-base font-black uppercase italic tracking-tight text-[var(--color-text-primary)]">Email Campaigns</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manage your mailings</p>
                </div>
              </div>
              <button onClick={() => setShowCampaignModal(true)} className="px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 transition-all active:scale-95">New Campaign</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 border-b bg-slate-50/30">
                  <tr><th className="px-10 py-5">Campaign Name</th><th className="px-10 py-5 text-center">Status</th><th className="px-10 py-5 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {campaigns.map(c => (
                    <tr key={c._id} className="hover:bg-blue-50/30 transition-all group">
                      <td className="px-10 py-6"><p className="text-xs font-black uppercase italic tracking-tight text-slate-800">{c.title}</p></td>
                      <td className="px-10 py-6 text-center"><Badge variant={c.status === 'Completed' ? 'done' : 'progress'}>{c.status.toUpperCase()}</Badge></td>
                      <td className="px-10 py-6 text-right">
                        <button disabled={c.status === 'Sending' || c.status === 'Completed'} onClick={() => handleSend(c._id)} className="p-3 bg-white border border-slate-100 text-blue-600 rounded-2xl shadow-sm hover:border-blue-500 hover:bg-blue-500 hover:text-white disabled:opacity-30 transition-all active:scale-90"><Play size={16} fill="currentColor" /></button>
                      </td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && (
                    <tr><td colSpan="3" className="p-20 text-center opacity-30"><MailIcon size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase">No Active Campaigns</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-10 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <SectionHeader icon={Settings} title="Email Senders" subtitle="Configure profiles" color="text-slate-900" />
            <div className="space-y-4">
              {profiles.map(p => (
                <div key={p._id} className="p-5 bg-slate-50 rounded-[1.5rem] border border-slate-100 flex items-center gap-5 group hover:border-blue-500/50 transition-all">
                  <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 font-black text-xs shadow-sm border border-slate-100">{p.name.substring(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0"><p className="text-[11px] font-black uppercase truncate text-slate-800">{p.name}</p><p className="text-[9px] font-bold text-slate-400 truncate tracking-tight">{p.email}</p></div>
                </div>
              ))}
              <button onClick={() => setShowProfileModal(true)} className="w-full py-4 border-2 border-dashed border-slate-100 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 hover:border-blue-500 hover:text-blue-500 transition-all bg-slate-50/50">Add Sender</button>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3b82f6');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, importId: null, count: 0, reason: '' });
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Optimized React Query Hooks
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useUserDirectory();
  const { data: teamsData, refetch: refetchTeams } = useTeams();
  const { data: tasksData } = useTasks();
  const { data: logsData, refetch: refetchLogs } = useLogs('all', 200, activeTab === 'users' || activeTab === 'logs');
  const { data: repSummaryData } = useRepSummary(activeTab === 'crm');
  const { data: crmStatsData, refetch: refetchCRMStats } = useCRMStats(activeTab === 'crm');
  const { data: crmImportsData, refetch: refetchImports } = useCRMImports(activeTab === 'crm');
  const { data: mailStatsData, refetch: refetchMail } = useMailStats(activeTab === 'mail');
  const { data: mailCampaignsData } = useMailCampaigns(activeTab === 'mail');
  const { data: mailProfilesData } = useMailProfiles(activeTab === 'mail');

  const users = usersData || [];
  const teams = teamsData || [];
  const logs = logsData || [];
  const crmTotals = crmStatsData || { total: 0, connected: 0, meaningful: 0, converted: 0 };
  const repSummary = repSummaryData || [];
  const crmImports = crmImportsData || [];
  const mailStats = mailStatsData || { totalCampaigns: 0, totalSent: 0, totalOpened: 0, totalBounced: 0 };
  const campaigns = mailCampaignsData || []; 
  const profiles = mailProfilesData || []; 

  const filteredUsers = useMemo(() => 
    users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase())),
    [users, searchTerm]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/users/${userId}/role`, { role: newRole });
      refetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleTeamsChange = async (userId, newTeams) => {
    try {
      await axios.put(`/api/users/${userId}/teams`, { teams: newTeams });
      refetchUsers();
    } catch (err) { console.error(err); }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      await axios.post('/api/teams', { name: newTeamName.toUpperCase(), color: newTeamColor });
      setNewTeamName('');
      refetchTeams();
    } catch (err) { console.error(err); }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setModalConfig({ isOpen: true, title: 'Importing', message: 'Uploading leads...', type: 'info' });
      await axios.post('/api/crm/leads/upload', formData);
      setModalConfig({ isOpen: true, title: 'Success', message: 'Leads imported successfully!', type: 'success' });
      refetchImports();
      refetchCRMStats();
    } catch (err) { 
      setModalConfig({ isOpen: true, title: 'Error', message: err.response?.data?.error || 'Import failed.', type: 'danger' });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      setSelectedUser(null);
      refetchUsers();
    } catch (err) { console.error(err); }
  };

  if (usersLoading && users.length === 0) return <PageContainer><AdminSkeleton /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader 
         icon={ShieldCheck} 
         title="Admin Dashboard" 
         subtitle="Manage users, leads, and emails."
         actions={<TabSwitcher activeTab={activeTab} onChange={setActiveTab} tabs={[{ id: 'users', label: 'Users' }, { id: 'crm', label: 'CRM' }, { id: 'mail', label: 'Mail' }, { id: 'logs', label: 'Logs' }]} />} 
      />

      {/* Tab Visibility System - Zero Remounting */}
      <div className={activeTab === 'users' ? 'block' : 'hidden'}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <main className="lg:col-span-8 space-y-10">
            <Card className="flex flex-col min-h-[600px] border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-2xl"><Users size={20} strokeWidth={2.5} /></div>
                  <div>
                    <h3 className="text-base font-black uppercase italic tracking-tight text-[var(--color-text-primary)]">User Directory</h3>
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Active platform users</p>
                  </div>
                </div>
                <div className="relative w-80 group">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-blue-500 transition-colors" size={16} strokeWidth={2.5} />
                  <input type="text" placeholder="Search Users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:border-blue-500/50 shadow-sm transition-all text-[var(--color-text-primary)]" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[var(--color-bg-workspace)]/30 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.3em] border-b border-[var(--color-bg-border)]">
                    <tr><th className="px-10 py-5">User Identity</th><th className="px-10 py-5 text-center">Role</th><th className="px-10 py-5 text-right">Teams</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredUsers.map(u => (
                      <tr key={u._id} onClick={() => setSelectedUser(u)} className="hover:bg-blue-50/30 transition-all cursor-pointer group">
                        <td className="px-10 py-6 flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-blue-600 flex items-center justify-center font-black text-xs shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">{u.name.substring(0, 2).toUpperCase()}</div>
                          <div><p className="text-xs font-black text-slate-800 tracking-tight">{u.name}</p><p className="text-[10px] text-slate-400 font-bold lowercase tracking-tight">{u.email}</p></div>
                        </td>
                        <td className="px-10 py-6 text-center"><Badge variant={u.role === 'admin' ? 'progress' : 'todo'}>{u.role.toUpperCase()}</Badge></td>
                        <td className="px-10 py-6 text-right"><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{u.teams?.join(', ') || 'UNLINKED'}</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </main>
          <aside className="lg:col-span-4 space-y-10">
            <Card className="p-10 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <SectionHeader icon={PlusCircle} title="Team Management" subtitle="New workgroup" color="text-orange-500" />
              <form onSubmit={handleCreateTeam} className="space-y-4">
                <div className="relative group">
                  <input type="text" placeholder="Team Name..." value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full pl-6 pr-16 py-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl text-[11px] font-black uppercase tracking-widest outline-none focus:border-orange-500/50 shadow-inner text-[var(--color-text-primary)]" />
                  <button type="submit" className="absolute right-2 top-2 p-2.5 bg-orange-500 text-white rounded-xl shadow-lg shadow-orange-500/20 active:scale-90 transition-all"><Plus size={18} strokeWidth={3} /></button>
                </div>
              </form>
              <div className="grid grid-cols-2 gap-3 mt-8">
                {teams.map(t => (
                  <div key={t._id} className="px-4 py-3 bg-white border border-slate-100 border-l-4 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm" style={{ borderLeftColor: t.color }}>
                    {t.name}
                  </div>
                ))}
              </div>
            </Card>
            <Card className="h-[400px] flex flex-col overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="px-8 py-5 border-b border-[var(--color-bg-border)] bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] italic">System Activity</div>
              <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                {logs.slice(0, 20).map(l => (
                  <div key={l._id} className="flex gap-4 group">
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] text-blue-600 flex items-center justify-center text-[9px] font-black shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-all">{l.userId?.name?.substring(0, 2).toUpperCase() || 'SY'}</div>
                    <div className="text-[10px] py-1 leading-relaxed"><span className="font-black text-[var(--color-text-primary)] uppercase italic">{l.userId?.name || 'System'}</span> <span className="text-[var(--color-text-muted)] font-bold lowercase tracking-tight">{l.action.replace(/_/g, ' ')}</span></div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </motion.div>
      </div>

      <div className={activeTab === 'crm' ? 'block' : 'hidden'}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 grid grid-cols-2 gap-6">
              {[{ label: 'Total Leads', val: crmTotals.total, icon: Database, color: 'text-blue-500', bg: 'bg-blue-500/10' }, 
                { label: 'Connected', val: crmTotals.connected, icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }, 
                { label: 'Meaningful', val: crmTotals.meaningful, icon: UserCheck, color: 'text-amber-500', bg: 'bg-amber-500/10' }, 
                { label: 'Converted', val: crmTotals.converted, icon: TrendingUp, color: 'text-rose-500', bg: 'bg-rose-500/10' }].map((s, i) => (
                <Card key={i} className="p-8 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-24 h-24 ${s.bg} blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="flex items-center gap-5 relative z-10">
                    <div className={`p-4 rounded-2xl ${s.bg} ${s.color} shadow-lg shadow-black/5 border border-white`}><s.icon size={24} strokeWidth={2.5} /></div>
                    <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] mb-1">{s.label}</p><p className="text-2xl font-black text-[var(--color-text-primary)]">{s.val}</p></div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="lg:col-span-4">
              <Card className="p-8 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <SectionHeader icon={ShieldCheck} title="Pipeline" subtitle="Conversion flow" color="text-slate-900" />
                <div className="space-y-4 pt-2">
                  {[
                    { label: 'Leads', val: crmTotals.total, color: 'bg-blue-500' },
                    { label: 'Connected', val: crmTotals.connected, color: 'bg-emerald-500' },
                    { label: 'Meaningful', val: crmTotals.meaningful, color: 'bg-amber-500' },
                    { label: 'Converted', val: crmTotals.converted, color: 'bg-rose-500' }
                  ].map((p, i) => {
                    const width = crmTotals.total > 0 ? (p.val / crmTotals.total) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                          <span>{p.label}</span>
                          <span className="text-slate-900">{p.val}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} className={`h-full ${p.color} rounded-full`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-8">
              <Card className="overflow-hidden border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="px-10 py-8 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]/50">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-2xl"><FileBarChart size={20} strokeWidth={2.5} /></div>
                    <div>
                      <h3 className="text-base font-black uppercase italic tracking-tight text-[var(--color-text-primary)]">Lead Imports</h3>
                      <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">History of lead uploads</p>
                    </div>
                  </div>
                  <label className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 transition-all active:scale-95 cursor-pointer">
                    Import Leads
                    <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/30">
                      <tr><th className="px-10 py-5">File Name</th><th className="px-10 py-5 text-center">Leads</th><th className="px-10 py-5 text-right">Date</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {crmImports.map(b => (
                        <tr key={b._id} className="hover:bg-slate-50 transition-all">
                          <td className="px-10 py-6 font-black text-xs uppercase italic tracking-tight text-slate-800">{b.filename}</td>
                          <td className="px-10 py-6 text-center"><Badge variant="progress">{b.leadCount} LEADS</Badge></td>
                          <td className="px-10 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(b.createdAt), 'MMM d, yyyy')}</td>
                        </tr>
                      ))}
                      {crmImports.length === 0 && (
                        <tr><td colSpan="3" className="p-20 text-center opacity-30"><Database size={48} className="mx-auto mb-4" /><p className="text-[10px] font-black uppercase">No Imports Found</p></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
            <div className="lg:col-span-4">
              <Card className="p-8 border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-full">
                <SectionHeader icon={TrendingUp} title="Performance" subtitle="Rep conversions" color="text-blue-500" />
                <div className="space-y-6">
                  {repSummary.slice(0, 5).map((rep, i) => {
                    const conversionRate = rep.count > 0 ? (rep.conv / rep.count) * 100 : 0;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
                          <span className="text-slate-700">{rep.name}</span>
                          <span className="text-blue-500">{Math.round(conversionRate)}%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${conversionRate}%` }} 
                            className="h-full bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" 
                          />
                        </div>
                        <div className="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          <span>{rep.count} Leads</span>
                          <span>{rep.conv} Converted</span>
                        </div>
                      </div>
                    );
                  })}
                  {repSummary.length === 0 && (
                    <div className="py-20 text-center opacity-20"><TrendingUp size={40} className="mx-auto mb-4" /><p className="text-[9px] font-black uppercase">No Sales Data</p></div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>

      <div className={activeTab === 'mail' ? 'block' : 'hidden'}>
        <EmailMarketingContent stats={mailStats} campaigns={campaigns} profiles={profiles} onRefresh={refetchMail} />
      </div>

      <div className={activeTab === 'logs' ? 'block' : 'hidden'}>
        <AdminLogsContent />
      </div>

      <AnimatePresence>
        {selectedUser && <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} onRoleChange={handleRoleChange} onDelete={handleDeleteUser} allTeams={teams} onTeamsChange={handleTeamsChange} />}
      </AnimatePresence>
      <NexusModal isOpen={modalConfig.isOpen} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} />
    </PageContainer>
  );
};

export default AdminPanel;
