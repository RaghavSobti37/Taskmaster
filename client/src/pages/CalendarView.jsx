import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Globe, Lock, Trash2 } from 'lucide-react';
import CalendarEntryModal from '../components/CalendarEntryModal';
import { Badge, PageHeader, PageContainer, Card } from '../components/ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const CalendarView = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showHolidays, setShowHolidays] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  // Fetch calendar events (Internal DB + Google)
  const fetchAllEvents = async () => {
    try {
      const [dbRes, googleRes] = await Promise.all([
        axios.get('/api/calendar'),
        user.googleRefreshToken ? axios.get('/api/google/calendar/events') : Promise.resolve({ data: [] })
      ]);

      const dbEvents = dbRes.data.map(ev => ({
        _id: ev._id,
        title: ev.title,
        description: ev.description,
        dueDate: ev.date,
        visibility: ev.visibility,
        createdBy: ev.createdBy,
        type: 'event'
      }));

      const googleEvents = googleRes.data.map(ev => ({
        _id: ev.id,
        title: ev.summary,
        description: '',
        dueDate: ev.start.dateTime || ev.start.date,
        visibility: 'private', // Personal Google events shown as private
        type: 'google',
        source: 'google_calendar'
      }));

      // Deduplicate by _id
      const combined = [...dbEvents, ...googleEvents];
      const uniqueEvents = Array.from(new Map(combined.map(ev => [ev._id, ev])).values());
      
      setCalendarEvents(uniqueEvents);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllEvents();
    const interval = setInterval(fetchAllEvents, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [user.googleRefreshToken]);

  // Fetch Indian holidays (public, no auth)
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const currentYear = currentMonth.getFullYear();
        const res = await axios.get(`/api/google/holidays?year=${currentYear}`);
        // Deduplicate holidays by id
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

  const handleEntryCreated = (newEntry, isUpdate = false) => {
    if (isUpdate) {
      setCalendarEvents(prev => prev.map(e => e._id === newEntry._id ? {
        ...newEntry,
        dueDate: newEntry.date,
        type: 'event'
      } : e));
    } else {
      setCalendarEvents(prev => [...prev, {
        _id: newEntry._id,
        title: newEntry.title,
        description: newEntry.description,
        dueDate: newEntry.date,
        visibility: newEntry.visibility,
        createdBy: newEntry.createdBy,
        type: 'event'
      }]);
    }
    setEditingEvent(null);
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (eventId) => {
    try {
      await axios.delete(`/api/calendar/${eventId}`);
      setCalendarEvents(prev => prev.filter(e => e._id !== eventId));
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const str = typeof dateStr === 'string' ? dateStr : new Date(dateStr).toISOString();
    const [y, m, d] = str.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Merge calendar events + holidays
  const allEvents = useMemo(() => {
    const combined = [...calendarEvents];
    if (showHolidays) combined.push(...holidays);
    return combined;
  }, [calendarEvents, holidays, showHolidays]);

  // Count holidays in current month
  const monthHolidayCount = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return holidays.filter(h => {
      const d = parseLocalDate(h.dueDate);
      return d && d >= monthStart && d <= monthEnd;
    }).length;
  }, [holidays, currentMonth]);

  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="p-4 bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-primary)]">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-[var(--color-bg-workspace)] rounded-md transition-colors"><ChevronLeft size={14} /></button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-[var(--color-bg-workspace)] rounded-md transition-colors"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
            <div key={d} className="text-center text-[8px] font-black text-[var(--color-text-muted)]">{d}</div>
          ))}
          {days.map(day => {
            const hasEvents = allEvents.some(e => {
              const d = parseLocalDate(e.dueDate);
              return d && isSameDay(d, day);
            });
            const hasPublicEvents = allEvents.some(e => {
              const d = parseLocalDate(e.dueDate);
              return d && isSameDay(d, day) && e.visibility === 'public';
            });
            return (
              <div 
                key={day.toString()} 
                className={`relative text-center py-1.5 text-[9px] font-bold rounded-full transition-all cursor-pointer
                  ${!isSameMonth(day, monthStart) ? 'text-[var(--color-text-muted)] opacity-30' : 'text-[var(--color-text-primary)]'}
                  ${isSameDay(day, new Date()) ? 'bg-[var(--color-action-primary)] text-white' : 'hover:bg-[var(--color-bg-workspace)]'}
                `}
                onClick={() => setCurrentMonth(day)}
              >
                {format(day, 'd')}
                {hasEvents && !isSameDay(day, new Date()) && (
                  <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${hasPublicEvents ? 'bg-emerald-500' : 'bg-[var(--color-action-primary)]'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayDetail = () => {
    if (!selectedDay) return null;
    const dayEvents = allEvents.filter(event => {
      const eventDate = parseLocalDate(event.dueDate);
      return eventDate && isSameDay(eventDate, selectedDay);
    });

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="mt-6"
        >
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--color-text-primary)]">
                {format(selectedDay, 'EEEE, MMMM d, yyyy')}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] italic">No events scheduled.</p>
            ) : (
              <div className="space-y-2">
                {dayEvents.map(event => {
                  const isOwner = event.createdBy && (
                    typeof event.createdBy === 'string' 
                      ? event.createdBy === user?._id 
                      : event.createdBy._id === user?._id
                  );
                  const creatorName = event.createdBy?.name || '';

                  return (
                    <div key={event._id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:border-[var(--color-action-primary)]/50
                      ${event.type === 'holiday'
                        ? 'bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-800/30'
                        : event.type === 'google'
                          ? 'bg-amber-50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-800/30'
                          : event.visibility === 'public'
                            ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800/30'
                            : 'bg-blue-50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-800/30'
                      }
                    `}>
                      <div className={`w-1.5 h-6 rounded-full flex-shrink-0
                        ${event.type === 'holiday' 
                          ? 'bg-rose-400' 
                          : event.type === 'google' ? 'bg-amber-400' : event.visibility === 'public' ? 'bg-emerald-500' : 'bg-blue-500'}
                      `} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] font-bold truncate
                          ${event.type === 'holiday' ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--color-text-primary)]'}
                        `}>{event.title}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-widest font-black">
                            {event.type === 'holiday' ? '🇮🇳 Holiday' : (
                              <span className="flex items-center gap-1">
                                {event.type === 'google' ? <><Lock size={8} /> Private (Google)</> : (
                                  event.visibility === 'public' ? <><Globe size={8} /> Public</> : <><Lock size={8} /> Private</>
                                )}
                                {creatorName && ` • ${creatorName}`}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {event.type === 'event' && isOwner && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleEditEvent(event); }}
                            className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-400 hover:text-blue-600 transition-all"
                            title="Edit event"
                          >
                            <Plus size={12} className="rotate-45" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event._id); }}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-all"
                            title="Delete event"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <PageContainer>
      <PageHeader
        icon={CalendarIcon}
        title="Workspace Calendar"
        subtitle="Manage your schedule across projects and personal events."
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            <Plus size={18} strokeWidth={3} /> Create Event
          </button>
        }
      />

      <CalendarEntryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        onEntryCreated={handleEntryCreated}
        initialData={editingEvent}
      />

      <div className="flex flex-col lg:flex-row gap-8 mt-6">
        {/* Sidebar */}
        <div className="w-full lg:w-72 flex-shrink-0">
          {renderMiniCalendar()}
          
          <div className="bg-[var(--color-bg-surface)] rounded-2xl border border-[var(--color-bg-border)] p-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] mb-4">My Calendars</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative w-4 h-4 rounded border-2 border-[var(--color-action-primary)] flex items-center justify-center transition-all group-hover:scale-110">
                   <div className="w-2 h-2 bg-[var(--color-action-primary)] rounded-sm" />
                </div>
                <span className="text-[11px] font-bold text-[var(--color-text-primary)]">Personal Events</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative w-4 h-4 rounded border-2 border-emerald-500 flex items-center justify-center transition-all group-hover:scale-110">
                   <div className="w-2 h-2 bg-emerald-500 rounded-sm" />
                </div>
                <span className="text-[11px] font-bold text-[var(--color-text-primary)]">Public Workspace</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setShowHolidays(!showHolidays)}>
                <div className={`relative w-4 h-4 rounded border-2 flex items-center justify-center transition-all group-hover:scale-110 ${showHolidays ? 'border-rose-400 bg-rose-400' : 'border-[var(--color-bg-border)]'}`}>
                   {showHolidays && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                </div>
                <span className="text-[11px] font-bold text-[var(--color-text-primary)]">Indian Holidays</span>
              </label>
            </div>
          </div>
        </div>

        {/* Main Calendar Area */}
        <div className="flex-1 bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] overflow-hidden flex flex-col shadow-sm">
          <div className="p-6 border-b border-[var(--color-bg-border)] flex items-center justify-between">
             <div className="flex items-center gap-4">
               <button 
                 onClick={() => setCurrentMonth(new Date())}
                 className="px-4 py-2 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-[var(--color-action-primary)] transition-all"
               >
                 Today
               </button>
               <div className="flex items-center gap-1">
                 <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-muted)]"><ChevronLeft size={20} /></button>
                 <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-[var(--color-bg-workspace)] rounded-xl text-[var(--color-text-muted)]"><ChevronRight size={20} /></button>
               </div>
               <h3 className="text-lg font-black text-[var(--color-text-primary)] ml-2 uppercase tracking-tight">
                 {format(currentMonth, 'MMMM yyyy')}
               </h3>
             </div>
          </div>

          <div className="grid grid-cols-7 border-b border-[var(--color-bg-border)]">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] border-r border-[var(--color-bg-border)] last:border-r-0 bg-[var(--color-bg-workspace)]/30">
                {d}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 auto-rows-fr h-[700px] overflow-y-auto custom-scrollbar">
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
                  className={`min-h-[140px] p-2 border-r border-b border-[var(--color-bg-border)] transition-all hover:bg-[var(--color-bg-workspace)]/30 
                    ${!isCurrentMonth ? 'bg-[var(--color-bg-workspace)]/20' : ''}
                    ${isToday ? 'bg-[var(--color-action-primary)]/5' : ''}
                  `}
                >
                  <div className="flex justify-center mb-3">
                    <span className={`w-8 h-8 flex items-center justify-center text-[11px] font-black rounded-full transition-all relative
                      ${isToday ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/30' : 
                        isCurrentMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] opacity-50'}
                    `}>
                      {format(day, 'd')}
                      {dayEvents.length > 0 && !isToday && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[var(--color-action-primary)] rounded-full" />
                      )}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {dayEvents.map(event => (
                      <div 
                        key={event._id}
                        className={`px-2 py-1 text-[9px] font-bold rounded-md truncate border leading-tight transition-all cursor-pointer hover:shadow-md flex items-center gap-1
                          ${event.type === 'holiday' 
                            ? 'bg-rose-100 text-rose-700 border-rose-200' 
                            : event.type === 'google'
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : event.visibility === 'public'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200'
                          }
                        `}
                        title={event.title}
                        onClick={() => setSelectedDay(day)}
                      >
                        {event.type === 'holiday' && <span className="text-[10px]">🇮🇳</span>}
                        {event.visibility === 'public' && event.type !== 'holiday' && <Globe size={8} />}
                        <span className="truncate">{event.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {renderDayDetail()}
    </PageContainer>
  );
};

export default CalendarView;
