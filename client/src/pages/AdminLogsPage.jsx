import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subDays,
  isSameDay
} from 'date-fns';
import {
  Calendar as CalIcon,
  Users,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  BarChart3,
  CalendarDays,
  User,
  Filter,
  ArrowLeft,
  X,
  Target,
  Timer,
  Activity,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../components/ui';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const AdminLogsPage = () => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [viewType, setViewType] = useState('7d'); // 7d, month
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedFeedLogs, setSelectedFeedLogs] = useState(null);
  const [feedTarget, setFeedTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('manual'); // manual, api
  const navigate = useNavigate();

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

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users/directory');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      let startDate, endDate;

      if (viewType === '7d') {
        startDate = subDays(new Date(), 7).toISOString();
        endDate = new Date().toISOString();
      } else {
        startDate = startOfMonth(selectedDate).toISOString();
        endDate = endOfMonth(selectedDate).toISOString();
      }

      const url = `/api/logs?limit=1000${selectedUserId !== 'all' ? `&userId=${selectedUserId}` : ''}&startDate=${startDate}&endDate=${endDate}`;
      const res = await axios.get(url);
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedUserId, viewType, selectedDate]);

  // Group logs by date and user
  const groupedLogs = logs.reduce((acc, log) => {
    const date = format(new Date(log.createdAt), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = {};
    const uid = log.userId?._id || 'system';
    if (!acc[date][uid]) acc[date][uid] = [];
    acc[date][uid].push(log);
    return acc;
  }, {});

  const getDayTotalTime = (userLogs) => {
    return userLogs.reduce((total, log) => {
      const time = log.details?.timeSpent;
      if (!time) return total;
      const hours = time.match(/(\d+(?:\.\d+)?)\s*h/);
      const mins = time.match(/(\d+)\s*m/);
      let t = 0;
      if (hours) t += parseFloat(hours[1]) * 60;
      if (mins) t += parseInt(mins[1]);
      if (!hours && !mins && !isNaN(time)) t += parseInt(time);
      return total + t;
    }, 0);
  };

  const formatMins = (m) => {
    const h = Math.floor(m / 60);
    const mins = m % 60;
    return h > 0 ? `${h}h ${mins}m` : `${mins}m`;
  };

  const days = viewType === '7d'
    ? eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
    : eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });

  if (loading && logs.length === 0) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <div className="w-8 h-8 border-4 border-[var(--color-action-primary)]/20 border-t-[var(--color-action-primary)] rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-text-muted)] animate-pulse">Initializing Hub...</p>
    </div>
  );

  const filteredLogs = selectedFeedLogs ? selectedFeedLogs.filter(log => {
    if (activeTab === 'manual') return log.action === 'DAILY_LOG';
    return log.action !== 'DAILY_LOG';
  }) : [];

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-8"
      >
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/admin')}
            className="p-2.5 bg-[var(--color-bg-surface)] hover:bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] transition-all shadow-sm active:scale-95"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="space-y-0.5">
            <h1 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)] uppercase">Daily Logs Hub</h1>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">Operational audit and time tracking intelligence.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-bg-border)] shadow-sm">
          <button
            onClick={() => setViewType('7d')}
            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewType === '7d' ? 'bg-slate-900 text-white shadow-xl' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            7-Day Summary
          </button>
          <button
            onClick={() => setViewType('month')}
            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'month' ? 'bg-slate-900 text-white shadow-xl' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            Monthly View
          </button>
        </div>
      </motion.header>

      {/* Stats Row: Analytics Summary (HORIZONTAL) */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <motion.div variants={itemVariants} className="bg-slate-900 p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Total Activity</p>
              <h3 className="text-2xl font-black text-white">{logs.length}</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-blue-400">
              <BarChart3 size={18} />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Deployment Time</p>
              <h3 className="text-2xl font-black text-white">{formatMins(getDayTotalTime(logs))}</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-emerald-400">
              <Timer size={18} />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Active Operatives</p>
              <h3 className="text-2xl font-black text-white">{new Set(logs.map(l => l.userId?._id)).size}</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-orange-400">
              <Users size={18} />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-6 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Capture Rate</p>
              <h3 className="text-2xl font-black text-white">{Math.round(logs.length / Math.max(1, days.length))}</h3>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-purple-400">
              <TrendingUp size={18} />
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Main Layout Grid (35:65 Ratio) */}
      <div className="grid grid-cols-1 lg:grid-cols-[35fr_65fr] gap-10 items-start">
        {/* Filters Panel (LEFT - 35%) */}
        <aside className="space-y-8 sticky top-8">
          <section className="bg-[var(--color-bg-surface)] p-6 rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
            <div className="relative z-10 flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500 shadow-sm border border-blue-500/10">
                <Users size={14} strokeWidth={2.5} />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)]">Operative Directory</h3>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-3">
              <button
                onClick={() => {
                  setSelectedUserId('all');
                  setSelectedFeedLogs(null);
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] ${selectedUserId === 'all' && !selectedFeedLogs ? 'bg-slate-900 text-white border-transparent shadow-2xl' : 'bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)] hover:border-blue-500/30 shadow-sm'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${selectedUserId === 'all' && !selectedFeedLogs ? 'bg-white/10' : 'bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)]'}`}>
                  <ShieldCheck size={18} className={selectedUserId === 'all' ? 'text-white' : 'text-[var(--color-text-muted)]'} />
                </div>
                <div className="text-left flex-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.1em]">All Users</span>
                </div>
                {(selectedUserId === 'all' && !selectedFeedLogs) && <ArrowUpRight size={12} className="text-blue-400" />}
              </button>

              <div className="h-px bg-[var(--color-bg-border)]/50 my-3" />

              {users.map(u => (
                <button
                  key={u._id}
                  onClick={() => {
                    setSelectedUserId(u._id);
                    setSelectedFeedLogs(null);
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all active:scale-[0.98] ${selectedUserId === u._id && !selectedFeedLogs ? 'bg-slate-900 text-white border-transparent shadow-2xl' : 'bg-[var(--color-bg-workspace)] border-[var(--color-bg-border)] hover:border-blue-500/30 shadow-sm'}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] overflow-hidden shadow-inner group-hover:border-blue-500/30 transition-all">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-[10px] tracking-tighter uppercase">{u.name.substring(0, 2)}</div>}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-[11px] font-black tracking-tight">{u.name}</p>
                    <p className={`text-[9px] font-bold uppercase tracking-[0.15em] ${selectedUserId === u._id ? 'text-blue-400' : 'text-[var(--color-text-muted)]'}`}>{u.role}</p>
                  </div>
                  {(selectedUserId === u._id && !selectedFeedLogs) && <ArrowUpRight size={12} className="text-blue-400" />}
                </button>
              ))}
            </div>
          </section>

          {viewType === 'month' && !selectedFeedLogs && (
            <section className="bg-[var(--color-bg-surface)] p-6 rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <CalendarDays size={14} strokeWidth={2.5} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-primary)]">Cycle Select</h3>
              </div>
              <div className="flex items-center justify-between bg-[var(--color-bg-workspace)] p-1.5 rounded-xl border border-[var(--color-bg-border)] shadow-inner">
                <button onClick={() => setSelectedDate(subDays(selectedDate, 30))} className="p-2 hover:bg-[var(--color-bg-surface)] rounded-lg transition-all active:scale-90">
                  <ChevronLeft size={14} strokeWidth={3} />
                </button>
                <span className="font-black text-[10px] uppercase tracking-widest">{format(selectedDate, 'MMMM yyyy')}</span>
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth() + 1)))} className="p-2 hover:bg-[var(--color-bg-surface)] rounded-lg transition-all active:scale-90">
                  <ChevronRight size={14} strokeWidth={3} />
                </button>
              </div>
            </section>
          )}
        </aside>

        {/* Dynamic Matrix (RIGHT - 65%) */}
        <main className="lg:col-span-1 space-y-10">
          <AnimatePresence mode="wait">
            {!selectedFeedLogs ? (
              <motion.section
                key="activity-grid"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col min-h-[800px]"
              >
                <div className="px-8 py-8 border-b border-[var(--color-bg-border)] bg-gradient-to-b from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-sm border border-blue-500/10">
                      <Activity size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase">Activity Matrix</h3>
                      <p className="text-xs text-[var(--color-text-muted)] font-medium">Visualizing operational frequency across the user base.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
                    <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                    Live Audit
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  {days.reverse().map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dateLogs = groupedLogs[dateStr] || {};
                    const userIds = Object.keys(dateLogs);
                    
                    if (userIds.length === 0 && viewType === 'month') return null;

                    return (
                      <div key={dateStr} className="space-y-4">
                        <div className="flex items-center gap-3 px-1">
                          <div className="p-2 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] text-blue-500">
                            <CalIcon size={14} strokeWidth={3} />
                          </div>
                          <div className="flex-1 border-b border-[var(--color-bg-border)] pb-1.5 flex items-center justify-between">
                            <span className="font-black text-xs uppercase tracking-widest text-[var(--color-text-primary)]">{format(day, 'EEEE, MMM dd')}</span>
                            <span className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-[0.2em] bg-[var(--color-bg-workspace)] px-2.5 py-0.5 rounded-lg border border-[var(--color-bg-border)]">
                              {userIds.length} ACTIVE
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 pl-3">
                          {userIds.length === 0 ? (
                            <div className="p-8 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl opacity-30 bg-[var(--color-bg-workspace)]">
                              <p className="text-[9px] font-black uppercase tracking-[0.3em] italic">No technical logs recorded</p>
                            </div>
                          ) : userIds.map(uid => {
                            const uLogs = dateLogs[uid];
                            const userObj = users.find(u => u._id === uid) || uLogs[0]?.userId;
                            const totalTime = getDayTotalTime(uLogs);

                            return (
                              <button
                                key={uid}
                                onClick={() => {
                                  setSelectedFeedLogs(uLogs);
                                  setFeedTarget({ name: userObj?.name, date: dateStr });
                                }}
                                className="flex items-center justify-between bg-[var(--color-bg-workspace)] p-4 rounded-[1.5rem] border border-[var(--color-bg-border)] hover:border-blue-500/30 transition-all shadow-sm group hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-11 h-11 rounded-xl bg-[var(--color-bg-surface)] overflow-hidden border border-[var(--color-bg-border)] group-hover:border-blue-500/30 transition-all shadow-inner relative">
                                    {userObj?.avatar ? <img src={userObj.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xs uppercase tracking-tighter">{userObj?.name?.substring(0, 2)}</div>}
                                    <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white shadow-sm" />
                                  </div>
                                  <div className="text-left">
                                    <p className="text-base font-black text-[var(--color-text-primary)] tracking-tight group-hover:text-blue-600 transition-colors">{userObj?.name || 'System'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded-lg border border-blue-500/10">{uLogs.length} Entries</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-8 pr-2">
                                  <div className="text-right">
                                    <p className="text-lg font-black text-black leading-none">{formatMins(totalTime)}</p>
                                    <p className="text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-widest mt-0.5">Duty</p>
                                  </div>
                                  <div className="p-2.5 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm active:scale-90">
                                    <ChevronRight size={18} strokeWidth={3} />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.section>
            ) : (
              <motion.section
                key="drill-down"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-2xl overflow-hidden flex flex-col min-h-[800px]"
              >
                <div className="px-8 py-8 border-b border-[var(--color-bg-border)] bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setSelectedFeedLogs(null)}
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all border border-white/5 active:scale-90"
                    >
                      <ArrowLeft size={16} strokeWidth={3} />
                    </button>
                    <div>
                      <h3 className="text-lg font-black tracking-tight uppercase">{feedTarget?.name}'s Technical Audit</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mt-0.5">{feedTarget?.date}</p>
                    </div>
                  </div>
                  <Badge variant="progress">DETAILED</Badge>
                </div>

                {/* Tabs Selector */}
                <div className="p-6 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/50">
                  <div className="flex items-center gap-2 bg-[var(--color-bg-surface)] p-1.5 rounded-2xl border border-[var(--color-bg-border)] w-fit shadow-sm">
                    <button
                      onClick={() => setActiveTab('manual')}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'bg-slate-900 text-white shadow-xl' : 'text-[var(--color-text-muted)] hover:text-black'}`}
                    >
                      <CalIcon size={14} />
                      Daily Task Logs
                    </button>
                    <button
                      onClick={() => setActiveTab('api')}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'api' ? 'bg-slate-900 text-white shadow-xl' : 'text-[var(--color-text-muted)] hover:text-black'}`}
                    >
                      <Activity size={14} />
                      API / System Activity
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-gradient-to-b from-[var(--color-bg-workspace)] to-transparent">
                  {filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[300px] space-y-4 opacity-30">
                      <div className="p-6 bg-[var(--color-bg-workspace)] rounded-[2rem] border-2 border-dashed border-[var(--color-bg-border)]">
                        <Target size={32} className="text-[var(--color-text-muted)]" />
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-[0.4em]">No activity found</p>
                    </div>
                  ) : filteredLogs.map((log, idx) => (
                    <motion.div
                      key={log._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group relative pl-10 border-l-2 border-[var(--color-bg-border)] hover:border-blue-500/50 transition-all py-1.5"
                    >
                      <div className="absolute left-[-9px] top-3 w-4 h-4 rounded-full bg-white border-4 border-blue-500 shadow-xl z-10 group-hover:scale-110 transition-transform" />
                      <div className="bg-[var(--color-bg-surface)] p-6 rounded-[2rem] border border-[var(--color-bg-border)] shadow-sm hover:shadow-xl hover:border-blue-500/20 transition-all relative overflow-hidden">
                        {log.action === 'DAILY_LOG' && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-3">
                            <Badge variant={log.action === 'DAILY_LOG' ? 'done' : 'progress'}>
                              {log.action === 'DAILY_LOG' ? 'TASK COMPLETED' : log.action.replace('_', ' ')}
                            </Badge>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)]">
                              <Clock size={10} className="text-blue-500" />
                              <span className="text-[9px] font-black text-black">
                                {format(new Date(log.createdAt), 'HH:mm:ss')}
                              </span>
                            </div>
                          </div>
                          {log.details?.timeSpent && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all">
                              <Timer size={12} strokeWidth={3} />
                              <span className="text-[10px] font-black">{log.details.timeSpent}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 relative z-10">
                          <h4 className="text-base font-black text-[var(--color-text-primary)] leading-tight group-hover:text-blue-600 transition-colors">
                            {log.details?.title || log.targetType}
                          </h4>
                          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed font-medium bg-[var(--color-bg-workspace)] p-4 rounded-xl border border-[var(--color-bg-border)]/50">
                            {log.details?.message || 'Operational integrity check completed.'}
                          </p>
                          {(log.details?.project || log.targetId) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {log.details?.project && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-lg">
                                  <Target size={10} />
                                  {log.details.project}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-lg text-[8px] font-bold text-[var(--color-text-muted)]">
                                ID: {log.targetId?.toString().substring(0, 12)}...
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default AdminLogsPage;
