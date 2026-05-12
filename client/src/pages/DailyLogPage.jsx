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
  Target
} from 'lucide-react';
import { Badge, NexusModal } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const DailyLogPage = ({ adminViewUserId, adminViewUserName }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Manual Entry Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeSpent, setTimeSpent] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const targetUserId = adminViewUserId || user?._id;

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, projectsRes] = await Promise.all([
        axios.get(`/api/logs?userId=${targetUserId}&limit=200`),
        axios.get('/api/projects')
      ]);
      setLogs(logsRes.data);
      setProjects(projectsRes.data);
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
    e.preventDefault();
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
      setModalOpen(true); // Success feedback
    } catch (err) {
      console.error('Manual log submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const dailyLogs = logs.filter(l => isSameDay(new Date(l.createdAt), selectedDate));
  
  // Calculate total time spent if available in details
  const totalMinutes = dailyLogs.reduce((acc, log) => {
    const time = log.details?.timeSpent;
    if (!time) return acc;
    // Handle formats like "1h 30m" or just "30" or "1.5h"
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

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {adminViewUserName ? `${adminViewUserName}'s Work Log` : 'Daily Activity'}
          </h1>
          <p className="text-[var(--color-text-secondary)]">Keep track of what you did today.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[var(--color-bg-surface)] p-2 rounded-2xl border border-[var(--color-bg-border)] shadow-sm">
          <button 
            onClick={() => handleDateChange(-1)}
            className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2 px-4 border-x border-[var(--color-bg-border)]">
            <CalIcon size={18} className="text-[var(--color-action-primary)]" />
            <span className="font-bold text-sm">{format(selectedDate, 'MMM dd, yyyy')}</span>
          </div>
          <button 
            onClick={() => handleDateChange(1)}
            disabled={isSameDay(selectedDate, new Date())}
            className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form & Stats */}
        <aside className="lg:col-span-4 space-y-6">
          {!adminViewUserId && isSameDay(selectedDate, new Date()) && (
            <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center gap-2">
                <Plus size={18} className="text-[var(--color-action-primary)]" />
                <h3 className="font-bold text-xs uppercase tracking-widest">Add to Log</h3>
              </div>
              <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">What did you do?</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="E.g. Fixed the login bug"
                    className="w-full px-4 py-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs font-bold focus:ring-1 focus:ring-[var(--color-action-primary)] outline-none"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Time Spent</label>
                    <div className="relative">
                      <Timer size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      <input 
                        type="text" 
                        value={timeSpent}
                        onChange={e => setTimeSpent(e.target.value)}
                        placeholder="e.g. 1h 30m"
                        className="w-full pl-9 pr-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Project</label>
                    <select 
                      value={selectedProject}
                      onChange={e => setSelectedProject(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs outline-none appearance-none"
                    >
                      <option value="">General</option>
                      {projects.map(p => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add more details..."
                    className="w-full px-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-xs outline-none min-h-[80px]"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={submitting || !title.trim()}
                  className="w-full py-3 bg-[var(--color-action-primary)] text-white rounded-xl font-bold text-xs hover:bg-[var(--color-action-hover)] disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {submitting ? 'Saving...' : <><Send size={14} /> Save to Log</>}
                </button>
              </form>
            </section>
          )}

          <section className="bg-[var(--color-bg-surface)] p-8 rounded-3xl border border-[var(--color-bg-border)] shadow-sm space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Today's Summary</h3>
              <Zap size={16} className="text-yellow-500 animate-pulse" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)]">
                <p className="text-2xl font-black text-[var(--color-text-primary)]">{dailyLogs.length}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">Logs added</p>
              </div>
              <div className="p-4 bg-[var(--color-bg-workspace)] rounded-2xl border border-[var(--color-bg-border)]">
                <p className="text-2xl font-black text-[var(--color-action-primary)]">{formatTime(totalMinutes)}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-widest">Time Tracked</p>
              </div>
            </div>

            <div className="pt-6 border-t border-[var(--color-bg-border)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Progress</span>
                <span className="text-xs font-bold text-green-500">Good progress!</span>
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full w-[85%] transition-all duration-1000" />
              </div>
            </div>
          </section>
        </aside>

        {/* Right Column: Log Feed */}
        <main className="lg:col-span-8">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
            <div className="px-6 py-5 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                  <Target size={20} />
                </div>
                <h3 className="font-bold">Activity History</h3>
              </div>
              <Badge variant="todo">{format(selectedDate, 'EEEE').toUpperCase()}</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-20 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-[var(--color-action-primary)]/20 border-t-[var(--color-action-primary)] rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Loading logs...</p>
                </div>
              ) : dailyLogs.length === 0 ? (
                <div className="p-20 text-center space-y-2">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <Clock size={32} />
                  </div>
                  <p className="font-bold text-[var(--color-text-primary)]">No Logs Found</p>
                  <p className="text-xs text-[var(--color-text-muted)]">No activity recorded for this day.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-bg-border)]">
                  {dailyLogs.map(log => (
                    <div key={log._id} className="p-6 flex gap-6 hover:bg-[var(--color-bg-workspace)] transition-all group">
                      <div className="text-[10px] font-black text-[var(--color-text-muted)] w-16 pt-1 flex flex-col items-center">
                        <span>{format(new Date(log.createdAt), 'HH:mm')}</span>
                        <div className="w-px h-full bg-[var(--color-bg-border)] mt-2 group-last:hidden" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge variant={log.action === 'DAILY_LOG' ? 'done' : 'progress'}>
                              {log.action === 'DAILY_LOG' ? 'LOG' : log.action.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm font-black text-[var(--color-text-primary)] tracking-tight">
                              {log.details?.title || log.targetType}
                            </span>
                          </div>
                          {log.details?.timeSpent && (
                            <span className="text-[10px] font-bold text-[var(--color-action-primary)] bg-blue-500/10 px-2 py-1 rounded-lg flex items-center gap-1">
                              <Timer size={10} /> {log.details.timeSpent}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                          {log.details?.message || 'System updated.'}
                        </p>
                        {log.details?.project && (
                          <div className="flex items-center gap-1.5 text-[9px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">
                            <Target size={10} />
                            {log.details.project}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <NexusModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Saved!"
        message="Your activity log has been saved."
        type="success"
      />
    </div>
  );
};

export default DailyLogPage;
