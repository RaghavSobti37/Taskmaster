import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Globe, Lock, Trash2, Zap, ShieldCheck, RefreshCw, Star } from 'lucide-react';
import CalendarEntryModal from '../../components/CalendarEntryModal';
import { 
  Badge, 
  PageHeader, 
  PageContainer, 
  Card, 
  Button, 
  NexusModal, 
  StatCard 
} from '../../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { useCalendarEvents } from '../../hooks/useTaskmasterQueries';

const CalendarView = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: calendarEvents = [], isLoading: eventsLoading, refetch: refetchAllEvents } = useCalendarEvents();
  const [holidays, setHolidays] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showHolidays, setShowHolidays] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const loading = eventsLoading && calendarEvents.length === 0;

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const currentYear = currentMonth.getFullYear();
        const res = await axios.get(`/api/google/holidays?year=${currentYear}`);
        const uniqueHolidays = Array.from(new Map(res.data.map(h => [h.id, h])).values());
        setHolidays(uniqueHolidays.map(h => ({
          _id: h.id,
          title: h.summary,
          dueDate: h.start.date || h.start.dateTime,
          description: h.description || '',
          type: 'holiday',
          source: h.source || 'google_calendar'
        })));
      } catch (err) {
        console.error('Error fetching holidays:', err);
      }
    };
    fetchHolidays();
  }, [currentMonth]);

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const str = typeof dateStr === 'string' ? dateStr : new Date(dateStr).toISOString();
    const [y, m, d] = str.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const allEvents = useMemo(() => {
    const combined = [...calendarEvents];
    if (showHolidays) combined.push(...holidays);
    return combined;
  }, [calendarEvents, holidays, showHolidays]);

  const stats = useMemo(() => {
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);
    const mEvents = calendarEvents.filter(e => {
       const d = parseLocalDate(e.dueDate);
       return d && d >= mStart && d <= mEnd;
    });
    const mHolidays = holidays.filter(h => {
       const d = parseLocalDate(h.dueDate);
       return d && d >= mStart && d <= mEnd;
    });
    return { events: mEvents.length, holidays: mHolidays.length };
  }, [calendarEvents, holidays, currentMonth]);

  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <Card className="p-4 bg-[var(--color-bg-secondary)] border-[var(--color-bg-border)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={14} /></Button>
            <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={14} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
            <div key={index} className="text-center text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">{d}</div>
          ))}
          {days.map(day => {
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, monthStart);
            return (
              <div
                key={day.toString()}
                className={`text-center py-1.5 text-[9px] font-black rounded-full cursor-pointer transition-all
                  ${!isCurrentMonth ? 'opacity-20' : 'opacity-100'}
                  ${isToday ? 'bg-blue-500 text-white shadow-lg' : 'hover:bg-[var(--color-bg-workspace)]'}
                `}
                onClick={() => { setCurrentMonth(day); setSelectedDay(day); }}
              >
                {format(day, 'd')}
              </div>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <PageContainer className="!py-4 !space-y-6">
      <PageHeader
        title="Temporal Workspace"
        subtitle="Universal scheduling matrix and event synchronization."
        actions={
          <div className="flex items-center gap-2">
             <Button variant="secondary" size="sm" onClick={() => refetchAllEvents()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Roots</Button>
             <Button size="sm" onClick={() => setIsModalOpen(true)}><Plus size={14} /> Create Event</Button>
          </div>
        }
      />

      {/* Analytical Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Monthly Load" value={stats.events} icon={Zap} variant="info" />
        <StatCard label="Indian Holidays" value={stats.holidays} icon={Star} variant="rose" />
        <StatCard label="Sync Status" value={user.googleRefreshToken ? 'CONNECTED' : 'LOCAL'} icon={ShieldCheck} variant="mint" />
        <StatCard label="Operational Buffer" value="82%" icon={CalendarIcon} variant="slate" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 space-y-6">
           {renderMiniCalendar()}
           <Card className="p-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Matrix Filters</h4>
              <div className="space-y-2">
                 <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded bg-blue-500" />
                       <span className="text-[10px] font-bold uppercase">Internal Events</span>
                    </div>
                    <Lock size={10} className="text-[var(--color-text-muted)]" />
                 </div>
                 <div className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer">
                    <div className="flex items-center gap-3">
                       <div className="w-3 h-3 rounded bg-emerald-500" />
                       <span className="text-[10px] font-bold uppercase">Public Visibility</span>
                    </div>
                    <Globe size={10} className="text-[var(--color-text-muted)]" />
                 </div>
                 <div 
                   className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer"
                   onClick={() => setShowHolidays(!showHolidays)}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded border border-rose-500 ${showHolidays ? 'bg-rose-500' : 'bg-transparent'}`} />
                       <span className="text-[10px] font-bold uppercase">Regional Holidays</span>
                    </div>
                    <Star size={10} className={showHolidays ? 'text-rose-500' : 'text-[var(--color-text-muted)]'} />
                 </div>
              </div>
           </Card>
        </aside>

        <main className="flex-1">
           <Card className="overflow-hidden min-h-[700px] flex flex-col">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <Button variant="secondary" size="xs" onClick={() => setCurrentMonth(new Date())}>Current Epoch</Button>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16} /></Button>
                       <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16} /></Button>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-tight ml-2">{format(currentMonth, 'MMMM yyyy')}</h3>
                 </div>
                 <div className="flex items-center gap-2">
                    <Badge variant="info">DENSITY: HIGH</Badge>
                 </div>
              </div>

              <div className="grid grid-cols-7 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                   <div key={d} className="py-2 text-center text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-r border-[var(--color-bg-border)] last:border-r-0">
                     {d}
                   </div>
                 ))}
              </div>

              <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                 {eachDayOfInterval({
                    start: startOfWeek(startOfMonth(currentMonth)),
                    end: endOfWeek(endOfMonth(currentMonth))
                 }).map((day, idx) => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const dayEvents = allEvents.filter(e => {
                       const d = parseLocalDate(e.dueDate);
                       return d && isSameDay(d, day);
                    });

                    return (
                      <div 
                        key={day.toString()}
                        className={`min-h-[120px] p-1.5 border-r border-b border-[var(--color-bg-border)] transition-all hover:bg-[var(--color-bg-secondary)]/10
                          ${!isCurrentMonth ? 'bg-[var(--color-bg-secondary)]/20' : ''}
                          ${isToday ? 'bg-blue-500/5' : ''}
                        `}
                      >
                         <div className="flex justify-between items-start mb-2">
                            <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-md
                              ${isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}
                            `}>
                               {format(day, 'd')}
                            </span>
                         </div>
                         <div className="space-y-1">
                            {dayEvents.map(event => (
                              <div 
                                key={event._id}
                                className={`px-1.5 py-0.5 text-[8px] font-black uppercase truncate border rounded-sm flex items-center gap-1 cursor-pointer hover:scale-[1.02] transition-transform
                                  ${event.type === 'holiday' ? 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border-[var(--color-pastel-rose-text)]/20' :
                                    event.visibility === 'public' ? 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)] border-[var(--color-pastel-mint-text)]/20' :
                                    'bg-[var(--color-pastel-info-bg)] text-[var(--color-pastel-info-text)] border-[var(--color-pastel-info-text)]/20'}
                                `}
                                onClick={() => { setSelectedDay(day); }}
                              >
                                 {event.type === 'holiday' && <span>🇮🇳</span>}
                                 <span className="truncate">{event.title}</span>
                              </div>
                            ))}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </Card>
        </main>
      </div>

      <CalendarEntryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        onEntryCreated={() => refetchAllEvents()}
        initialData={editingEvent}
      />
    </PageContainer>
  );
};

export default CalendarView;
