import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  Activity,
  Send,
  Database,
  FileJson,
  Database as DbIcon,
  TrendingUp,
  BarChart3,
  Phone,
  UserCheck,
  FileBarChart,
  Circle,
  X,
  Mail,
  UserCog,
  Trash2,
  Trash,
  Plus,
  AlertTriangle,
  RefreshCw,
  Upload,
  Download,
  FileText,
  PlusCircle,
  Settings,
  Mail as MailIcon,
  Server,
  Zap,
  BarChart,
  Eye,
  MousePointer2,
  XCircle,
  Play
} from 'lucide-react';
import { Badge, NexusModal, ProgressBar, PageHeader, TabSwitcher, PageContainer, Card } from '../components/ui';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import CKDropdown from '../components/ui/CKDropdown';
import { format } from 'date-fns';
import { getRepName } from '../utils/crmUtils';
import { AdminLogsContent } from './AdminLogsPage';



const UserDetailModal = ({ user, onClose, onRoleChange, onDelete, allTeams, onTeamsChange }) => {
  const [userTasks, setUserTasks] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const [tasksRes, logsRes] = await Promise.all([
          axios.get('/api/tasks'),
          axios.get(`/api/logs?userId=${user._id}`)
        ]);
        setUserTasks(tasksRes.data.filter(t => t.assignees?.includes(user._id)));
        setUserLogs(logsRes.data.filter(l => l.userId?._id === user._id));
      } catch (err) {
        console.error('Error fetching user details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserDetails();
  }, [user]);

  const handleDelete = () => setShowDeleteModal(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[var(--color-bg-surface)] w-full max-w-4xl rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="p-8 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-action-primary)] flex items-center justify-center text-xl font-black text-white shadow-xl shadow-blue-500/20 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-black text-[var(--color-text-primary)]">{user.name}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <Badge variant={user.role === 'admin' ? 'progress' : 'todo'}>{user.role.toUpperCase()}</Badge>
                <span className="text-[10px] text-[var(--color-text-muted)] font-bold flex items-center gap-1">
                  <Circle size={4} className={user.online ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  {user.online ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-all" aria-label="Close user details">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <section className="p-6 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[var(--color-action-primary)]" />
                  <span className="text-[11px] font-bold">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[var(--color-action-primary)]" />
                  <span className="text-[11px] font-bold">{user.phone || 'Not set'}</span>
                </div>
                <div className="space-y-1.5 pt-1.5">
                  <label className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Teams</label>
                  <CKDropdown
                    multi
                    placeholder="Assign..."
                    options={allTeams.map(t => ({ value: t.name, label: t.name }))}
                    value={user.teams || []}
                    onChange={(newTeams) => onTeamsChange(user._id, newTeams)}
                  />
                </div>
              </div>
            </section>

            <section className="p-6 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] space-y-3">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Actions</h3>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Access Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['user', 'sales', 'admin'].map(r => (
                    <button
                      key={r}
                      onClick={() => onRoleChange(user._id, r)}
                      className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${user.role === r
                        ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] text-[var(--color-text-muted)] hover:border-blue-500/50'
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleDelete}
                className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Delete User
              </button>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[var(--color-bg-border)] bg-black/5 flex items-center justify-between">
                <h3 className="font-bold text-[10px] uppercase tracking-widest">Active Tasks</h3>
                <Badge variant="todo">{userTasks.length} Tasks</Badge>
              </div>
              <div className="divide-y divide-[var(--color-bg-border)] max-h-[250px] overflow-y-auto">
                {userTasks.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-[var(--color-text-muted)] italic">No tasks assigned.</div>
                ) : userTasks.map(task => (
                  <div key={task._id} className="p-3.5 flex items-center justify-between hover:bg-black/5 transition-all">
                    <span className="text-[11px] font-bold">{task.title}</span>
                    <Badge variant={task.status}>{task.status}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <NexusModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete User"
          message={`Are you sure you want to PERMANENTLY DELETE user ${user.name}? This action cannot be undone.`}
          type="danger"
          isConfirm
          confirmLabel="DELETE"
          onConfirm={() => onDelete(user._id)}
        />
      </motion.div>
    </motion.div>
  );
};

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [crmImports, setCrmImports] = useState([]);
  const [purgeLogs, setPurgeLogs] = useState([]);
  const [stats, setStats] = useState({ totalTasks: 0, activeTasks: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3b82f6');
  const [crmLeads, setCrmLeads] = useState([]);
  const [crmTotals, setCrmTotals] = useState({ total: 0, connected: 0, meaningful: 0, converted: 0 });
  const [repSummary, setRepSummary] = useState([]);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, importId: null, count: 0, reason: '' });
  const [mailStats, setMailStats] = useState({ totalCampaigns: 0, totalSent: 0, totalBounced: 0, totalOpened: 0 });
  const [campaigns, setCampaigns] = useState([]);
  const [profiles, setProfiles] = useState([]);

  const fetchData = async () => {
    try {
      const [usersRes, logsRes, tasksRes, teamsRes, importsRes, purgeRes, leadsRes, statsRes, summaryRes, mailStatsRes, campaignsRes, profilesRes] = await Promise.all([
        axios.get('/api/users/directory'),
        axios.get('/api/logs'),
        axios.get('/api/tasks'),
        axios.get('/api/teams'),
        axios.get('/api/crm/imports'),
        axios.get('/api/crm/purge-logs'),
        axios.get('/api/crm/leads', { params: { limit: 100 } }),
        axios.get('/api/crm/stats'),
        axios.get('/api/crm/rep-summary'),
        axios.get('/api/mail/stats'),
        axios.get('/api/mail/campaigns'),
        axios.get('/api/mail/profiles')
      ]);
      
      setMailStats(mailStatsRes.data);
      setCampaigns(campaignsRes.data);
      setProfiles(profilesRes.data);


      setUsers(usersRes.data.users || []);
      setLogs(logsRes.data);
      setTeams(teamsRes.data);
      setCrmImports(importsRes.data);
      setPurgeLogs(purgeRes.data);
      setCrmLeads(leadsRes.data.leads || []);
      setCrmTotals(statsRes.data);
      setRepSummary(summaryRes.data);
      setLastRefreshed(new Date());


      const activeCount = tasksRes.data.filter(t => t.status === 'in-progress').length;
      setStats({
        totalTasks: tasksRes.data.length,
        activeTasks: activeCount
      });

      const userId = searchParams.get('user');
      if (userId && !selectedUser) {
        const user = usersRes.data.users?.find(u => u._id === userId);
        if (user) setSelectedUser(user);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await axios.put(`/api/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u._id === userId ? res.data : u));
      if (selectedUser?._id === userId) setSelectedUser(res.data);

      setModalConfig({
        isOpen: true,
        title: 'Role Updated',
        message: `Role changed to ${newRole.toUpperCase()}.`,
        type: 'success'
      });
    } catch (err) {
      console.error('Role update error:', err);
      setModalConfig({
        isOpen: true,
        title: 'Update Failed',
        message: err.response?.data?.error || 'Failed to update user role.',
        type: 'danger'
      });
    }
  };

  const handleTeamsChange = async (userId, newTeams) => {
    try {
      const res = await axios.put(`/api/users/${userId}/teams`, { teams: newTeams });
      setUsers(users.map(u => u._id === userId ? res.data : u));
      if (selectedUser?._id === userId) setSelectedUser(res.data);
    } catch (err) {
      console.error('Teams update error:', err);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const res = await axios.post('/api/teams', {
        name: newTeamName.toUpperCase(),
        color: newTeamColor
      });
      setTeams([...teams, res.data]);
      setNewTeamName('');
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: err.response?.data?.error || 'Failed to create team. Please try again.',
        type: 'danger'
      });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      setUsers(users.filter(u => u._id !== userId));
      setSelectedUser(null);
      setSearchParams({});
    } catch (err) {
      console.error('Delete user error:', err);
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    try {
      const res = await axios.post('/api/logs', {
        action: 'CHAT_MESSAGE',
        targetType: 'System',
        details: { message: chatMsg }
      });
      setLogs([res.data, ...logs]);
      setChatMsg('');
    } catch (err) {
      console.error('Chat error:', err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      setLoading(true);
      await axios.post('/api/crm/leads/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchData();
      setModalConfig({ open: true, title: 'Upload Successful', message: 'Leads imported successfully.', type: 'success' });
    } catch (err) {
      setModalConfig({ open: true, title: 'Upload Error', message: err.response?.data?.error || 'File upload failed.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/crm/export?format=csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/crm/export?format=json');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('JSON Export error:', err);
      setModalConfig({ isOpen: true, title: 'Export Failed', message: 'Could not generate JSON export.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImport = async () => {
    if (!deleteModal.reason.trim()) {
      setModalConfig({
        isOpen: true,
        title: 'Reason Required',
        message: 'Please provide a reason before deleting this import batch.',
        type: 'warning'
      });
      return;
    }
    try {
      await axios.delete(`/api/crm/imports/${deleteModal.importId}`, {
        data: { reason: deleteModal.reason }
      });
      setDeleteModal({ isOpen: false, importId: null, count: 0, reason: '' });
      fetchData();
    } catch (err) {
      console.error('Delete import error:', err);
    }
  };

  const handleClearSignals = () => {
    setModalConfig({
      isOpen: true,
      title: 'Clear All Logs',
      message: 'Are you sure you want to clear all activity logs? This cannot be undone.',
      type: 'danger',
      isConfirm: true,
      onConfirm: async () => {
        try {
          await axios.delete('/api/logs/clear');
          setLogs([]);
        } catch (err) {
          console.error('Clear logs error:', err);
        }
      }
    });
  };

  const filteredUsers = useMemo(() =>
    users.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    ), [users, searchTerm]);

  const crmStats = useMemo(() => [
    { label: 'Database', value: crmTotals.total, icon: DbIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Connected', value: crmTotals.connected, icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Meaningful', value: crmTotals.meaningful, icon: UserCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Converted', value: crmTotals.converted, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ], [crmTotals]);

  const repPerformance = useMemo(() => {
    return repSummary.map(s => ({
      id: s.id,
      name: s.name,
      count: s.count,
      conv: s.conv,
      rate: s.rate.toFixed(1)
    }));
  }, [repSummary]);

  const pipelineHealth = useMemo(() => [
    { label: 'Total Base', value: crmTotals.total, percent: 100, color: 'bg-blue-500' },
    { label: 'Connected', value: crmTotals.connected, percent: (crmTotals.connected / crmTotals.total * 100) || 0, color: 'bg-emerald-500' },
    { label: 'Meaningful', value: crmTotals.meaningful, percent: (crmTotals.meaningful / crmTotals.total * 100) || 0, color: 'bg-purple-500' },
    { label: 'Converted', value: crmTotals.converted, percent: (crmTotals.converted / crmTotals.total * 100) || 0, color: 'bg-amber-500' },
  ], [crmTotals]);

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

  if (loading && users.length === 0) return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminSkeleton />
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        icon={ShieldCheck}
        title="Admin Panel"
        actions={
          <TabSwitcher
            activeTab={activeTab}
            onChange={setActiveTab}
            tabs={[
              { id: 'users', label: 'User Directory' },
              { id: 'crm', label: 'CRM Data' },
              { id: 'mail', label: 'Email Studio' },
              { id: 'logs', label: 'Activity Logs' }
            ]}
          />
        }
      />


      {activeTab === 'users' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-8 space-y-8">
              <Card className="overflow-hidden flex flex-col min-h-[600px]">
                <div className="px-6 md:px-8 py-6 md:py-8 border-b border-[var(--color-bg-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-sm"><Activity size={18} md:size={20} strokeWidth={2.5} /></div>
                    <h3 className="text-base md:text-lg font-black tracking-tight text-[var(--color-text-primary)]">User Analytics</h3>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={12} />
                    <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none shadow-inner" />
                  </div>
                </div>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[var(--color-bg-workspace)]/50 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] sticky top-0 z-10 border-b border-[var(--color-bg-border)]">
                      <tr>
                        <th className="px-8 py-5">User</th>
                        <th className="px-8 py-5 text-center">Role</th>
                        <th className="px-8 py-5 text-center">Status</th>
                        <th className="px-8 py-5 text-right">Teams</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-bg-border)]">
                      {filteredUsers.map((u) => (
                        <tr
                          key={u._id}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-blue-500/5 transition-all group cursor-pointer"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-workspace)] flex items-center justify-center text-[10px] font-black border border-[var(--color-bg-border)] group-hover:border-blue-500/30 transition-all">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover rounded-lg" /> : u.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[11px] font-black text-[var(--color-text-primary)] truncate">{u.name}</p>
                                <p className="text-[8px] font-bold text-[var(--color-text-muted)] truncate">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border ${u.role === 'admin' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                              u.role === 'sales' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                                'bg-slate-500/10 text-slate-500 border-slate-500/20'
                              }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <Badge variant={u.online ? 'progress' : 'todo'}>{u.online ? 'ACTIVE' : 'IDLE'}</Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {u.teams?.length > 0 ? u.teams.map(t => (
                                <span key={t} className="px-1.5 py-0.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded text-[7px] font-black uppercase tracking-tighter text-[var(--color-text-muted)] group-hover:border-blue-500/30">
                                  {t}
                                </span>
                              )) : (
                                <span className="text-[7px] font-bold text-[var(--color-text-muted)] uppercase italic">No Teams</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </motion.main>

            <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4 space-y-8 sticky top-8">
              <Card className="overflow-hidden p-6 space-y-4">
                <h3 className="font-black text-[10px] uppercase tracking-widest text-[var(--color-text-primary)]">Teams</h3>
                <form onSubmit={handleCreateTeam} className="relative">
                  <input type="text" placeholder="New team name..." value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full pl-5 pr-20 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest outline-none" />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1.5">
                    <input type="color" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)} className="w-7 h-7 rounded-lg bg-[var(--color-bg-workspace)] border-none cursor-pointer p-0" />
                    <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all" aria-label="Create team"><Plus size={14} strokeWidth={3} /></button>
                  </div>
                </form>
                <div className="grid grid-cols-2 gap-2.5">
                  {teams.map(team => (
                    <div key={team._id} className="px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm" style={{ borderLeft: `3px solid ${team.color || '#3b82f6'}` }}>
                      <span className="truncate" style={{ color: team.color || 'var(--color-text-muted)' }}>{team.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="overflow-hidden h-[400px] flex flex-col">
                <div className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-[10px] uppercase tracking-widest">Activity Feed</h3>
                    <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                  </div>
                  <button onClick={handleClearSignals} className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all" title="Clear All Logs">
                    <Trash size={14} aria-hidden="true" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {logs.slice(0, 20).map(log => (
                    <div key={log._id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex-shrink-0 flex items-center justify-center text-[8px] font-black">
                        {log.userId?.name?.substring(0, 2).toUpperCase() || 'SY'}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] leading-tight font-bold text-[var(--color-text-primary)]">
                          <span className="text-blue-500">{log.userId?.name || 'System'}</span> {log.action.replace('_', ' ')}
                        </p>
                        <p className="text-[8px] text-[var(--color-text-muted)] font-bold">{format(new Date(log.createdAt), 'HH:mm:ss')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.aside>
          </div>

        </>
      ) : activeTab === 'crm' ? (
        <div className="space-y-12">

          {/* Dashboard View Adapted from CRMPage */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {crmStats.map((stat, i) => (
              <div key={i} className="bg-[var(--color-bg-surface)] p-4 rounded-[1.25rem] border border-[var(--color-bg-border)] shadow-xl shadow-black/5 group">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}><stat.icon size={16} /></div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-0.5 truncate">{stat.label}</p>
                    <h2 className="text-lg font-black text-[var(--color-text-primary)] tracking-tighter leading-none">{stat.value}</h2>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-2 bg-[var(--color-bg-surface)] p-10 rounded-[3rem] border border-[var(--color-bg-border)] shadow-2xl">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)] mb-8 flex items-center gap-2">
                <FileBarChart size={18} className="text-blue-500" /> Rep Performance Metrics
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--color-bg-workspace)] border-b border-[var(--color-bg-border)]">
                    <tr>
                      <th className="px-6 py-4 text-left text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Representative</th>
                      <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Units</th>
                      <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Converted</th>
                      <th className="px-6 py-4 text-center text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Efficiency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-bg-border)]">
                    {repPerformance.map(({ id, name, count, conv, rate }) => (
                      <tr key={id} className="hover:bg-[var(--color-bg-workspace)] transition-all">
                        <td className="px-6 py-4"><span className="font-black text-[10px] uppercase tracking-tight italic">{name}</span></td>
                        <td className="px-6 py-4 text-center text-xs font-bold">{count}</td>
                        <td className="px-6 py-4 text-center text-xs font-bold text-amber-500">{conv}</td>
                        <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[9px] font-black border border-blue-500/10">{rate}%</span></td>
                      </tr>
                    )
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-[var(--color-bg-surface)] p-8 rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl flex flex-col">
              <h3 className="text-[10px] font-black uppercase tracking-widest mb-6">Pipeline Health</h3>
              <div className="space-y-6 flex-1">
                {pipelineHealth.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
                      <span>{item.label}</span>
                      <span>{Math.round(item.percent)}%</span>
                    </div>
                    <ProgressBar progress={item.percent} color={item.color} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <section className="bg-[var(--color-bg-surface)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[var(--color-bg-border)] shadow-xl space-y-6 md:space-y-8 flex flex-col">
              <div className="flex items-center gap-4">
                <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-xl md:rounded-2xl text-blue-500"><Upload size={20} md:size={24} /></div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tight italic">Upload Data</h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Import CSV Files</p>
                </div>
              </div>
              <label className="group relative block w-full flex-1 min-h-[100px] md:min-h-[120px] border-2 border-dashed border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-blue-500/50 transition-all cursor-pointer bg-[var(--color-bg-workspace)]/50 overflow-hidden">
                <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 group-hover:scale-105 transition-transform">
                  <PlusCircle size={24} md:size={32} className="text-[var(--color-text-muted)]" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Select CSV File</span>
                </div>
              </label>
            </section>

            <section className="bg-[var(--color-bg-surface)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[var(--color-bg-border)] shadow-xl space-y-6 md:space-y-8 flex flex-col">
              <div className="flex items-center gap-4">
                <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-xl md:rounded-2xl text-blue-500"><RefreshCw size={20} md:size={24} /></div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tight italic">Live Sync</h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">HolySheet Automation</p>
                </div>
              </div>
              <div className="flex flex-col gap-4 flex-1 justify-center">
                <button
                  onClick={async () => {
                    try {
                      const res = await axios.post('/api/crm/sync-bookings');
                      setModalConfig({ isOpen: true, title: 'Sync Successful', message: res.data.message, type: 'success' });
                      fetchData();
                    } catch (err) {
                      setModalConfig({ isOpen: true, title: 'Sync Failed', message: err.response?.data?.error || 'Check HOLYSHEET_API_KEY', type: 'danger' });
                    }
                  }}
                  className="flex items-center justify-center gap-4 p-6 md:p-8 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-blue-500/50 transition-all group"
                >
                  <Database size={24} md:size={32} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Sync Bookings</span>
                </button>
              </div>
            </section>

            <section className="bg-[var(--color-bg-surface)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[var(--color-bg-border)] shadow-xl space-y-6 md:space-y-8 flex flex-col">
              <div className="flex items-center gap-4">
                <div className="p-2.5 md:p-3 bg-emerald-500/10 rounded-xl md:rounded-2xl text-emerald-500"><Download size={20} md:size={24} /></div>
                <div>
                  <h3 className="text-base md:text-lg font-black uppercase tracking-tight italic">Export Data</h3>
                  <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Download All Data</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4 flex-1">
                <button onClick={handleExportCSV} aria-label="Export full CRM dataset as CSV" className="flex flex-col items-center justify-center gap-3 md:gap-4 p-6 md:p-8 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-emerald-500/50 transition-all group">
                  <FileText size={24} md:size={32} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-center">Full CSV</span>
                </button>
                <button aria-label="Export dataset as JSON (Coming Soon)" className="flex flex-col items-center justify-center gap-3 md:gap-4 p-6 md:p-8 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-blue-500/50 transition-all group opacity-50">
                  <FileJson size={24} md:size={32} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-center">JSON Batch</span>
                </button>
              </div>
            </section>
          </div>

          <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase">CRM Import History</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setModalConfig({
                      isOpen: true,
                      title: 'Reset All Data?',
                      message: 'Are you sure you want to permanently delete all leads, EMIs, and logs? This action cannot be undone.',
                      type: 'danger',
                      isConfirm: true,
                      onConfirm: async () => {
                        try {
                          await axios.post('/api/crm/reset', { reason: 'System Admin Manual Reset' });
                          fetchData();
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                >
                  <RefreshCw size={14} /> Reset CRM Data
                </button>
                <Badge variant="progress">{crmImports.length} BATCHES</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                  <tr><th className="px-8 py-4">File Name</th><th className="px-8 py-4">Date</th><th className="px-8 py-4 text-center">Contacts</th><th className="px-8 py-4 text-center">Uploaded By</th><th className="px-8 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {crmImports.map(batch => (
                    <tr key={batch._id} className="hover:bg-blue-500/5 transition-all group">
                      <td className="px-8 py-4 font-black text-xs uppercase tracking-tight">{batch.filename}</td>
                      <td className="px-8 py-4 text-[10px] font-bold text-[var(--color-text-muted)]">{format(new Date(batch.createdAt), 'MMM d, yyyy HH:mm')}</td>
                      <td className="px-8 py-4 text-center"><Badge variant="todo">{batch.leadCount} CONTACTS</Badge></td>
                      <td className="px-8 py-4 text-center text-[10px] font-black text-blue-500 uppercase">{batch.createdBy?.name}</td>
                      <td className="px-8 py-4 text-right">
                        <button
                          onClick={() => setDeleteModal({ isOpen: true, importId: batch._id, count: batch.leadCount, reason: '' })}
                          className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                          aria-label={`Delete import batch ${batch.filename}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden">
            <div className="px-8 py-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase">Deletion History</h3>
              <Badge variant="todo">SYSTEM LOGS</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-8 py-4">Action</th>
                    <th className="px-8 py-4">Date</th>
                    <th className="px-8 py-4">Done By</th>
                    <th className="px-8 py-4">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {purgeLogs.map(log => (
                    <tr key={log._id} className="hover:bg-rose-500/5 transition-all group">
                      <td className="px-8 py-4">
                        <Badge variant={log.action === 'SYSTEM_RESET' ? 'danger' : 'progress'}>{log.action}</Badge>
                      </td>
                      <td className="px-8 py-4 text-[10px] font-bold text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}</td>
                      <td className="px-8 py-4 text-[10px] font-black text-blue-500 uppercase">{log.userId?.name}</td>
                      <td className="px-8 py-4 text-[10px] font-bold text-[var(--color-text-secondary)] max-w-md" title={log.notes}>{log.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : activeTab === 'mail' ? (
        <EmailMarketingContent 
          stats={mailStats} 
          campaigns={campaigns} 
          profiles={profiles} 
          onRefresh={fetchData} 
        />
      ) : activeTab === 'logs' ? (
        <div className="space-y-8">
          <AdminLogsContent />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <Shield size={48} className="mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Select a section above</p>
        </div>
      )}




      {/* Modals */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-bg-surface)] w-full max-w-md rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl p-8 space-y-6">
              <div className="flex items-center gap-4 text-rose-500">
                <AlertTriangle size={32} />
                <h2 className="text-xl font-black uppercase tracking-tight">Confirm Deletion</h2>
              </div>
              <p className="text-[11px] font-bold text-[var(--color-text-secondary)] leading-relaxed">
                PERMANENTLY DELETE <span className="text-rose-500 font-black">{deleteModal.count} contacts</span> from this import. Please provide a reason.
              </p>
              <textarea value={deleteModal.reason} onChange={e => setDeleteModal({ ...deleteModal, reason: e.target.value })} placeholder="Why are you deleting this?" className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-4 text-xs font-bold min-h-[100px] outline-none" />
              <div className="flex gap-3 pt-4">
                <button onClick={() => setDeleteModal({ isOpen: false, importId: null, count: 0, reason: '' })} className="flex-1 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</button>
                <button onClick={handleDeleteImport} className="flex-1 py-3 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal user={selectedUser} onClose={() => { setSelectedUser(null); setSearchParams({}); }} onRoleChange={handleRoleChange} onDelete={handleDeleteUser} allTeams={teams} onTeamsChange={handleTeamsChange} />
        )}
      </AnimatePresence>

      <NexusModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        isConfirm={modalConfig.isConfirm}
        onConfirm={modalConfig.onConfirm}
      />
    </PageContainer>
  );
};

const EmailMarketingContent = ({ stats, campaigns, profiles, onRefresh }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: '', email: '', smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '' });
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ title: '', subject: '', content: '', senderProfileId: '' });
  const [loading, setLoading] = useState(false);

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
      // For demo, we'll just use the first 10 leads if none selected
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
    { label: 'Campaigns', value: stats.totalCampaigns, icon: MailIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Sent', value: stats.totalSent, icon: Send, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Bounces', value: stats.totalBounced, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Opens', value: stats.totalOpened, icon: Eye, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-10">
      {/* Sessy-Style Analytics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {metrics.map((m, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${m.bg} ${m.color}`}><m.icon size={20} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">{m.label}</p>
                <h4 className="text-xl font-black">{m.value}</h4>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* AutoMailer-Style Campaign List */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="overflow-hidden">
            <div className="px-8 py-6 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-workspace)]/50">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-500"><Zap size={18} /></div>
                <h3 className="text-sm font-black uppercase">Active Campaigns</h3>
              </div>
              <button 
                onClick={() => setShowCampaignModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> New Campaign
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/30">
                  <tr>
                    <th className="px-8 py-4">Campaign</th>
                    <th className="px-8 py-4 text-center">Status</th>
                    <th className="px-8 py-4 text-center">Delivery</th>
                    <th className="px-8 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {campaigns.length === 0 ? (
                    <tr><td colSpan="4" className="px-8 py-12 text-center text-xs text-[var(--color-text-muted)] italic">No campaigns created yet.</td></tr>
                  ) : campaigns.map(c => (
                    <tr key={c._id} className="hover:bg-blue-500/5 transition-all">
                      <td className="px-8 py-5">
                        <p className="text-xs font-black uppercase tracking-tight">{c.title}</p>
                        <p className="text-[9px] font-bold text-[var(--color-text-muted)] truncate max-w-xs">{c.subject}</p>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <Badge variant={c.status === 'Completed' ? 'done' : c.status === 'Sending' ? 'progress' : 'todo'}>
                          {c.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex gap-2 text-[9px] font-black">
                            <span className="text-emerald-500">{c.stats.sent} SENT</span>
                            <span className="text-rose-500">{c.stats.bounced} BOUNCED</span>
                          </div>
                          <div className="w-24 h-1 bg-[var(--color-bg-border)] rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all duration-500" 
                              style={{ width: `${(c.stats.sent / (c.stats.total || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button 
                          disabled={c.status === 'Sending' || c.status === 'Completed'}
                          onClick={() => handleSend(c._id)}
                          className="p-2.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-xl hover:bg-blue-500 hover:text-white transition-all disabled:opacity-30"
                        >
                          <Play size={14} fill="currentColor" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Profiles Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest">Sender Profiles</h3>
              <button 
                onClick={() => setShowProfileModal(true)}
                className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="space-y-3">
              {profiles.length === 0 ? (
                <div className="p-4 bg-[var(--color-bg-workspace)] border border-dashed border-[var(--color-bg-border)] rounded-xl text-center">
                  <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase italic">No profiles set up</p>
                </div>
              ) : profiles.map(p => (
                <div key={p._id} className="p-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl flex items-center gap-4 group hover:border-blue-500/50 transition-all shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xs">
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black uppercase truncate group-hover:text-blue-500 transition-colors">{p.name}</p>
                    <p className="text-[8px] font-bold text-[var(--color-text-muted)] truncate">{p.email}</p>
                  </div>
                  {p.isDefault && (
                    <div className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-[7px] font-black uppercase tracking-widest border border-emerald-500/10">
                      DEF
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-8 bg-blue-600 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
              <Zap size={120} strokeWidth={3} />
            </div>
            <h3 className="text-base font-black italic tracking-tight mb-2 uppercase">Pro Insights</h3>
            <p className="text-[10px] font-medium opacity-80 leading-relaxed mb-6">
              SES events are tracked in real-time. Bounces are automatically removed from your active leads to maintain deliverability.
            </p>
            <button 
              onClick={() => onRefresh()}
              className="w-full py-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-blue-600 transition-all"
            >
              Refresh Engine
            </button>
          </Card>
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-bg-surface)] w-full max-w-md rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight italic">New Profile</h2>
                <button onClick={() => setShowProfileModal(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Name</label>
                    <input required value={newProfile.name} onChange={e => setNewProfile({...newProfile, name: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="E.g. Support Team" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Email</label>
                    <input required type="email" value={newProfile.email} onChange={e => setNewProfile({...newProfile, email: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="hello@company.com" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">SMTP Host</label>
                  <input required value={newProfile.smtpHost} onChange={e => setNewProfile({...newProfile, smtpHost: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="email-smtp.us-east-1.amazonaws.com" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Port</label>
                    <input required type="number" value={newProfile.smtpPort} onChange={e => setNewProfile({...newProfile, smtpPort: parseInt(e.target.value)})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">SMTP User</label>
                    <input required value={newProfile.smtpUser} onChange={e => setNewProfile({...newProfile, smtpUser: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="SMTP Username" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">SMTP Password / App Key</label>
                  <input required type="password" value={newProfile.smtpPass} onChange={e => setNewProfile({...newProfile, smtpPass: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="••••••••••••••••" />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20">Save Profile</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Campaign Modal */}
      <AnimatePresence>
        {showCampaignModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-[var(--color-bg-surface)] w-full max-w-2xl rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black uppercase tracking-tight italic">Create Campaign</h2>
                <button onClick={() => setShowCampaignModal(false)}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateCampaign} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Campaign Title</label>
                  <input required value={newCampaign.title} onChange={e => setNewCampaign({...newCampaign, title: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="E.g. Summer Sale 2024" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Sender Profile</label>
                    <select required value={newCampaign.senderProfileId} onChange={e => setNewCampaign({...newCampaign, senderProfileId: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner">
                      <option value="">Select profile...</option>
                      {profiles.map(p => <option key={p._id} value={p._id}>{p.name} ({p.email})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Email Subject</label>
                    <input required value={newCampaign.subject} onChange={e => setNewCampaign({...newCampaign, subject: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-3.5 text-xs font-bold outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="Don't miss out on this deal!" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] ml-1">Content (HTML)</label>
                  <textarea required value={newCampaign.content} onChange={e => setNewCampaign({...newCampaign, content: e.target.value})} className="w-full bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl p-4 text-xs font-bold min-h-[150px] outline-none focus:border-blue-500/50 transition-all shadow-inner" placeholder="<h1>Hello!</h1><p>Check out our new products...</p>" />
                </div>
                <button type="submit" className="w-full py-4 bg-blue-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20">Initialize Sequence</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
