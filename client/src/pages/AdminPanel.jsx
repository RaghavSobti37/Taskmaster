import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Shield,
  ShieldCheck,
  Search,
  Activity,
  Send,
  Database,
  TrendingUp,
  Clock,
  Circle,
  UserCog,
  X,
  Mail,
  Calendar,
  Briefcase,
  Trash2,
  ChevronRight,
  Phone,
  Plus,
  Layers
} from 'lucide-react';
import { Badge, NexusModal } from '../components/ui';
import { Link } from 'react-router-dom';
import CKDropdown from '../components/ui/CKDropdown';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';

const UserDetailModal = ({ user, onClose, onRoleChange, onDelete, allTeams, onTeamsChange }) => {
  const [userTasks, setUserTasks] = useState([]);
  const [userLogs, setUserLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const [tasksRes, logsRes] = await Promise.all([
          axios.get('/api/tasks'), // We filter client side for now, or add user-specific route
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

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

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
        className="bg-[var(--color-bg-surface)] w-full max-w-4xl rounded-[1.5rem] md:rounded-[2rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]"
      >
        <header className="p-4 md:p-8 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-[var(--color-action-primary)] flex items-center justify-center text-sm md:text-xl font-black text-white shadow-xl shadow-blue-500/20 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-sm md:text-lg font-black text-[var(--color-text-primary)]">{user.name}</h2>
              <div className="flex items-center gap-2 md:gap-3 mt-0.5">
                <Badge variant={user.role === 'admin' ? 'progress' : 'todo'}>{user.role.toUpperCase()}</Badge>
                <span className="text-[8px] md:text-[10px] text-[var(--color-text-muted)] font-bold flex items-center gap-1">
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

        <div className="flex-1 overflow-y-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="space-y-6">
            <section className="p-6 bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)]">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Core Identification</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail size={14} className="text-[var(--color-action-primary)]" />
                  <span className="text-[11px] font-bold">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={14} className="text-[var(--color-action-primary)]" />
                  <span className="text-[11px] font-bold">{user.phone || 'No Signal'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield size={14} className="text-[var(--color-action-primary)]" />
                  <span className="text-[11px] font-bold">Access: {user.role}</span>
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
              <h3 className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Access Control</h3>
              <button
                onClick={() => onRoleChange(user._id, user.role)}
                className="w-full py-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-bold hover:border-[var(--color-action-primary)] transition-all flex items-center justify-center gap-2"
              >
                <UserCog size={14} />
                Toggle Admin
              </button>
              <button
                onClick={handleDelete}
                className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                Decommission
              </button>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[var(--color-bg-border)] bg-black/5 flex items-center justify-between">
                <h3 className="font-bold text-[10px] uppercase tracking-widest">Active Tasks</h3>
                <Badge variant="todo">{userTasks.length} Units</Badge>
              </div>
              <div className="divide-y divide-[var(--color-bg-border)] max-h-[250px] overflow-y-auto">
                {userTasks.length === 0 ? (
                  <div className="p-8 text-center text-[10px] text-[var(--color-text-muted)] italic">No active assignments.</div>
                ) : userTasks.map(task => (
                  <div key={task._id} className="p-3.5 flex items-center justify-between hover:bg-black/5 transition-all">
                    <span className="text-[11px] font-bold">{task.title}</span>
                    <Badge variant={task.status}>{task.status}</Badge>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[var(--color-bg-workspace)] rounded-[1.5rem] border border-[var(--color-bg-border)] overflow-hidden">
              <div className="px-6 py-3.5 border-b border-[var(--color-bg-border)] bg-black/5 flex items-center justify-between">
                <h3 className="font-bold text-[10px] uppercase tracking-widest">Activity History</h3>
                <Badge variant="progress">RECENT</Badge>
              </div>
              <div className="p-6 space-y-3.5 max-h-[250px] overflow-y-auto">
                {userLogs.slice(0, 10).map(log => (
                  <div key={log._id} className="flex gap-3 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-action-primary)] mt-1" />
                    <div>
                      <p className="text-[11px] font-bold text-[var(--color-text-primary)]">{log.action.replace('_', ' ')}</p>
                      <p className="text-[9px] text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</p>
                    </div>
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
  const [stats, setStats] = useState({ totalTasks: 0, activeTasks: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [chatMsg, setChatMsg] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#3b82f6');
  const [loading, setLoading] = useState(true);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [crmImports, setCrmImports] = useState([]);
  const [activeTab, setActiveTab] = useState('users');

  const fetchData = async () => {
    try {
      const [usersRes, logsRes, tasksRes, teamsRes, importsRes] = await Promise.all([
        axios.get('/api/users/directory'),
        axios.get('/api/logs'),
        axios.get('/api/tasks'),
        axios.get('/api/teams'),
        axios.get('/api/crm/imports')
      ]);
      setUsers(usersRes.data.users || []);
      setLogs(logsRes.data);
      setTeams(teamsRes.data);
      setCrmImports(importsRes.data);

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
    const interval = setInterval(fetchData, 10000);
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
        title: 'Deployment Failed',
        message: err.response?.data?.error || 'Team orchestration protocol failed. Please verify credentials.',
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

  const handleDeleteImport = async (importId, count) => {
    if (window.confirm(`SECURITY CLEARANCE REQUIRED: You are about to PERMANENTLY PURGE ${count} contacts from the system. This action is irreversible. Continue?`)) {
      try {
        await axios.delete(`/api/crm/imports/${importId}`);
        fetchData();
      } catch (err) {
        console.error('Delete import error:', err);
      }
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="w-8 h-8 border-4 border-[var(--color-action-primary)]/20 border-t-[var(--color-action-primary)] rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] animate-pulse">Initializing System Deck...</p>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-900 rounded-xl text-blue-500 border border-white/5 shadow-xl">
              <ShieldCheck size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">
                System Deck
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)]">Core Security Active</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/logs"
            className="flex-1 md:flex-none group flex items-center justify-center gap-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:border-blue-500 transition-all shadow-sm"
          >
            <Clock size={14} className="text-blue-500 group-hover:rotate-12 transition-transform" />
            Daily Logs
          </Link>
          <button className="p-3 bg-slate-900 text-white rounded-xl border border-white/10 hover:bg-slate-800 transition-all shadow-xl">
            <UserCog size={16} />
          </button>
        </div>
      </motion.header>

      {/* Stats Row: System Health */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Personnel</p>
              <h3 className="text-lg md:text-2xl font-black text-white">{users.length}</h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-blue-400">
              <Users size={16} className="md:size-18" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Load</p>
              <h3 className="text-lg md:text-2xl font-black text-white">{stats.activeTasks}</h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-emerald-400">
              <TrendingUp size={16} className="md:size-18" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Units</p>
              <h3 className="text-lg md:text-2xl font-black text-white">{teams.length}</h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-orange-400">
              <Layers size={16} className="md:size-18" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5 md:space-y-1">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Health</p>
              <h3 className="text-lg md:text-2xl font-black text-white">
                {stats.totalTasks === 0 ? '0%' : Math.round((stats.activeTasks / stats.totalTasks) * 100) + '%'}
              </h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-purple-400">
              <Activity size={16} className="md:size-18" />
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Tab Navigation */}
      <div className="flex items-center gap-4 border-b border-[var(--color-bg-border)]">
        <button onClick={() => setActiveTab('users')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'users' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-[var(--color-text-muted)]'}`}>Personnel</button>
        <button onClick={() => setActiveTab('crm')} className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'crm' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-[var(--color-text-muted)]'}`}>CRM Batches</button>
      </div>

      {activeTab === 'users' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Content: User Directory (LEFT) */}
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-8 space-y-8"
          >
            <section className="bg-[var(--color-bg-surface)] rounded-[1.5rem] md:rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden flex flex-col min-h-[500px] md:min-h-[600px]">
              <div className="px-4 md:px-8 py-6 md:py-8 border-b border-[var(--color-bg-border)] bg-gradient-to-b from-[var(--color-bg-workspace)] to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="p-2 md:p-3 bg-blue-500/10 rounded-[1rem] md:rounded-[1.25rem] text-blue-500 shadow-sm">
                    <Users size={18} md:size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black tracking-tight text-[var(--color-text-primary)]">User Directory</h3>
                  </div>
                </div>
                <div className="relative w-full sm:w-64 md:w-72">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={12} />
                  <input
                    type="text"
                    placeholder="Scan directory..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[10px] md:text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                    <tr>
                      <th className="px-8 py-4">Operative Identification</th>
                      <th className="px-8 py-4 text-center">Clearance</th>
                      <th className="px-8 py-4 text-right">Access</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-bg-border)]">
                    {filteredUsers.map((u) => (
                      <tr
                        key={u._id}
                        onClick={() => setSelectedUser(u)}
                        className="hover:bg-blue-500/5 transition-all group cursor-pointer"
                      >
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center font-black text-[10px] relative overflow-hidden shadow-sm group-hover:border-blue-500/30 transition-all">
                              {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.substring(0, 2).toUpperCase()}
                              {u.online && <div className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500 border border-white shadow-sm" />}
                            </div>
                            <div>
                              <p className="font-black text-sm text-[var(--color-text-primary)] group-hover:text-blue-600 transition-colors">{u.name}</p>
                              <p className="text-[9px] font-bold text-[var(--color-text-muted)]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <Badge variant={u.role === 'admin' ? 'progress' : 'todo'}>{u.role.toUpperCase()}</Badge>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] group-hover:text-blue-500 group-hover:border-blue-500/30 transition-all">
                            Manage <ChevronRight size={12} strokeWidth={3} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </motion.main>

          {/* Right Sidebar: Teams & Stream (RIGHT) */}
          <motion.aside
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-4 space-y-8 sticky top-8"
          >
            {/* Teams Section */}
            <section className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden flex flex-col">
              <div className="px-6 py-5 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Layers size={14} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-[10px] uppercase tracking-widest text-[var(--color-text-primary)]">Deployment Teams</h3>
                </div>
                <Badge variant="todo">{teams.length} UNITS</Badge>
              </div>
              <div className="p-6 space-y-4">
                <form onSubmit={handleCreateTeam} className="relative group">
                  <input
                    type="text"
                    placeholder="New Unit..."
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="w-full pl-5 pr-20 py-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                  />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1.5">
                    <input
                      type="color"
                      value={newTeamColor}
                      onChange={e => setNewTeamColor(e.target.value)}
                      className="w-7 h-7 rounded-lg bg-[var(--color-bg-workspace)] border-none cursor-pointer p-0"
                    />
                    <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
                      <Plus size={14} strokeWidth={3} />
                    </button>
                  </div>
                </form>
                <div className="grid grid-cols-2 gap-2.5">
                  {teams.map(team => (
                    <div
                      key={team._id}
                      className="px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm hover:border-blue-500/30 transition-all group"
                      style={{ borderLeft: `3px solid ${team.color || '#3b82f6'}` }}
                    >
                      <span className="truncate" style={{ color: team.color || 'var(--color-text-muted)' }}>{team.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Activity Stream */}
            <section className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden flex flex-col h-[550px]">
              <div className="px-6 py-5 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <Activity size={14} strokeWidth={2.5} />
                  </div>
                  <h3 className="font-black text-[10px] uppercase tracking-widest text-[var(--color-text-primary)]">API Calls</h3>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[8px] font-black uppercase tracking-widest">
                  <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--color-bg-workspace)]/30 custom-scrollbar">
                {logs.map((log) => (
                  <div key={log._id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] flex-shrink-0 flex items-center justify-center font-black text-[9px] border border-[var(--color-bg-border)] overflow-hidden shadow-sm group-hover:border-blue-500/30 transition-all">
                      {log.userId?.avatar ? <img src={log.userId.avatar} alt="" className="w-full h-full object-cover" /> : <span>{log.userId?.name?.substring(0, 2).toUpperCase() || 'SY'}</span>}
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-[var(--color-text-primary)] uppercase tracking-tight">{log.userId?.name || 'System'}</span>
                        <span className="text-[8px] font-bold text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'HH:mm')}</span>
                      </div>
                      <div className={`p-3 rounded-xl rounded-tl-none text-[11px] font-medium leading-relaxed border transition-all ${log.action === 'CHAT_MESSAGE' ? 'bg-blue-500/5 text-blue-900 dark:text-blue-100 border-blue-500/20 shadow-sm' : 'bg-white dark:bg-black/20 text-[var(--color-text-secondary)] border-[var(--color-bg-border)] group-hover:border-blue-500/10'}`}>
                        {log.action === 'CHAT_MESSAGE' ? log.details.message : (
                          <div className="space-y-0.5">
                            <span className="font-black uppercase text-[8px] tracking-widest text-blue-500">{log.action.replace('_', ' ')}</span>
                            <p className="opacity-90">{log.details?.title || log.targetType}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendChat} className="p-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex gap-2">
                <input
                  type="text"
                  placeholder="Secure channel transmission..."
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  className="flex-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-4 py-3 text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner"
                />
                <button type="submit" className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20">
                  <Send size={14} strokeWidth={3} />
                </button>
              </form>
            </section>
          </motion.aside>
        </div>
      ) : (
        <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-[var(--color-bg-border)] bg-gradient-to-b from-[var(--color-bg-workspace)] to-transparent">
            <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase">CRM Ingestion History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[var(--color-bg-workspace)]/50 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] border-b border-[var(--color-bg-border)]">
                <tr>
                  <th className="px-8 py-4">Session Payload</th>
                  <th className="px-8 py-4">Timestamp</th>
                  <th className="px-8 py-4 text-center">Payload Size</th>
                  <th className="px-8 py-4 text-center">Operative</th>
                  <th className="px-8 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-bg-border)]">
                {crmImports.map(batch => (
                  <tr key={batch._id} className="hover:bg-rose-500/5 transition-all group">
                    <td className="px-8 py-4 font-black text-xs uppercase tracking-tight">{batch.filename}</td>
                    <td className="px-8 py-4 text-[10px] font-bold text-[var(--color-text-muted)]">{new Date(batch.createdAt).toLocaleString()}</td>
                    <td className="px-8 py-4 text-center"><Badge variant="todo">{batch.leadCount} CONTACTS</Badge></td>
                    <td className="px-8 py-4 text-center text-[10px] font-black text-blue-500 uppercase">{batch.createdBy?.name}</td>
                    <td className="px-8 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteImport(batch._id, batch.leadCount)}
                        className="p-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
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
      )}

      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            onClose={() => {
              setSelectedUser(null);
              setSearchParams({});
            }}
            onRoleChange={handleToggleRole}
            onDelete={handleDeleteUser}
            allTeams={teams}
            onTeamsChange={handleTeamsChange}
          />
        )}
      </AnimatePresence>

      <NexusModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
      />
    </div>
  );
};

export default AdminPanel;
