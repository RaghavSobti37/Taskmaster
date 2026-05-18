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
  isSameDay,
  startOfDay,
  endOfDay
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
  ShieldCheck,
  Layers,
  Zap,
  Terminal
} from 'lucide-react';
import { Badge, PageHeader, PageContainer, Card, TabSwitcher, PageSkeleton, Button, VisualExplainerModal } from '../../components/ui';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const systemFlowData = {
  subtitle: "System Activity & Audit Logs",
  mermaid: `graph TD
    classDef core fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef pulse fill:#111827,stroke:#10B981,stroke-width:2px,color:#34D399;
    classDef warn fill:#111827,stroke:#F59E0B,stroke-width:2px,color:#FBBF24;

    A[Client Request / Action]:::core --> B(Express Gateway API)
    B --> C{Auth Middleware}
    C -->|Clerk Verified| D[System Activity Logger]:::pulse
    C -->|Legacy JWT| D
    D --> E[Activity Log Stream]
    E --> F[Supabase Realtime Broadcast]:::pulse
    D --> G[Trigger.dev Queue Dispatch]:::warn`,
  reportHtml: `
    <div class="space-y-4">
      <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-mono text-xs">
        [SYSTEM LOGS ACTIVE]: Connected to live activity stream.
      </div>
      <table class="w-full text-left font-mono text-xs">
        <tr class="border-b border-white/10 text-slate-400"><th>Subsystem</th><th>Status</th><th>Latency</th></tr>
        <tr class="border-b border-white/5"><td>Auth Engine (Clerk)</td><td><span class="text-emerald-400">ACTIVE</span></td><td>14ms</td></tr>
        <tr class="border-b border-white/5"><td>Database (MongoDB)</td><td><span class="text-emerald-400">ACTIVE</span></td><td>8ms</td></tr>
        <tr class="border-b border-white/5"><td>Realtime Updates (Supabase)</td><td><span class="text-emerald-400">CONNECTED</span></td><td>22ms</td></tr>
        <tr><td>Background Jobs (Trigger.dev)</td><td><span class="text-amber-400">STANDBY</span></td><td>--</td></tr>
      </table>
    </div>
  `
};

const AdminLogsPage = () => {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(searchParams.get('user') || 'all');
  const [viewType, setViewType] = useState('7d');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedFeedLogs, setSelectedFeedLogs] = useState(null);
  const [feedTarget, setFeedTarget] = useState(null);
  const [activeTab, setActiveTab] = useState('manual');
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
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

      if (viewType === 'day') {
        startDate = startOfDay(selectedDate).toISOString();
        endDate = endOfDay(selectedDate).toISOString();
      } else if (viewType === '7d') {
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

  const days = viewType === 'day'
    ? [selectedDate]
    : viewType === '7d'
    ? eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() })
    : eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });

  if (loading && logs.length === 0) return <PageSkeleton />;

  const filteredLogs = selectedFeedLogs ? selectedFeedLogs.filter(log => {
    if (activeTab === 'manual') return log.action === 'DAILY_LOG';
    return log.action !== 'DAILY_LOG';
  }) : [];

  return (
    <PageContainer>
      <PageHeader
        title="Activity & System Logs"
        subtitle="Track user actions, logins, and database activity."
        icon={ShieldCheck}
        actions={
          <div className="flex items-center gap-2">
            <Button size="xs" variant="primary" onClick={() => setIsExplainerOpen(true)}>
              <Terminal size={12} className="mr-1.5" /> System Flow Diagram
            </Button>
            <TabSwitcher
              activeTab={viewType}
              onChange={setViewType}
              tabs={[
                { id: 'day', label: 'Daily View' },
                { id: '7d', label: '7-Day Summary' },
                { id: 'month', label: 'Monthly View' }
              ]}
            />
          </div>
        }
      />

      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: 'Total Activity', value: logs.length, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/5' },
          { label: 'Time Tracked', value: formatMins(getDayTotalTime(logs)), icon: Timer, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
          { label: 'Active Users', value: new Set(logs.map(l => l.userId?._id)).size, icon: Users, color: 'text-orange-400', bg: 'bg-orange-500/5' },
          { label: 'Avg. per Day', value: Math.round(logs.length / Math.max(1, days.length)), icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/5' }
        ].map((stat, i) => (
          <motion.div key={i} variants={itemVariants} className="bg-[var(--color-bg-surface)] p-4 rounded-2xl border border-[var(--color-bg-border)] shadow-2xl relative overflow-hidden group">
            <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bg} blur-2xl rounded-full`} />
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${stat.color}`}>{stat.label}</p>
                <h3 className="text-xl font-black text-[var(--color-text-primary)]">{stat.value}</h3>
              </div>
              <div className={`p-2 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] ${stat.color}`}>
                <stat.icon size={16} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.section>

      <main className="w-full space-y-10">
        <AnimatePresence mode="wait">
          {!selectedFeedLogs ? (
            <motion.section
              exit={{ opacity: 0, x: -20 }}
          >
            <Card className="overflow-hidden flex flex-col min-h-[600px]">
              <div className="px-8 py-8 border-b border-[var(--color-bg-border)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                    <Activity size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] uppercase flex items-center gap-2">
                      System Activity <Badge variant="mint" className="text-[8px]">Live Stream</Badge>
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] font-medium">Overview of user actions and automated background tasks.</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-[var(--color-bg-workspace)] p-1 rounded-xl border border-[var(--color-bg-border)]">
                    <button onClick={() => setSelectedDate(subDays(selectedDate, viewType === 'day' ? 1 : viewType === '7d' ? 7 : 30))} className="p-2 hover:bg-[var(--color-bg-surface)] rounded-lg transition-all"><ChevronLeft size={14} /></button>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2">{viewType === 'day' ? format(selectedDate, 'MMM dd, yyyy') : format(selectedDate, 'MMMM yyyy')}</span>
                    <button onClick={() => setSelectedDate(new Date(selectedDate.getTime() + (viewType === 'day' ? 86400000 : 0)))} className="p-2 hover:bg-[var(--color-bg-surface)] rounded-lg transition-all" disabled={isSameDay(selectedDate, new Date())}><ChevronRight size={14} /></button>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {days.reverse().map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dateLogs = groupedLogs[dateStr] || {};
                  const userIds = Object.keys(dateLogs);
                  
                  if (userIds.length === 0 && viewType !== 'day') return null;

                  return (
                    <div key={dateStr} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] text-blue-500">
                          <CalIcon size={14} strokeWidth={3} />
                        </div>
                        <span className="font-black text-xs uppercase tracking-widest text-[var(--color-text-primary)]">{format(day, 'EEEE, MMM dd')}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {userIds.length === 0 ? (
                          <div className="col-span-full p-12 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-3xl opacity-20">
                            <p className="text-xs font-black uppercase tracking-widest">No activity for this day</p>
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
                              className="flex items-center justify-between bg-[var(--color-bg-workspace)] p-5 rounded-[2rem] border border-[var(--color-bg-border)] hover:border-blue-500 transition-all group"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-surface)] overflow-hidden border border-[var(--color-bg-border)]">
                                  {userObj?.avatar ? <img src={userObj.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xs">{userObj?.name?.substring(0, 2)}</div>}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-black text-[var(--color-text-primary)]">{userObj?.name || 'System'}</p>
                                  <Badge variant="todo">{uLogs.length} entries</Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-black">{formatMins(totalTime)}</p>
                                <p className="text-[8px] font-black uppercase text-[var(--color-text-muted)]">Active Duration</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.section>
          ) : (
            <motion.section
              exit={{ opacity: 0, x: 20 }}
          >
            <Card className="overflow-hidden min-h-[600px]">
              <div className="px-8 py-8 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedFeedLogs(null)} className="p-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl hover:bg-[var(--color-bg-border)] transition-all"><ArrowLeft size={16} /></button>
                  <div>
                    <h3 className="text-lg font-black uppercase italic">{feedTarget?.name}'s Activity</h3>
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{format(new Date(feedTarget?.date), 'MMMM dd, yyyy')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActiveTab('manual')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeTab === 'manual' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-bg-border)]'}`}>Daily Logs</button>
                  <button onClick={() => setActiveTab('api')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeTab === 'api' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-bg-border)]'}`}>System Activity</button>
                </div>
              </div>
              <div className="p-8 space-y-4">
                {filteredLogs.map(log => (
                  <div key={log._id} className="p-6 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500"><Activity size={14} /></div>
                        <span className="text-xs font-black uppercase tracking-tight">{log.details?.title || log.action}</span>
                      </div>
                      <span className="text-[10px] font-black text-[var(--color-text-muted)]">{format(new Date(log.createdAt), 'HH:mm:ss')}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] font-medium leading-relaxed">{log.details?.message || log.details?.notes || 'No description provided'}</p>
                    {log.details?.timeSpent && (
                      <div className="flex items-center gap-2 text-[9px] font-black text-blue-500 uppercase">
                        <Clock size={12} /> {log.details.timeSpent}
                      </div>
                    )}
                  </div>
                ))}
                {filteredLogs.length === 0 && <div className="p-20 text-center opacity-20"><Activity size={48} className="mx-auto mb-4" /><p className="text-xs font-black uppercase">No entries found</p></div>}
              </div>
            </Card>
          </motion.section>
          )}
        </AnimatePresence>
      </main>

      <VisualExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
        title="System Activity Flow"
        data={systemFlowData}
      />
    </PageContainer>
  );
};

export default AdminLogsPage;
export { AdminLogsPage as AdminLogsContent };
