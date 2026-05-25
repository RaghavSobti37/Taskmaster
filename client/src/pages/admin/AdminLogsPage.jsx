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
  Terminal,
  Play,
  AlertTriangle,
  FileText,
  AlertOctagon,
  RefreshCw,
  TerminalSquare
} from 'lucide-react';
import { Badge, PageHeader, PageContainer, Card, TabSwitcher, PageSkeleton, Button, VisualExplainerModal, InfoButton } from '../../components/ui';
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
  
  // Unified Log Source: 'human' or 'qa'
  const [logSource, setLogSource] = useState('human');
  const [qaRunning, setQaRunning] = useState(false);
  const [qaOutput, setQaOutput] = useState('');
  const [qaError, setQaError] = useState(null);
  const [expandedQaLogId, setExpandedQaLogId] = useState(null);

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

      let url = `/api/logs?limit=1000&startDate=${startDate}&endDate=${endDate}`;
      if (selectedUserId !== 'all' && logSource === 'human') {
        url += `&userId=${selectedUserId}`;
      }
      if (logSource === 'qa') {
        url += '&origin=QA_AGENT_TEST';
      }

      const res = await axios.get(url);
      
      if (logSource === 'human') {
        // Exclude E2E testing logs from human activity view
        setLogs(res.data.filter(l => l.origin !== 'QA_AGENT_TEST'));
      } else {
        setLogs(res.data);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunQA = async () => {
    try {
      setQaRunning(true);
      setQaError(null);
      setQaOutput('Initializing structured E2E testing sandbox...\nRunning webhook triggers and sanitization test loops...');
      const res = await axios.post('/api/logs/run-qa');
      setQaOutput(res.data.stdout || res.data.message || 'QA run executed successfully.');
      fetchLogs();
    } catch (err) {
      console.error('QA run error:', err);
      setQaError(err.response?.data?.error || err.message);
      setQaOutput((err.response?.data?.stdout || '') + `\n\n[CRITICAL ERROR] Pipeline execution terminated: ` + (err.response?.data?.error || err.message));
    } finally {
      setQaRunning(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [selectedUserId, viewType, selectedDate, logSource]);

  // Grouping for Human View
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
      const time = log.details?.timeSpent || log.payload?.timeSpent;
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

  // QA Calculations
  const qaAssertions = logs.filter(l => l.origin === 'QA_AGENT_TEST');
  const qaBugs = qaAssertions.filter(l => l.status === 'BUG_DETECTED');
  const qaSuccessRate = qaAssertions.length > 0 
    ? Math.round(((qaAssertions.length - qaBugs.length) / qaAssertions.length) * 100) 
    : 100;

  if (loading && logs.length === 0) return <PageSkeleton />;

  const filteredLogs = selectedFeedLogs ? selectedFeedLogs.filter(log => {
    if (activeTab === 'manual') return log.action === 'DAILY_LOG' || log.actionType === 'DAILY_LOG';
    return log.action !== 'DAILY_LOG' && log.actionType !== 'DAILY_LOG';
  }) : [];

  return (
    <PageContainer>
      <PageHeader
        title={logSource === 'qa' ? "Autonomous QA Monitoring" : "Activity & System Logs"}
        subtitle={logSource === 'qa' ? "Run E2E pipeline checks and track automated bug detection." : "Track user actions, logins, and database activity."}
        icon={ShieldCheck}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="xs" variant="secondary" onClick={() => setIsExplainerOpen(true)}>
              <Terminal size={12} className="mr-1.5" /> System Flow
            </Button>
            <TabSwitcher
              activeTab={logSource}
              onChange={(id) => {
                setLogSource(id);
                setSelectedFeedLogs(null);
              }}
              tabs={[
                { id: 'human', label: 'Human User Changes' },
                { id: 'qa', label: 'QA Agent Runs' }
              ]}
            />
            {logSource === 'human' && (
              <TabSwitcher
                activeTab={viewType}
                onChange={setViewType}
                tabs={[
                  { id: 'day', label: 'Daily View' },
                  { id: '7d', label: '7-Day Summary' },
                  { id: 'month', label: 'Monthly View' }
                ]}
              />
            )}
          </div>
        }
      />

      {/* Ribbon metrics */}
      {logSource === 'human' ? (
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Total Activity', value: logs.length, icon: BarChart3, color: 'text-blue-400', bg: 'bg-blue-500/5' },
            { label: 'Time Tracked', value: formatMins(getDayTotalTime(logs)), icon: Timer, color: 'text-emerald-400', bg: 'bg-emerald-500/5' },
            { label: 'Active Users', value: new Set(logs.map(l => l.userId?._id || l.actorId)).size, icon: Users, color: 'text-orange-400', bg: 'bg-orange-500/5' },
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
      ) : (
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'QA Assertions Run', value: qaAssertions.length, icon: Terminal, color: 'text-blue-400', bg: 'bg-blue-500/5', info: 'Total structural test assertions executed.' },
            { label: 'Bugs Identified', value: qaBugs.length, icon: AlertOctagon, color: qaBugs.length > 0 ? 'text-red-400' : 'text-emerald-400', bg: qaBugs.length > 0 ? 'bg-red-500/5' : 'bg-emerald-500/5', info: 'Detected system failures requiring attention.' },
            { label: 'Assertion Pass Rate', value: `${qaSuccessRate}%`, icon: ShieldCheck, color: qaSuccessRate === 100 ? 'text-emerald-400' : 'text-amber-400', bg: 'bg-emerald-500/5', info: 'Percentage of successful assertion checks.' },
            { label: 'QA Agent Status', value: qaBugs.length > 0 ? 'Bug Alert' : 'Healthy', icon: Zap, color: qaBugs.length > 0 ? 'text-red-400' : 'text-emerald-400', bg: 'bg-emerald-500/5', info: 'Overall operational condition of testing pipeline.' }
          ].map((stat, i) => (
            <motion.div key={i} variants={itemVariants} className="bg-[var(--color-bg-surface)] p-4 rounded-2xl border border-[var(--color-bg-border)] shadow-2xl relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-16 h-16 ${stat.bg} blur-2xl rounded-full`} />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className={`text-[8px] font-black uppercase tracking-[0.2em] ${stat.color}`}>
                    {stat.label}
                    {stat.info && <InfoButton text={stat.info} />}
                  </p>
                  <h3 className="text-xl font-black text-[var(--color-text-primary)]">{stat.value}</h3>
                </div>
                <div className={`p-2 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] ${stat.color}`}>
                  <stat.icon size={16} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.section>
      )}

      {/* Main Panel Content */}
      <main className="w-full space-y-8">
        {logSource === 'human' ? (
          <AnimatePresence mode="wait">
            {!selectedFeedLogs ? (
              <motion.section
                exit={{ opacity: 0, x: -20 }}
              >
                <Card className="overflow-hidden flex flex-col min-h-[600px] !p-0">
                  <div className="p-4 border-b border-[var(--color-bg-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]/50">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                        <Activity size={18} strokeWidth={2.5} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black tracking-tight text-[var(--color-text-primary)] uppercase flex items-center gap-2">
                          Human Actions Feed <Badge variant="neutral" className="text-[8px] uppercase tracking-widest font-mono">Live Logs</Badge>
                        </h3>
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

                  <div className="p-4 space-y-6">
                    {days.reverse().map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const dateLogs = groupedLogs[dateStr] || {};
                      const userIds = Object.keys(dateLogs);
                      
                      if (userIds.length === 0 && viewType !== 'day') return null;

                      return (
                        <div key={dateStr} className="space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)] text-blue-500">
                              <CalIcon size={12} strokeWidth={3} />
                            </div>
                            <span className="font-black text-xs uppercase tracking-widest text-[var(--color-text-primary)]">{format(day, 'EEEE, MMM dd')}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {userIds.length === 0 ? (
                              <div className="col-span-full p-8 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-2xl opacity-20">
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
                                    setFeedTarget({ name: userObj?.name || 'System / Automation', date: dateStr });
                                  }}
                                  className="flex items-center justify-between bg-[var(--color-bg-workspace)] p-4 rounded-2xl border border-[var(--color-bg-border)] hover:border-blue-500 transition-all group"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-surface)] overflow-hidden border border-[var(--color-bg-border)] flex items-center justify-center">
                                      {userObj?.avatar ? <img src={userObj.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-xs">{userObj?.name?.substring(0, 2) || 'SYS'}</div>}
                                    </div>
                                    <div className="text-left">
                                      <p className="text-xs font-black text-[var(--color-text-primary)]">{userObj?.name || 'System / Automation'}</p>
                                      <Badge variant="neutral" className="!text-[8px]">{uLogs.length} entries</Badge>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-black">{formatMins(totalTime)}</p>
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
                <Card className="overflow-hidden min-h-[600px] !p-0">
                  <div className="p-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] text-[var(--color-text-primary)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelectedFeedLogs(null)} className="p-2 bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl hover:bg-[var(--color-bg-border)] transition-all"><ArrowLeft size={14} /></button>
                      <div>
                        <h3 className="text-sm font-black uppercase italic">{feedTarget?.name}'s Activity</h3>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{format(new Date(feedTarget?.date), 'MMMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setActiveTab('manual')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeTab === 'manual' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-bg-border)]'}`}>Daily Logs</button>
                      <button onClick={() => setActiveTab('api')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${activeTab === 'api' ? 'bg-[var(--color-action-primary)] text-white' : 'bg-[var(--color-bg-surface)] text-[var(--color-text-muted)] border border-[var(--color-bg-border)]'}`}>System Activity</button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {filteredLogs.map(log => (
                      <div key={log._id} className="p-4 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-2xl space-y-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-500"><Activity size={12} /></div>
                            <span className="text-xs font-black uppercase tracking-tight">{log.details?.title || log.action || log.actionType}</span>
                          </div>
                          <span className="text-[9px] font-mono text-[var(--color-text-muted)]">{format(new Date(log.createdAt || log.timestamp), 'HH:mm:ss')}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium leading-relaxed">{log.details?.message || log.details?.notes || log.payload?.message || 'No description provided'}</p>
                        {(log.details?.timeSpent || log.payload?.timeSpent) && (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-500 uppercase">
                            <Clock size={10} /> {log.details?.timeSpent || log.payload?.timeSpent}
                          </div>
                        )}
                      </div>
                    ))}
                    {filteredLogs.length === 0 && <div className="p-16 text-center opacity-20"><Activity size={32} className="mx-auto mb-3" /><p className="text-xs font-black uppercase">No entries found</p></div>}
                  </div>
                </Card>
              </motion.section>
            )}
          </AnimatePresence>
        ) : (
          /* QA Agent View Panel */
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Testing execution control */}
            <Card className="p-4 bg-[var(--color-bg-surface)] border-[var(--color-bg-border)] flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-text-primary)]">Trigger Autonomous Staging Checks</h4>
                <p className="text-[10px] text-[var(--color-text-muted)] font-medium">Bypasses client front-end. Triggers E2E sandboxed webhook deduplication, database validations, and proxy events.</p>
              </div>
              <Button 
                onClick={handleRunQA} 
                disabled={qaRunning} 
                variant="primary"
                className="shadow-lg shadow-[var(--color-action-primary)]/10 font-black uppercase text-[10px] tracking-wider shrink-0"
              >
                {qaRunning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-1.5" />
                    Executing Suite...
                  </>
                ) : (
                  <>
                    <Play size={14} className="mr-1.5" />
                    Run Autonomous QA Suite
                  </>
                )}
              </Button>
            </Card>

            {/* Terminal output console stream */}
            {qaOutput && (
              <Card className="!p-0 border border-slate-800 overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-[var(--color-bg-border)] dark:border-slate-850 flex items-center justify-between text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <TerminalSquare size={14} className="text-blue-500" />
                    <span>Pipeline Runtime Console</span>
                  </div>
                  <Badge variant={qaError ? 'danger' : qaRunning ? 'warning' : 'success'}>
                    {qaRunning ? 'Running' : qaError ? 'Execution Error' : 'Terminated'}
                  </Badge>
                </div>
                <div className="bg-slate-950 p-4 font-mono text-xs text-slate-300 max-h-80 overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
                  {qaOutput}
                </div>
              </Card>
            )}

            {/* Bug Ledger Summary */}
            {qaBugs.length > 0 && (
              <Card className="border border-red-500/20 bg-red-500/5 p-4 space-y-4">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertOctagon size={18} />
                  <h3 className="text-xs font-black uppercase tracking-widest">Bug Tracker Report Ledger ({qaBugs.length} Alerts)</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {qaBugs.map(bug => (
                    <div 
                      key={bug._id} 
                      className="border border-red-500/10 bg-red-950/20 rounded-xl p-3 space-y-2 text-xs"
                      style={{ borderLeftWidth: '4px', borderLeftColor: 'rgb(239, 68, 68)' }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="danger" className="font-mono uppercase !text-[8px] tracking-wider mr-2">
                            {bug.targetEntity || 'System'}
                          </Badge>
                          <span className="font-black text-[var(--color-text-primary)]">{bug.payload?.testCase || bug.actionType}</span>
                        </div>
                        <span className="text-[9px] font-mono text-[var(--color-text-muted)]">
                          {format(new Date(bug.timestamp || bug.createdAt), 'dd-MM-yyyy HH:mm:ss')}
                        </span>
                      </div>
                      <p className="text-[11px] text-red-400 font-semibold">{bug.payload?.message || 'Assertion failed.'}</p>
                      
                      {/* Detailed Error Context Stack */}
                      {bug.payload?.errorStack && (
                        <details className="mt-2 group">
                          <summary className="text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-wider cursor-pointer outline-none select-none hover:text-[var(--color-text-primary)]">
                            View Failure Call Stack
                          </summary>
                          <pre className="mt-2 p-2 bg-black/45 border border-white/5 rounded-lg font-mono text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                            {bug.payload.errorStack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Complete QA Assertion Run List */}
            <Card className="!p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/50 flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Chronological Assertion Feed</h4>
                <Badge variant="info" className="!text-[8px]">{qaAssertions.length} Assertions Total</Badge>
              </div>
              <div className="divide-y divide-[var(--color-bg-border)]">
                {qaAssertions.map(log => {
                  const isBug = log.status === 'BUG_DETECTED';
                  const isExpanded = expandedQaLogId === log._id;

                  return (
                    <div 
                      key={log._id} 
                      className={`p-3 transition-colors ${isBug ? 'bg-red-500/[0.02] hover:bg-red-500/[0.04]' : 'hover:bg-[var(--color-bg-secondary)]'}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-lg shrink-0 ${isBug ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {isBug ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-black text-[var(--color-text-primary)] truncate">
                                {log.payload?.testCase || log.actionType}
                              </span>
                              <Badge variant={isBug ? 'danger' : 'success'} className="!text-[8px] uppercase tracking-widest font-mono">
                                {log.targetEntity || 'System'}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-[var(--color-text-muted)] truncate font-medium">
                              {log.payload?.message || 'Check passed successfully.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {log.executionTimeMs && (
                            <span className="text-[9px] font-mono text-[var(--color-text-muted)] bg-[var(--color-bg-workspace)] px-1.5 py-0.5 rounded border border-[var(--color-bg-border)]">
                              {log.executionTimeMs}ms
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-[var(--color-text-muted)] hidden sm:inline">
                            {format(new Date(log.timestamp || log.createdAt), 'HH:mm:ss')}
                          </span>
                          <button 
                            onClick={() => setExpandedQaLogId(isExpanded ? null : log._id)}
                            className="p-1 hover:bg-[var(--color-bg-border)] rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                          >
                            <FileText size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail section */}
                      {isExpanded && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-3 p-3 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl space-y-2 text-xs font-mono"
                        >
                          <div className="flex justify-between items-center text-[9px] text-[var(--color-text-muted)] font-black uppercase tracking-wider border-b border-[var(--color-bg-border)] pb-1">
                            <span>Assertion Node Properties</span>
                            <span>ID: {log._id}</span>
                          </div>
                          <pre className="text-[10px] text-[var(--color-text-secondary)] overflow-x-auto whitespace-pre-wrap select-text leading-relaxed p-1 bg-black/10 rounded">
                            {JSON.stringify(log.payload || log.details || {}, null, 2)}
                          </pre>
                        </motion.div>
                      )}
                    </div>
                  );
                })}

                {qaAssertions.length === 0 && (
                  <div className="p-16 text-center opacity-25 space-y-2">
                    <Terminal size={32} className="mx-auto" />
                    <p className="text-xs font-black uppercase tracking-widest">No QA assertions found in logs</p>
                    <p className="text-[10px] font-medium">Click the button above to run checks and hydrate the stream.</p>
                  </div>
                )}
              </div>
            </Card>
          </motion.section>
        )}
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
