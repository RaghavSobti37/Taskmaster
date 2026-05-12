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
        className="bg-[var(--color-bg-surface)] w-full max-w-4xl rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <header className="p-8 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-[var(--color-action-primary)] flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-blue-500/20 overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : user.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-black text-[var(--color-text-primary)]">{user.name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <Badge variant={user.role === 'admin' ? 'progress' : 'todo'}>{user.role.toUpperCase()}</Badge>
                <span className="text-xs text-[var(--color-text-muted)] font-bold flex items-center gap-1">
                  <Circle size={8} className={user.online ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'} />
                  {user.online ? 'SYNCED' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-[var(--color-bg-border)] rounded-2xl transition-all">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <section className="p-6 bg-[var(--color-bg-workspace)] rounded-3xl border border-[var(--color-bg-border)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Core Identification</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail size={16} className="text-[var(--color-action-primary)]" />
                  <span className="text-xs font-bold">{user.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-[var(--color-action-primary)]" />
                  <span className="text-xs font-bold">{user.phone || 'No Signal Registered'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-[var(--color-action-primary)]" />
                  <span className="text-xs font-bold">Access: {user.role}</span>
                </div>
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Team Assignments</label>
                  <CKDropdown 
                    multi
                    placeholder="Assign Teams..."
                    options={allTeams.map(t => ({ value: t.name, label: t.name }))}
                    value={user.teams || []}
                    onChange={(newTeams) => onTeamsChange(user._id, newTeams)}
                  />
                </div>
              </div>
            </section>

            <section className="p-6 bg-[var(--color-bg-workspace)] rounded-3xl border border-[var(--color-bg-border)] space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">Access Control</h3>
              <button 
                onClick={() => onRoleChange(user._id, user.role)}
                className="w-full py-3 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold hover:border-[var(--color-action-primary)] transition-all flex items-center justify-center gap-2"
              >
                <UserCog size={16} />
                Toggle Admin Status
              </button>
              <button 
                onClick={handleDelete}
                className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Decommission Operative
              </button>
            </section>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <section className="bg-[var(--color-bg-workspace)] rounded-3xl border border-[var(--color-bg-border)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-bg-border)] bg-black/5 flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-widest">Active Tasks</h3>
                <Badge variant="todo">{userTasks.length} Tasks</Badge>
              </div>
              <div className="divide-y divide-[var(--color-bg-border)] max-h-[300px] overflow-y-auto">
                {userTasks.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[var(--color-text-muted)] italic">No active assignments detected.</div>
                ) : userTasks.map(task => (
                  <div key={task._id} className="p-4 flex items-center justify-between hover:bg-black/5 transition-all">
                    <span className="text-xs font-bold">{task.title}</span>
                    <Badge variant={task.status}>{task.status}</Badge>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[var(--color-bg-workspace)] rounded-3xl border border-[var(--color-bg-border)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-bg-border)] bg-black/5 flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-widest">Activity History</h3>
                <Badge variant="progress">RECENT</Badge>
              </div>
              <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto">
                {userLogs.slice(0, 10).map(log => (
                  <div key={log._id} className="flex gap-4 items-start">
                    <div className="w-2 h-2 rounded-full bg-[var(--color-action-primary)] mt-1.5" />
                    <div>
                      <p className="text-xs font-bold text-[var(--color-text-primary)]">{log.action.replace('_', ' ')}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'MMM d, HH:mm')}</p>
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

  const fetchData = async () => {
    try {
      const [usersRes, logsRes, tasksRes, teamsRes] = await Promise.all([
        axios.get('/api/users/directory'),
        axios.get('/api/logs'),
        axios.get('/api/tasks'),
        axios.get('/api/teams')
      ]);
      setUsers(usersRes.data.users || []);
      setLogs(logsRes.data);
      setTeams(teamsRes.data);
      
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

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-96 text-[var(--color-text-muted)] animate-pulse">Loading Admin Panel...</div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-[var(--color-text-secondary)]">Manage users and monitor system activity.</p>
        </div>
        <Link 
          to="/logs" 
          className="flex items-center gap-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-bg-workspace)] transition-all shadow-sm"
        >
          <Clock size={18} className="text-[var(--color-action-primary)]" />
          System Logs
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Users className="text-[var(--color-action-primary)]" />
                <h3 className="font-bold">User List</h3>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
                <input 
                  type="text" 
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-bg-workspace)]/50 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest border-b border-[var(--color-bg-border)]">
                  <tr>
                    <th className="px-6 py-4 font-bold">User</th>
                    <th className="px-6 py-4 font-bold">Role</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-bg-border)]">
                  {filteredUsers.map((u) => (
                    <tr 
                      key={u._id} 
                      onClick={() => setSelectedUser(u)}
                      className="hover:bg-[var(--color-bg-workspace)] transition-all group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] flex items-center justify-center font-bold text-xs relative overflow-hidden">
                            {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name.substring(0, 2).toUpperCase()}
                            {u.online && <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500 border border-white shadow-sm" />}
                          </div>
                          <div>
                            <p className="font-bold text-[var(--color-text-primary)]">{u.name}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)]">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.role === 'admin' ? 'progress' : 'todo'}>{u.role.toUpperCase()}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2.5 bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-muted)] group-hover:bg-[var(--color-action-primary)] group-hover:text-white transition-all">
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column: Activity & Active Load */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm p-8 flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold flex items-center gap-2 text-[var(--color-action-primary)]">
                <TrendingUp size={18} /> System Load
              </h3>
              <p className="text-[10px] text-[var(--color-text-muted)] uppercase font-black tracking-widest">Tasks in progress</p>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-[var(--color-text-primary)]">
                {stats.totalTasks === 0 ? '0%' : Math.round((stats.activeTasks / stats.totalTasks) * 100) + '%'}
              </p>
              <div className="w-32 h-1.5 bg-[var(--color-bg-border)] rounded-full mt-2 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.totalTasks === 0 ? 0 : (stats.activeTasks / stats.totalTasks) * 100}%` }}
                  className="h-full bg-[var(--color-action-primary)]"
                />
              </div>
            </div>
          </section>

          <section className="bg-gradient-to-br from-[var(--color-action-primary)] to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/20">
            <h3 className="font-bold mb-2">System Status</h3>
            <p className="text-xs opacity-80 mb-4">All parts of the system are working normally.</p>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg w-fit">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Running Smoothly
            </div>
          </section>

          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Layers className="text-[var(--color-action-primary)]" size={20} />
                <h3 className="font-bold">Teams</h3>
              </div>
              <Badge variant="todo">{teams.length} Teams</Badge>
            </div>
            <div className="p-6 space-y-4">
              <form onSubmit={handleCreateTeam} className="space-y-3">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="New Team Name..."
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    className="flex-1 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[var(--color-action-primary)]"
                  />
                  <input 
                    type="color"
                    value={newTeamColor}
                    onChange={e => setNewTeamColor(e.target.value)}
                    className="w-10 h-10 rounded-xl bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] cursor-pointer overflow-hidden p-0 border-none"
                  />
                  <button type="submit" className="p-2 bg-[var(--color-action-primary)] text-white rounded-xl hover:bg-[var(--color-action-hover)]">
                    <Plus size={16} />
                  </button>
                </div>
              </form>
              <div className="flex flex-wrap gap-2">
                {teams.map(team => (
                  <div 
                    key={team._id} 
                    className="px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
                    style={{ borderLeft: `4px solid ${team.color || '#3b82f6'}` }}
                  >
                    <span style={{ color: team.color || 'var(--color-text-muted)' }}>{team.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Activity className="text-[var(--color-action-primary)] animate-pulse" size={20} />
                <h3 className="font-bold">Activity Feed</h3>
              </div>
              <Badge variant="progress">LIVE</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[var(--color-bg-workspace)]/30">
              {logs.map((log) => (
                <div key={log._id} className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-surface)] flex-shrink-0 flex items-center justify-center font-bold text-[10px] border border-[var(--color-bg-border)] overflow-hidden">
                    {log.userId?.avatar ? <img src={log.userId.avatar} alt="" className="w-full h-full object-cover" /> : <span>{log.userId?.name?.substring(0, 2).toUpperCase() || 'SY'}</span>}
                  </div>
                  <div className="space-y-1 max-w-[80%]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--color-text-primary)]">{log.userId?.name || 'System'}</span>
                      <span className="text-[9px] text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'HH:mm')}</span>
                    </div>
                    <div className={`p-3 rounded-2xl rounded-tl-none text-xs ${log.action === 'CHAT_MESSAGE' ? 'bg-blue-500/10 text-blue-900 dark:text-blue-100 border border-blue-500/20 shadow-sm' : 'bg-white/50 dark:bg-black/20 text-[var(--color-text-secondary)]'}`}>
                      {log.action === 'CHAT_MESSAGE' ? log.details.message : `${log.action.replace('_', ' ')}: ${log.details?.title || log.targetType}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="p-4 border-t border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex gap-2">
              <input 
                type="text" 
                placeholder="Post to feed..."
                value={chatMsg}
                onChange={e => setChatMsg(e.target.value)}
                className="flex-1 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-[var(--color-action-primary)] shadow-inner"
              />
              <button type="submit" className="p-2 bg-[var(--color-action-primary)] text-white rounded-xl hover:bg-[var(--color-action-hover)] shadow-lg shadow-blue-500/20">
                <Send size={16} />
              </button>
            </form>
          </section>
        </div>
      </div>

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
