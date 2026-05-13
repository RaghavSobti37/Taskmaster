import React, { useState, useEffect } from 'react';
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
  Clock,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Badge, NexusModal, ProgressBar } from '../components/ui';
import { Link, useSearchParams } from 'react-router-dom';
import CKDropdown from '../components/ui/CKDropdown';
import { format } from 'date-fns';
import { getRepName } from '../utils/crmUtils';



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
                  {user.online ? 'SYNCED' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-bg-border)] rounded-lg transition-all">
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
              <button
                onClick={() => onRoleChange(user._id, user.role)}
                className="w-full py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-bold hover:border-[var(--color-action-primary)] transition-all flex items-center justify-center gap-2"
              >
                <UserCog size={14} />
                Toggle Admin Role
              </button>
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
  const [loading, setLoading] = useState(true);

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info', isConfirm: false, onConfirm: null });
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('users');
  
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, importId: null, count: 0, reason: '' });

  const fetchData = async () => {
    try {
      const [usersRes, logsRes, tasksRes, teamsRes, importsRes, purgeRes, leadsRes] = await Promise.all([
        axios.get('/api/users/directory'),
        axios.get('/api/logs'),
        axios.get('/api/tasks'),
        axios.get('/api/teams'),
        axios.get('/api/crm/imports'),
        axios.get('/api/crm/purge-logs'),
        axios.get('/api/crm/leads')
      ]);


      setUsers(usersRes.data.users || []);
      setLogs(logsRes.data);
      setTeams(teamsRes.data);
      setCrmImports(importsRes.data);
      setPurgeLogs(purgeRes.data);
      setCrmLeads(leadsRes.data || []);


      const activeCount = tasksRes.data.filter(t => t.status === 'in-progress').length;
      setStats({
        totalTasks: tasksRes.data.length,
        activeTasks: activeCount
      });

      const userId = searchParams.get('user');
      if (userId && !selectedUser) {
        const user = usersRes.data.find(u => u._id === userId);
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

  const handleToggleRole = async (userId, currentRole) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      const res = await axios.put(`/api/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u._id === userId ? res.data : u));
      if (selectedUser?._id === userId) setSelectedUser(res.data);
    } catch (err) {
      console.error('Role update error:', err);
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
      const res = await axios.get('/api/crm/leads', { responseType: 'blob' });
      // This is a placeholder for a real CSV export endpoint if it exists, 
      // or we can generate it on the fly. 
      // Assuming /api/export exists from previous context
      const exportRes = await axios.get('/api/export?format=db', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([exportRes.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
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

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)]">Loading Admin Panel...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[var(--color-action-primary)]/10 rounded-xl text-[var(--color-action-primary)] shadow-sm border border-[var(--color-action-primary)]/10">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Link to="/admin/logs" className="flex-1 sm:flex-none text-center bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm">Daily Logs</Link>
        </div>
      </motion.header>

      {/* Tabs */}
      <div className="flex items-center gap-2 md:gap-4 border-b border-[var(--color-bg-border)] overflow-x-auto no-scrollbar">
        <button onClick={() => setActiveTab('users')} className={`px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'users' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-[var(--color-text-muted)]'}`}>Users</button>
        <button onClick={() => setActiveTab('crm-intel')} className={`px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'crm-intel' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-[var(--color-text-muted)]'}`}>CRM Intel</button>
        <button onClick={() => setActiveTab('crm-data')} className={`px-4 md:px-6 py-3 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'crm-data' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-[var(--color-text-muted)]'}`}>CRM Maintenance</button>
      </div>


      {activeTab === 'users' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-8 space-y-8">
            <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden flex flex-col min-h-[600px]">
              <div className="px-6 md:px-8 py-6 md:py-8 border-b border-[var(--color-bg-border)] flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-sm"><Users size={18} md:size={20} strokeWidth={2.5} /></div>
                  <h3 className="text-base md:text-lg font-black tracking-tight text-[var(--color-text-primary)]">User Directory</h3>
                </div>
                <div className="relative w-full md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={12} />
                  <input type="text" placeholder="Search users..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none shadow-inner" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                    <tr><th className="px-8 py-4">Name & Email</th><th className="px-8 py-4 text-center">Role</th><th className="px-8 py-4 text-right">View</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-bg-border)]">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} onClick={() => setSelectedUser(u)} className="hover:bg-blue-500/5 transition-all group cursor-pointer">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] relative overflow-hidden shadow-sm group-hover:border-blue-500/30">
                              {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.substring(0, 2).toUpperCase()}
                              {u.online && <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white" />}
                            </div>
                            <div><p className="font-black text-sm text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors">{u.name}</p><p className="text-[9px] font-bold text-[var(--color-text-muted)]">{u.email}</p></div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-center"><Badge variant={u.role === 'admin' ? 'progress' : 'todo'}>{u.role.toUpperCase()}</Badge></td>
                        <td className="px-8 py-4 text-right"><div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] group-hover:text-blue-500 group-hover:border-blue-500/30">{u.name.split(' ')[0]} <ChevronRight size={12} strokeWidth={3} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.main>

          <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4 space-y-8 sticky top-8">
            <section className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden p-6 space-y-4">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-[var(--color-text-primary)]">Teams</h3>
              <form onSubmit={handleCreateTeam} className="relative">
                <input type="text" placeholder="New team name..." value={newTeamName} onChange={e => setNewTeamName(e.target.value)} className="w-full pl-5 pr-20 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest outline-none" />
                <div className="absolute right-1.5 top-1.5 flex items-center gap-1.5">
                  <input type="color" value={newTeamColor} onChange={e => setNewTeamColor(e.target.value)} className="w-7 h-7 rounded-lg bg-[var(--color-bg-workspace)] border-none cursor-pointer p-0" />
                  <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all"><Plus size={14} strokeWidth={3} /></button>
                </div>
              </form>
              <div className="grid grid-cols-2 gap-2.5">
                {teams.map(team => (
                  <div key={team._id} className="px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm" style={{ borderLeft: `3px solid ${team.color || '#3b82f6'}` }}>
                    <span className="truncate" style={{ color: team.color || 'var(--color-text-muted)' }}>{team.name}</span>
                  </div>
                ))}
              </div>
            </section>
            
            <section className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden h-[400px] flex flex-col">
              <div className="px-6 py-4 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <h3 className="font-black text-[10px] uppercase tracking-widest">Activity Feed</h3>
                   <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                </div>
                <button onClick={handleClearSignals} className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all" title="Clear All Logs">
                  <Trash size={14} />
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
            </section>
          </motion.aside>
        </div>
        <div className="space-y-12">
           {/* Command Center */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Import Section */}
              <section className="bg-[var(--color-bg-surface)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[var(--color-bg-border)] shadow-xl space-y-6 md:space-y-8 flex flex-col">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 md:p-3 bg-blue-500/10 rounded-xl md:rounded-2xl text-blue-500"><Upload size={20} md:size={24} /></div>
                  <div>
                    <h3 className="text-base md:text-lg font-black uppercase tracking-tight italic">Data Ingestion</h3>
                    <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Upload Legacy Datasets</p>
                  </div>
                </div>
                <label className="group relative block w-full flex-1 min-h-[100px] md:min-h-[120px] border-2 border-dashed border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-blue-500/50 transition-all cursor-pointer bg-[var(--color-bg-workspace)]/50 overflow-hidden">
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 group-hover:scale-105 transition-transform">
                    <PlusCircle size={24} md:size={32} className="text-[var(--color-text-muted)]" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Select CSV Source</span>
                  </div>
                </label>
              </section>

              {/* Sync Section */}
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
                  <p className="text-[8px] text-[var(--color-text-muted)] text-center font-bold italic tracking-wider">Target: Leads Booking Sheet</p>
                </div>
              </section>

              {/* Export Section */}
              <section className="bg-[var(--color-bg-surface)] p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border border-[var(--color-bg-border)] shadow-xl space-y-6 md:space-y-8 flex flex-col">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 md:p-3 bg-emerald-500/10 rounded-xl md:rounded-2xl text-emerald-500"><Download size={20} md:size={24} /></div>
                  <div>
                    <h3 className="text-base md:text-lg font-black uppercase tracking-tight italic">Data Extraction</h3>
                    <p className="text-[9px] md:text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Master Dataset Export</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4 flex-1">
                   <button onClick={handleExportCSV} className="flex flex-col items-center justify-center gap-3 md:gap-4 p-6 md:p-8 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-emerald-500/50 transition-all group">
                      <FileText size={24} md:size={32} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-center">Full CSV</span>
                   </button>
                   <button className="flex flex-col items-center justify-center gap-3 md:gap-4 p-6 md:p-8 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-[1.5rem] md:rounded-[2rem] hover:border-blue-500/50 transition-all group opacity-50">
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
                      title: 'SYSTEM PURGE ALERT',
                      message: 'Are you sure you want to PERMANENTLY ERASE all leads, EMIs, and audit logs? This protocol is irreversible.',
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
                  <RefreshCw size={14} /> Reset CRM Ecosystem
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
                        <button onClick={() => setDeleteModal({ isOpen: true, importId: batch._id, count: batch.leadCount, reason: '' })} className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
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
      </>
      ) : activeTab === 'crm-intel' ? (
        <div className="space-y-12">
          {/* Dashboard View Adapted from CRMPage */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Database', value: crmLeads.length, icon: DbIcon, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { label: 'Connected', value: crmLeads.filter(l => l.callStatus === 'Connected').length, icon: Phone, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { label: 'Meaningful', value: crmLeads.filter(l => l.meaningfulConnect === 'YES').length, icon: UserCheck, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { label: 'Converted', value: crmLeads.filter(l => l.leadStatus === 'Converted').length, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            ].map((stat, i) => (
              <div key={i} className="bg-[var(--color-bg-surface)] p-6 rounded-[1.5rem] border border-[var(--color-bg-border)] shadow-xl shadow-black/5 group">
                <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}><stat.icon size={20} /></div>
                <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-1">{stat.label}</p>
                <h2 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tighter">{stat.value}</h2>
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
                      {Object.entries(crmLeads.reduce((acc, l) => {
                        const id = typeof l.assignedRepId === 'object' ? l.assignedRepId._id : (l.assignedRepId || 'unassigned');
                        acc[id] = (acc[id] || 0) + 1;
                        return acc;
                      }, {})).map(([id, count]) => {
                        const repLeads = crmLeads.filter(l => (typeof l.assignedRepId === 'object' ? l.assignedRepId._id : l.assignedRepId) === id);
                        const conv = repLeads.filter(l => l.leadStatus === 'Converted').length;
                        const rate = repLeads.length > 0 ? ((conv / repLeads.length) * 100).toFixed(1) : 0;
                        const name = getRepName(repLeads[0]?.assignedRepId) || id;
                        return (
                          <tr key={id} className="hover:bg-[var(--color-bg-workspace)] transition-all">
                            <td className="px-6 py-4"><span className="font-black text-[10px] uppercase tracking-tight italic">{name}</span></td>
                            <td className="px-6 py-4 text-center text-xs font-bold">{repLeads.length}</td>
                            <td className="px-6 py-4 text-center text-xs font-bold text-amber-500">{conv}</td>
                            <td className="px-6 py-4 text-center"><span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[9px] font-black border border-blue-500/10">{rate}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                 </table>
               </div>
             </section>

             <section className="bg-[var(--color-bg-surface)] p-8 rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl flex flex-col">
               <h3 className="text-[10px] font-black uppercase tracking-widest mb-6">Pipeline Health</h3>
               <div className="space-y-6 flex-1">
                 {[
                   { label: 'Total Base', value: crmLeads.length, percent: 100, color: 'bg-blue-500' },
                   { label: 'Connected', value: crmLeads.filter(l => l.callStatus === 'Connected').length, percent: (crmLeads.filter(l => l.callStatus === 'Connected').length / crmLeads.length * 100) || 0, color: 'bg-emerald-500' },
                   { label: 'Meaningful', value: crmLeads.filter(l => l.meaningfulConnect === 'YES').length, percent: (crmLeads.filter(l => l.meaningfulConnect === 'YES').length / crmLeads.length * 100) || 0, color: 'bg-purple-500' },
                   { label: 'Converted', value: crmLeads.filter(l => l.leadStatus === 'Converted').length, percent: (crmLeads.filter(l => l.leadStatus === 'Converted').length / crmLeads.length * 100) || 0, color: 'bg-amber-500' },
                 ].map((item, i) => (
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
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 opacity-30">
          <Shield size={48} className="mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest">Select Administrative Protocol</p>
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
          <UserDetailModal user={selectedUser} onClose={() => { setSelectedUser(null); setSearchParams({}); }} onRoleChange={handleToggleRole} onDelete={handleDeleteUser} allTeams={teams} onTeamsChange={handleTeamsChange} />
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
    </div>
  );
};

export default AdminPanel;
