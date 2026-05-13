import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import {
  Calendar as CalIcon,
  CheckCircle2,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  Plus,
  Send,
  Timer,
  Zap,
  Target,
  Circle,
  Activity,
  Trophy,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge, NexusModal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

const DailyLogPage = ({ adminViewUserId, adminViewUserName }) => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const initialDate = searchParams.get('date') ? new Date(searchParams.get('date')) : new Date();
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetUserName, setTargetUserName] = useState(adminViewUserName || '');
  const [tasks, setTasks] = useState([]);
  const targetUserId = adminViewUserId || searchParams.get('user') || user?._id;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, projectsRes, tasksRes] = await Promise.all([
        axios.get(`/api/logs?userId=${targetUserId}&limit=200`),
        axios.get('/api/projects'),
        axios.get('/api/tasks')
      ]);
      setLogs(logsRes.data);
      setProjects(projectsRes.data);
      setTasks(tasksRes.data.filter(t => 
        t.assignees?.some(a => (typeof a === 'string' ? a : a._id) === targetUserId)
      ));

      if (targetUserId !== user?._id && !adminViewUserName) {
        const userRes = await axios.get(`/api/users/directory`);
        const found = userRes.data.users.find(u => u._id === targetUserId);
        if (found) setTargetUserName(found.name);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetUserId) fetchData();
  }, [targetUserId]);

  const handleDateChange = (days) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(nextDate);
  };

  const handleManualSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await axios.post('/api/logs', {
        action: 'DAILY_LOG',
        details: {
          title,
          message: description,
          timeSpent,
          project: projects.find(p => p._id === selectedProject)?.name || 'General'
        },
        targetId: selectedProject || null,
        targetType: selectedProject ? 'Project' : 'System'
      });

      setTitle('');
      setDescription('');
      setTimeSpent('');
      setSelectedProject('');
      fetchData();
      setModalOpen(true);
    } catch (err) {
      console.error('Manual log submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const addDummyData = () => {
    setTitle('Automated System Audit');
    setDescription('Performed a routine check of the CRM backend and synchronized data states.');
    setTimeSpent('1h 45m');
    if (projects.length > 0) setSelectedProject(projects[0]._id);
  };

  const dailyLogs = logs.filter(l => 
    l.action === 'DAILY_LOG' && isSameDay(new Date(l.createdAt), selectedDate)
  );
  
  const dailyTasks = tasks.filter(t => {
    const taskDate = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
    return isSameDay(taskDate, selectedDate);
  });

  const totalMinutes = dailyLogs.reduce((acc, log) => {
    const time = log.details?.timeSpent;
    if (!time) return acc;
    const hours = time.match(/(\d+(?:\.\d+)?)\s*h/);
    const mins = time.match(/(\d+)\s*m/);
    let total = 0;
    if (hours) total += parseFloat(hours[1]) * 60;
    if (mins) total += parseInt(mins[1]);
    if (!hours && !mins && !isNaN(time)) total += parseInt(time);
    return acc + total;
  }, 0);

  const formatTime = (totalMins) => {
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const timeOptions = [];
  for (let h = 0; h <= 8; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 0 && m === 0) continue;
      if (h === 8 && m > 0) break;
      const label = h > 0 ? `${h}h ${m > 0 ? `${m}m` : ''}` : `${m}m`;
      timeOptions.push(label);
    }
  }

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

  return (
    <div className="max-w-[1400px] mx-auto space-y-12 pb-24 px-4 sm:px-6 lg:px-8">
      {/* Premium Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[var(--color-action-primary)]/10 rounded-xl text-[var(--color-action-primary)]">
              <Activity size={18} strokeWidth={2.5} />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-[var(--color-text-primary)] leading-tight">
              {targetUserName ? `${targetUserName}'s Log` : 'My Daily Log'}
            </h1>
          </div>
          <p className="text-[10px] md:text-xs font-medium text-[var(--color-text-muted)] ml-12 md:ml-14">Track your daily work and time spent on tasks.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-[var(--color-bg-surface)] p-1 rounded-xl border border-[var(--color-bg-border)] shadow-sm">
            <button
              onClick={() => handleDateChange(-1)}
              className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-lg transition-all active:scale-95 text-[var(--color-text-secondary)]"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>

            <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-workspace)] rounded-lg border border-[var(--color-bg-border)]/50 shadow-inner min-w-[140px] justify-center">
              <CalIcon size={12} className="text-[var(--color-action-primary)]" />
              <span className="font-black text-[10px] tracking-tight truncate">{format(selectedDate, 'EEEE, MMM dd')}</span>
            </div>

            <button
              onClick={() => handleDateChange(1)}
              disabled={isSameDay(selectedDate, new Date())}
              className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-lg transition-all active:scale-95 text-[var(--color-text-secondary)] disabled:opacity-20"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </motion.header>

      {/* Stats Row: Tactical Summary */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6"
      >
        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Log Entries</p>
              <h3 className="text-lg md:text-2xl font-black text-white">{dailyLogs.length}</h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-blue-400">
              <Zap size={16} className="md:size-18 fill-blue-400/20" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Time Logged</p>
              <h3 className="text-lg md:text-2xl font-black text-white">{formatTime(totalMinutes)}</h3>
            </div>
            <div className="p-2 md:p-3 bg-white/5 rounded-lg md:rounded-xl border border-white/10 text-emerald-400">
              <Timer size={16} className="md:size-18 fill-emerald-400/20" />
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-slate-900 p-4 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group col-span-2 md:col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-3xl rounded-full" />
          <div className="relative z-10 space-y-2 md:space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">Daily Goal</p>
              <Trophy size={14} className="text-orange-400" />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-base md:text-lg font-black text-white">{Math.min(100, Math.round((totalMinutes / 480) * 100))}%</span>
                <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  {totalMinutes >= 480 ? 'Goal Reached!' : 'In Progress'}
                </span>
              </div>
              <div className="w-full bg-white/5 h-1 md:h-1.5 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (totalMinutes / 480) * 100)}%` }}
                  className="bg-gradient-to-r from-orange-500 to-amber-400 h-full"
                />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Main Area: Daily Logs (LEFT) */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-8 order-2 lg:order-1"
        >
          <section className="bg-[var(--color-bg-surface)] rounded-[2.5rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden flex flex-col min-h-[600px]">
            <div className="px-10 py-10 border-b border-[var(--color-bg-border)] bg-gradient-to-b from-[var(--color-bg-workspace)] to-transparent flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500 shadow-sm">
                  <Layout size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight text-[var(--color-text-primary)]">Today's Work</h3>
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">Your logged work entries for the selected day.</p>
                </div>
              </div>
              <div className="px-5 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                {dailyLogs.length} LOGS
              </div>
            </div>
            
            <div className="p-10 space-y-10">
              <AnimatePresence mode="wait">
                {loading ? (
                  <div className="p-32 text-center animate-pulse space-y-4">
                    <Activity size={32} className="mx-auto text-[var(--color-action-primary)]/20" />
                    <p className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Loading...</p>
                  </div>
                ) : dailyLogs.length === 0 ? (
                  <div className="p-32 text-center border-2 border-dashed border-[var(--color-bg-border)] rounded-[2.5rem] opacity-30 space-y-4">
                    <Send size={32} className="mx-auto" />
                    <p className="text-xs font-black uppercase tracking-widest">No work logged for this day yet.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {dailyLogs.map((log, idx) => (
                      <motion.div
                        key={log._id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="relative pl-10 before:absolute before:left-[11px] before:top-8 before:bottom-[-40px] before:w-[2px] before:bg-gradient-to-b before:from-[var(--color-bg-border)] before:to-transparent last:before:hidden"
                      >
                        <div className="absolute left-0 top-1 w-6 h-6 rounded-xl bg-[var(--color-bg-surface)] border-4 border-[var(--color-action-primary)] shadow-md z-10" />
                        
                        <div className="p-8 bg-[var(--color-bg-workspace)]/40 rounded-[2rem] border border-[var(--color-bg-border)] group hover:border-[var(--color-action-primary)]/30 transition-all hover:shadow-lg">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4">
                            <div className="space-y-1.5">
                              <h4 className="text-lg font-black tracking-tight text-[var(--color-text-primary)] group-hover:text-[var(--color-action-primary)] transition-colors leading-tight">
                                {log.details?.title}
                              </h4>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 px-2.5 py-0.5 bg-blue-500/5 rounded-lg border border-blue-500/10">
                                  {log.details?.project || 'GENERAL'}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-text-primary)] flex items-center gap-1.5">
                                  <Clock size={10} /> {format(new Date(log.createdAt), 'HH:mm')}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--color-bg-surface)] rounded-xl border border-[var(--color-bg-border)] shadow-sm self-start md:self-center">
                              <Timer size={14} className="text-[var(--color-action-primary)]" />
                              <span className="text-xs font-black text-[var(--color-text-primary)]">{log.details?.timeSpent || '0m'}</span>
                            </div>
                          </div>
                          <p className="text-sm text-[var(--color-text-secondary)] font-medium leading-relaxed opacity-90">
                            {log.details?.message || "No description provided."}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </motion.main>

        {/* Action Sidebar: Create Entry (RIGHT) */}
        <motion.aside
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="lg:col-span-4 order-1 lg:order-2 space-y-8 sticky top-8"
        >
          {!adminViewUserId && isSameDay(selectedDate, new Date()) && (
            <motion.section
              variants={itemVariants}
              className="bg-[var(--color-bg-surface)] rounded-[2rem] border border-[var(--color-bg-border)] shadow-xl overflow-hidden"
            >
              <div className="px-8 py-8 border-b border-[var(--color-bg-border)] bg-gradient-to-r from-[var(--color-bg-workspace)] to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                    <Plus size={16} strokeWidth={3} />
                  </div>
                  <button
                    onClick={addDummyData}
                    className="px-3 py-1.5 text-[8px] font-black uppercase tracking-widest bg-orange-500/5 text-orange-600 border border-orange-500/20 rounded-lg hover:bg-orange-500 hover:text-white transition-all active:scale-95"
                  >
                    Auto Fill
                  </button>
                </div>
                <h3 className="font-black text-base text-[var(--color-text-primary)]">Add Work Entry</h3>
                <p className="text-[10px] text-[var(--color-text-muted)] font-medium">Log what you worked on today.</p>
              </div>

              <form onSubmit={handleManualSubmit} className="p-8 space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="E.g., Updated homepage design..."
                    className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-2 focus:ring-[var(--color-action-primary)]/20 focus:border-[var(--color-action-primary)] outline-none transition-all shadow-inner"
                    required
                  />
                </div>
                
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Time Spent</label>
                    <div className="relative group">
                      <select
                        value={timeSpent}
                        onChange={e => setTimeSpent(e.target.value)}
                        className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/20 focus:border-[var(--color-action-primary)] transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">Select time...</option>
                        {timeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <Timer size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-action-primary)] transition-colors pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project</label>
                    <div className="relative">
                      <select
                        value={selectedProject}
                        onChange={e => setSelectedProject(e.target.value)}
                        className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[var(--color-action-primary)]/20 focus:border-[var(--color-action-primary)] transition-all appearance-none cursor-pointer shadow-inner"
                      >
                        <option value="">No Project (General)</option>
                        {projects.map(p => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                      <Layout size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what you did..."
                    className="w-full px-4 py-3.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-medium outline-none min-h-[100px] focus:ring-2 focus:ring-[var(--color-action-primary)]/20 focus:border-[var(--color-action-primary)] transition-all resize-none shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !title.trim()}
                  className="w-full py-4 bg-[var(--color-action-primary)] text-white rounded-xl font-black text-[10px] uppercase tracking-[0.3em] hover:bg-[var(--color-action-hover)] hover:shadow-2xl hover:shadow-blue-500/40 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <><Send size={14} /> Save Entry</>
                  )}
                </button>
              </form>
            </motion.section>
          )}
        </motion.aside>
      </div>

      <NexusModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Entry Saved!"
        message="Your work entry has been saved successfully."
        type="success"
      />
    </div>
  );
};

export default DailyLogPage;
