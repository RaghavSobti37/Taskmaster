import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Globe, Lock, RefreshCw, Star, CheckSquare, CalendarDays, Video } from 'lucide-react';
import CalendarEntryModal from '../../components/CalendarEntryModal';
import { 
  Badge, 
  Button,
  ListPageLayout,
  Spinner,
} from '../../components/ui';
import { useCalendarEvents, useStatusCounts } from '../../hooks/useTaskmasterQueries';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '../../utils/departmentPermissions';
import { getCalendarEventTypeLabel } from '../../constants/calendarOptions';
import { formatEventRangeLabel, eventOccursOnDay, normalizeMeetingLink } from '../../utils/calendarEventTime';

const CalendarView = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: calendarEvents = [], isLoading: eventsLoading, refetch: refetchAllEvents } = useCalendarEvents();
  const { data: statusCounts } = useStatusCounts(!!user);
  const [seedingMusicCalendar, setSeedingMusicCalendar] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showHolidays, setShowHolidays] = useState(true);
  const [showInternal, setShowInternal] = useState(true);
  const [showPublic, setShowPublic] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date());

  const syncSpinning = eventsLoading && calendarEvents.length === 0;
  const gridLoading = eventsLoading;

  const handleSeedMusicCalendar = async () => {
    if (!window.confirm(`Import Music Content Calendar birthdays for ${currentMonth.getFullYear()}?`)) return;
    setSeedingMusicCalendar(true);
    try {
      const res = await axios.post('/api/calendar/seed-music-content', { year: currentMonth.getFullYear() });
      await refetchAllEvents();
      alert(res.data?.message || 'Music calendar imported');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to import music calendar');
    } finally {
      setSeedingMusicCalendar(false);
    }
  };

  useEffect(() => {
    const fetchHolidays = async () => {
      setHolidaysLoading(true);
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
        setHolidays([]);
      } finally {
        setHolidaysLoading(false);
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
    const filtered = calendarEvents.filter((e) => {
      if (e.type === 'task') return showTasks;
      if (e.type === 'google') return showInternal;
      if (e.visibility === 'public') return showPublic;
      return showInternal;
    });
    const combined = [...filtered];
    if (showHolidays) combined.push(...holidays);
    return combined;
  }, [calendarEvents, holidays, showHolidays, showInternal, showPublic, showTasks]);

  const calendarOverview = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const inMonth = allEvents.filter((e) => {
      const d = parseLocalDate(e.dueDate || e.date);
      return d && d >= monthStart && d <= monthEnd;
    });
    const onSelected = allEvents.filter((e) => eventOccursOnDay(e, selectedDay));
    return {
      today: statusCounts?.calendar?.today ?? 0,
      selectedDay: onSelected.length,
      thisMonth: inMonth.length,
      totalLoaded: allEvents.length,
    };
  }, [allEvents, currentMonth, selectedDay, statusCounts]);

  const getEventsForDay = (day) => allEvents.filter((e) => eventOccursOnDay(e, day));

  const EVENT_PILL_COLOR = 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border-[var(--color-pastel-rose-text)]/20';

  const TASK_PILL_COLOR = 'bg-[var(--color-pastel-slate-bg)] text-[var(--color-pastel-slate-text)] border-[var(--color-pastel-slate-text)]/25';

  const getEventStyle = (event) => {
    if (event.type === 'holiday') {
      return EVENT_PILL_COLOR;
    }
    if (event.type === 'task') {
      return TASK_PILL_COLOR;
    }
    if (event.visibility === 'public') {
      return 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)] border-[var(--color-pastel-mint-text)]/20';
    }
    return EVENT_PILL_COLOR;
  };

  const eventPillClass = (event, compact = false) =>
    compact
      ? `px-1.5 py-0.5 text-[8px] font-bold uppercase truncate border rounded-lg flex items-center gap-1 cursor-pointer hover:opacity-90 ${getEventStyle(event)}`
      : `px-2.5 py-2 text-[9px] font-bold uppercase border rounded-lg flex items-start gap-2 cursor-pointer hover:opacity-90 ${getEventStyle(event)}`;

  const getDotColor = (event) => {
    if (event.type === 'holiday') return 'bg-rose-500';
    if (event.type === 'task') return 'bg-zinc-300';
    if (event.visibility === 'public') return 'bg-emerald-500';
    return 'bg-blue-500';
  };

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return getEventsForDay(selectedDay);
  }, [selectedDay, allEvents]);

  const renderMiniCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="p-4 border border-[var(--color-bg-border)]">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="xs" title="Previous month" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={14} /></Button>
            <Button variant="ghost" size="xs" title="Next month" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={14} /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
            <div key={index} className="text-center text-[8px] font-black text-[var(--color-text-muted)] uppercase tracking-tighter">{d}</div>
          ))}
          {days.map(day => {
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const dayEvents = getEventsForDay(day);
            const dotColors = [...new Set(dayEvents.map(getDotColor))].slice(0, 3);

            return (
              <div
                key={day.toString()}
                className={`relative text-center py-1.5 text-[9px] font-black rounded-full cursor-pointer transition-all
                  ${!isCurrentMonth ? 'opacity-20' : 'opacity-100'}
                  ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-secondary)]' : ''}
                  ${isToday ? 'bg-blue-500 text-white' : 'hover:bg-[var(--color-bg-workspace)]'}
                `}
                onClick={() => { setCurrentMonth(day); setSelectedDay(day); }}
              >
                {format(day, 'd')}
                {dotColors.length > 0 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {dotColors.map((color, i) => (
                      <span key={i} className={`w-1 h-1 rounded-full ${color}`} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSelectedDayPanel = () => (
    <div className="p-3 border border-[var(--color-bg-border)]">
      <div className="grid grid-cols-2 gap-2 items-center mb-2 pb-2 border-b border-[var(--color-bg-border)]">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)] truncate">
          {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a day'}
        </h4>
        {selectedDay && (
          <Badge variant="slate" className="justify-self-end shrink-0">{selectedDayEvents.length} EVENTS</Badge>
        )}
      </div>
      {!selectedDay ? (
        <p className="text-[10px] text-[var(--color-text-muted)] italic">Click a day to view all events.</p>
      ) : selectedDayEvents.length === 0 ? (
        <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-3">No events on this day</p>
      ) : (
        <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5 custom-scrollbar">
          {selectedDayEvents.map((event, idx) => {
            const isEditable = event.type !== 'holiday' && event.type !== 'task';
            const typeLabel = getCalendarEventTypeLabel(event);
            const joinUrl = event.eventType === 'meeting' && event.meetingLink
              ? normalizeMeetingLink(event.meetingLink)
              : '';
            return (
              <div
                key={`${event._id}_${idx}`}
                className={`py-1.5 px-2 rounded-lg border transition-colors ${getEventStyle(event)} ${isEditable ? 'cursor-pointer hover:opacity-90' : ''}`}
                onClick={() => {
                  if (!isEditable) return;
                  setEditingEvent(event);
                  setIsModalOpen(true);
                }}
              >
                <div className="flex items-baseline justify-between gap-2 min-w-0">
                  <span className="tm-data-primary text-[11px] font-bold truncate normal-case leading-tight">{event.title}</span>
                  <span className="text-[10px] font-semibold shrink-0 tabular-nums text-sky-400">
                    {formatEventRangeLabel(event.dueDate || event.date, event.endDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5 min-w-0">
                  <p className="text-[9px] text-[var(--color-text-muted)] normal-case leading-tight truncate">
                    {typeLabel}
                  </p>
                  {joinUrl && (
                    <a
                      href={joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide tabular-nums bg-amber-500 text-[var(--color-bg-primary)] hover:bg-amber-400 transition-colors"
                    >
                      <Video size={10} />
                      Join
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <ListPageLayout
      containerClassName="!py-4"
      overview={{
        stats: [
          {
            id: 'today',
            label: 'Today',
            value: calendarOverview.today,
            icon: CalendarDays,
            variant: 'mint',
            info: 'Events and tasks on your calendar for today.',
          },
          {
            id: 'selected',
            label: 'Selected Day',
            value: calendarOverview.selectedDay,
            icon: Star,
            variant: 'info',
            info: 'Items on the day you picked in the mini calendar.',
          },
          {
            id: 'month',
            label: 'This Month',
            value: calendarOverview.thisMonth,
            icon: CalendarDays,
            variant: 'apricot',
            info: 'All visible items in the current month view.',
          },
          {
            id: 'loaded',
            label: 'In View',
            value: calendarOverview.totalLoaded,
            icon: Globe,
            variant: 'slate',
            info: 'Events currently loaded with your filter settings.',
          },
        ],
      }}
      className="flex flex-col min-h-[calc(100vh-6rem)]"
    >
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <aside className="w-full lg:w-72 space-y-4 shrink-0">
           {renderMiniCalendar()}
           {renderSelectedDayPanel()}
           <div className="p-4 space-y-4 border border-[var(--color-bg-border)]">
              <h4 className="tm-widget-label">Calendar Filters</h4>
              <div className="space-y-2">
                 <div
                   className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer"
                   onClick={() => setShowInternal(!showInternal)}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded border border-blue-500 ${showInternal ? 'bg-blue-500' : 'bg-transparent'}`} />
                       <span className="text-[10px] font-bold uppercase">Internal Events</span>
                    </div>
                    <Lock size={10} className={showInternal ? 'text-blue-500' : 'text-[var(--color-text-muted)]'} />
                 </div>
                 <div
                   className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer"
                   onClick={() => setShowPublic(!showPublic)}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded border border-emerald-500 ${showPublic ? 'bg-emerald-500' : 'bg-transparent'}`} />
                       <span className="text-[10px] font-bold uppercase">Public Visibility</span>
                    </div>
                    <Globe size={10} className={showPublic ? 'text-emerald-500' : 'text-[var(--color-text-muted)]'} />
                 </div>
                 <div
                   className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-all cursor-pointer"
                   onClick={() => setShowTasks(!showTasks)}
                 >
                    <div className="flex items-center gap-3">
                       <div className={`w-3 h-3 rounded border border-zinc-300 ${showTasks ? 'bg-zinc-300' : 'bg-transparent'}`} />
                       <span className="text-[10px] font-bold uppercase">Tasks</span>
                    </div>
                    <CheckSquare size={10} className={showTasks ? 'text-zinc-300' : 'text-[var(--color-text-muted)]'} />
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
           </div>
        </aside>

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
           <div className="overflow-hidden flex flex-col flex-1 min-h-0 border border-[var(--color-bg-border)]">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                    <Button variant="secondary" size="xs" onClick={() => { const today = new Date(); setCurrentMonth(today); setSelectedDay(today); }}>Today</Button>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="xs" title="Previous month" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16} /></Button>
                       <Button variant="ghost" size="xs" title="Next month" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16} /></Button>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-tight ml-2">{format(currentMonth, 'MMMM yyyy')}</h3>
                 </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
             <Button variant="secondary" size="sm" onClick={() => refetchAllEvents()} disabled={eventsLoading}><RefreshCw size={14} className={syncSpinning ? 'animate-spin' : ''} /> Sync Calendar</Button>
             {isAdminUser(user) && (
               <Button variant="secondary" size="sm" onClick={handleSeedMusicCalendar} disabled={seedingMusicCalendar} title="Import Music Content Calendar birthdays">
                 <Star size={14} className={seedingMusicCalendar ? 'animate-pulse' : ''} /> Birthdays
               </Button>
             )}
             <Button size="sm" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}><Plus size={14} /> Create Event</Button>
          </div>
          </div>
              </div>

              <div className="grid grid-cols-7 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30 shrink-0">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                   <div key={d} className="py-2 text-center text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-r border-[var(--color-bg-border)] last:border-r-0">
                     {d}
                   </div>
                 ))}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr overflow-hidden relative">
                 {gridLoading && (
                   <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-bg-workspace)]/75 backdrop-blur-[1px]">
                     <Spinner size="lg" showPhrase />
                   </div>
                 )}
                 {eachDayOfInterval({
                    start: startOfWeek(startOfMonth(currentMonth)),
                    end: endOfWeek(endOfMonth(currentMonth))
                 }).map((day) => {
                    const isToday = isSameDay(day, new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const dayEvents = getEventsForDay(day);
                    const visibleEvents = dayEvents.slice(0, 2);
                    const hiddenCount = dayEvents.length - visibleEvents.length;

                    return (
                      <div 
                        key={day.toString()}
                        onClick={() => setSelectedDay(day)}
                        className={`min-h-0 p-1.5 border-r border-b border-[var(--color-bg-border)] transition-all hover:bg-[var(--color-bg-secondary)]/10 cursor-pointer overflow-hidden flex flex-col
                          ${!isCurrentMonth ? 'bg-[var(--color-bg-secondary)]/20' : ''}
                          ${isToday ? 'bg-blue-500/5' : ''}
                          ${isSelected ? 'ring-1 ring-inset ring-blue-400/50' : ''}
                        `}
                      >
                         <div className="flex justify-between items-start mb-1 shrink-0">
                            <span className={`w-5 h-5 flex items-center justify-center text-[10px] font-black rounded-md
                              ${isToday ? 'bg-blue-500 text-white' : isCurrentMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}
                            `}>
                               {format(day, 'd')}
                            </span>
                         </div>
                         <div className="space-y-0.5 flex-1 min-h-0 overflow-hidden">
                            {visibleEvents.map((event, eIdx) => (
                              <div 
                                key={`${event._id}_${eIdx}`}
                                className={eventPillClass(event, true)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDay(day);
                                  if (event.type === 'holiday' || event.type === 'task') return;
                                  setEditingEvent(event);
                                  setIsModalOpen(true);
                                }}
                              >
                                 {event.type === 'holiday' && <span>🇮🇳</span>}
                                 <span className="truncate">{getCalendarEventTypeLabel(event)} · {event.title}</span>
                              </div>
                            ))}
                            {hiddenCount > 0 && (
                              <div className="px-1.5 py-0.5 text-[8px] font-black text-[var(--color-text-muted)] uppercase">
                                +{hiddenCount} more
                              </div>
                            )}
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        </main>
      </div>

      <CalendarEntryModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
        onEntryCreated={() => refetchAllEvents()}
        initialData={editingEvent}
        defaultDate={selectedDay}
      />
    </ListPageLayout>
  );
};

export default CalendarView;
