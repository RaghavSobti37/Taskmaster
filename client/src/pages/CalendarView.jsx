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
  const [showHolidays, setShowHolidays] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  // Fetch persistent calendar events from DB
  useEffect(() => {
    const fetchCalendarEvents = async () => {
      try {
        const res = await axios.get('/api/calendar');
        setCalendarEvents(res.data.map(ev => ({
          _id: ev._id,
          title: ev.title,
          description: ev.description,
          dueDate: ev.date,
          visibility: ev.visibility,
          createdBy: ev.createdBy,
          type: 'event'
        })));
      } catch (err) {
        console.error('Error fetching calendar events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCalendarEvents();
  }, []);

  // Fetch Indian holidays (public, no auth)
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const currentYear = currentMonth.getFullYear();
        const res = await axios.get(`/api/google/holidays?year=${currentYear}`);
        setHolidays(res.data.map(h => ({
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

  const handleEntryCreated = (newEntry) => {
    setCalendarEvents(prev => [...prev, {
      _id: newEntry._id,
      title: newEntry.title,
      description: newEntry.description,
      dueDate: newEntry.date,
      visibility: newEntry.visibility,
      createdBy: newEntry.createdBy,
      type: 'event'
    }]);
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

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] py-3">
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    if (loading && calendarEvents.length === 0) {
      return (
        <Card className="grid grid-cols-7 bg-[var(--color-bg-border)] gap-px border border-[var(--color-bg-border)] overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="min-h-[120px] bg-[var(--color-bg-surface)] p-3 animate-pulse">
              <div className="h-4 w-6 bg-[var(--color-bg-border)] rounded mb-2" />
              <div className="h-3 w-full bg-[var(--color-bg-border)] rounded mb-1 opacity-50" />
            </div>
          ))}
        </Card>
      );
    }

    return (
      <Card className="grid grid-cols-7 bg-[var(--color-bg-border)] gap-px border border-[var(--color-bg-border)] overflow-hidden">
        {days.map(day => {
          const dayEvents = allEvents.filter(event => {
            const eventDate = parseLocalDate(event.dueDate);
            return eventDate && isSameDay(eventDate, day);
          });
          const dayHolidays = dayEvents.filter(e => e.type === 'holiday');
          const dayUserEvents = dayEvents.filter(e => e.type === 'event');
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const hasHoliday = dayHolidays.length > 0;

          return (
            <div
              key={day.toString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`min-h-[120px] bg-[var(--color-bg-surface)] p-2.5 transition-all cursor-pointer relative
                ${!isCurrentMonth ? 'opacity-40' : ''}
                ${isToday ? 'ring-2 ring-inset ring-[var(--color-action-primary)]/40' : ''}
                ${isSelected ? 'bg-[var(--color-action-primary)]/5' : 'hover:bg-[var(--color-bg-workspace)]'}
                ${hasHoliday ? 'bg-rose-50/30 dark:bg-rose-900/5' : ''}
              `}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold leading-none
                  ${isToday
                    ? 'w-6 h-6 bg-[var(--color-action-primary)] text-white flex items-center justify-center rounded-full text-[10px] font-black'
                    : 'text-[var(--color-text-secondary)]'}
                `}>
                  {format(day, 'd')}
                </span>
                {hasHoliday && (
                  <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" title="Holiday" />
                )}
              </div>

              {/* Events */}
              <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                {/* Holidays first */}
                {dayHolidays.map(holiday => (
                  <motion.div
                    key={holiday._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-1.5 py-1 text-[8px] font-bold rounded-md truncate border transition-all
                      bg-gradient-to-r from-rose-50 to-orange-50 text-rose-700 border-rose-200/60
                      dark:from-rose-900/20 dark:to-orange-900/20 dark:text-rose-300 dark:border-rose-700/30
                      cursor-default leading-tight"
                    title={holiday.description || holiday.title}
                  >
                    {holiday.title}
                  </motion.div>
                ))}
                {/* User calendar events */}
                {dayUserEvents.map(event => (
                  <div
                    key={event._id}
                    className={`px-1.5 py-1 text-[8px] font-bold rounded-md truncate border transition-all leading-tight flex items-center gap-1
                      ${event.visibility === 'public'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700/30'
                        : 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-700/30'
                      }`}
                  >
                    {event.visibility === 'public' ? <Globe size={8} className="shrink-0" /> : <Lock size={8} className="shrink-0" />}
                    <span className="truncate">{event.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    );
  };

  // Selected day detail panel
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
                    <div key={event._id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                      ${event.type === 'holiday'
                        ? 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200/60 dark:from-rose-900/10 dark:to-orange-900/10 dark:border-rose-800/30'
                        : event.visibility === 'public'
                          ? 'bg-emerald-50/50 border-emerald-200/60 dark:bg-emerald-900/10 dark:border-emerald-800/30'
                          : 'bg-purple-50/50 border-purple-200/60 dark:bg-purple-900/10 dark:border-purple-800/30'
                      }
                    `}>
                      <div className={`w-2 h-8 rounded-full flex-shrink-0
                        ${event.type === 'holiday' 
                          ? 'bg-gradient-to-b from-rose-400 to-orange-400' 
                          : event.visibility === 'public' ? 'bg-emerald-500' : 'bg-purple-500'}
                      `} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold truncate
                          ${event.type === 'holiday' ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--color-text-primary)]'}
                        `}>{event.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-widest font-bold">
                            {event.type === 'holiday' ? '🇮🇳 Holiday' : (
                              <span className="flex items-center gap-1">
                                {event.visibility === 'public' ? <><Globe size={8} /> Public</> : <><Lock size={8} /> Private</>}
                                {creatorName && ` • ${creatorName}`}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      {event.type === 'event' && isOwner && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event._id); }}
                          className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-all"
                          title="Delete event"
                        >
                          <Trash2 size={14} />
                        </button>
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
        title="Calendar"
        subtitle="View and manage your scheduled events."
        actions={
          <div className="flex items-center gap-4">
            {/* Holiday Toggle */}
            <button
              onClick={() => setShowHolidays(!showHolidays)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all border
                ${showHolidays
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800/30'
                  : 'bg-[var(--color-bg-workspace)] text-[var(--color-text-muted)] border-[var(--color-bg-border)] hover:text-[var(--color-text-primary)]'}
              `}
            >
              <Globe size={14} />
              Holidays {showHolidays ? 'ON' : 'OFF'}
              {showHolidays && monthHolidayCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-rose-200/60 text-rose-800 rounded-full text-[9px] font-black">
                  {monthHolidayCount}
                </span>
              )}
            </button>

            {/* Month Navigation */}
            <div className="flex items-center bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl overflow-hidden shadow-inner">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2.5 hover:bg-[var(--color-bg-surface)] transition-colors border-r border-[var(--color-bg-border)]">
                <ChevronLeft size={20} />
              </button>
              <div className="px-6 py-2.5 font-bold text-sm min-w-[140px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </div>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2.5 hover:bg-[var(--color-bg-surface)] transition-colors border-l border-[var(--color-bg-border)]">
                <ChevronRight size={20} />
              </button>
            </div>

            {/* New Entry */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20"
            >
              <Plus size={20} /> New Event
            </button>
          </div>
        }
      />

      <CalendarEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEntryCreated={handleEntryCreated}
      />

      <div>
        {renderDays()}
        {renderCells()}
      </div>

      {renderDayDetail()}
    </PageContainer>
  );
};

export default CalendarView;
