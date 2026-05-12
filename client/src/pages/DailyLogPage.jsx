import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { Calendar as CalIcon, CheckCircle2, Clock, Filter, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Badge } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';

const DailyLogPage = ({ adminViewUserId, adminViewUserName }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const targetUserId = adminViewUserId || user?._id;

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get('/api/logs');
        // Filter by user and action type DAILY_LOG
        const filtered = res.data.filter(l => 
          l.userId?._id === targetUserId && 
          (l.action === 'DAILY_LOG' || l.action === 'UPDATE_TASK')
        );
        setLogs(filtered);
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [targetUserId]);

  const dailyLogs = logs.filter(l => isSameDay(new Date(l.createdAt), selectedDate));

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {adminViewUserName ? `${adminViewUserName}'s Daily Logs` : 'Daily Operational Logs'}
          </h1>
          <p className="text-[var(--color-text-secondary)]">Historical record of all completed objectives and system interactions.</p>
        </div>
        
        <div className="flex items-center gap-4 bg-[var(--color-bg-surface)] p-2 rounded-2xl border border-[var(--color-bg-border)]">
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
            className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2 px-4">
            <CalIcon size={18} className="text-[var(--color-action-primary)]" />
            <span className="font-bold text-sm">{format(selectedDate, 'MMM dd, yyyy')}</span>
          </div>
          <button 
            onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
            className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <aside className="space-y-6">
          <div className="bg-[var(--color-bg-surface)] p-6 rounded-3xl border border-[var(--color-bg-border)]">
            <h3 className="font-bold mb-4 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">Efficiency Metrics</h3>
            <div className="space-y-4">
              <div>
                <p className="text-2xl font-bold">{dailyLogs.length}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase">Atomic Ops Completed</p>
              </div>
              <div className="pt-4 border-t border-[var(--color-bg-border)]">
                <p className="text-xs font-bold text-green-500">Optimum Performance</p>
                <div className="w-full bg-gray-100 h-1 rounded-full mt-1">
                  <div className="bg-green-500 h-full w-[85%]" />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="lg:col-span-3">
          <section className="bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)] flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Clock size={18} className="text-[var(--color-action-primary)]" />
                Chronological Event Stream
              </h3>
              <Badge variant="todo">{format(selectedDate, 'EEEE')}</Badge>
            </div>
            
            <div className="divide-y divide-[var(--color-bg-border)]">
              {loading ? (
                <div className="p-20 text-center animate-pulse text-[var(--color-text-muted)] italic">Querying historical data...</div>
              ) : dailyLogs.length === 0 ? (
                <div className="p-20 text-center text-[var(--color-text-muted)] italic">No operational logs found for this period.</div>
              ) : dailyLogs.map(log => (
                <div key={log._id} className="p-6 flex gap-6 hover:bg-[var(--color-bg-workspace)] transition-all">
                  <div className="text-[10px] font-bold text-[var(--color-text-muted)] w-16 pt-1">
                    {format(new Date(log.createdAt), 'HH:mm')}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.action === 'DAILY_LOG' ? 'done' : 'progress'}>
                        {log.action.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">{log.details?.title || log.targetType}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {log.details?.message || 'System interaction recorded.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default DailyLogPage;
