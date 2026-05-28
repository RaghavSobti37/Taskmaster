import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Globe, Lock, RefreshCw, Star, Clock } from 'lucide-react';
import CalendarEntryModal from '../../components/CalendarEntryModal';
import { 
  Badge, 
  PageHeader, 
  PageContainer, 
  Card, 
  Button
} from '../../components/ui';
import { useCalendarEvents } from '../../hooks/useTaskmasterQueries';

const CalendarView = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: calendarEvents = [], isLoading: eventsLoading, refetch: refetchAllEvents } = useCalendarEvents();
  const [holidays, setHolidays] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showHolidays, setShowHolidays] = useState(true);
  const [selectedDay, setSelectedDay] = useState(new Date());

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

  const getEventsForDay = (day) => allEvents.filter(e => {
    const d = parseLocalDate(e.dueDate);
    return d && isSameDay(d, day);
  });

  const getEventStyle = (event) => {
    if (event.type === 'holiday') {
      return 'bg-[var(--color-pastel-rose-bg)] text-[var(--color-pastel-rose-text)] border-[var(--color-pastel-rose-text)]/20';
    }
    if (event.visibility === 'public') {
      return 'bg-[var(--color-pastel-mint-bg)] text-[var(--color-pastel-mint-text)] border-[var(--color-pastel-mint-text)]/20';
    }
    return 'bg-[var(--color-pastel-info-bg)] text-[var(--color-pastel-info-text)] border-[var(--color-pastel-info-text)]/20';
  };

  const getDotColor = (event) => {
    if (event.type === 'holiday') return 'bg-rose-500';
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
            const isSelected = selectedDay && isSameDay(day, selectedDay);
            const dayEvents = getEventsForDay(day);
            const dotColors = [...new Set(dayEvents.map(getDotColor))].slice(0, 3);

            return (
              <div
                key={day.toString()}
                className={`relative text-center py-1.5 text-[9px] font-black rounded-full cursor-pointer transition-all
                  ${!isCurrentMonth ? 'opacity-20' : 'opacity-100'}
                  ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[var(--color-bg-secondary)]' : ''}
                  ${isToday ? 'bg-blue-500 text-white shadow-lg' : 'hover:bg-[var(--color-bg-workspace)]'}
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
      </Card>
    );
  };

  const renderSelectedDayPanel = () => (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">
          {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a day'}
        </h4>
        {selectedDay && (
          <Badge variant="slate">{selectedDayEvents.length} EVENTS</Badge>
        )}
      </div>
      {!selectedDay ? (
        <p className="text-[10px] text-[var(--color-text-muted)] italic">Click a day to view all events.</p>
      ) : selectedDayEvents.length === 0 ? (
        <p className="text-[10px] text-[var(--color-text-muted)] italic text-center py-4">No events on this day</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {selectedDayEvents.map((event, idx) => (
            <div
              key={`${event._id}_${idx}`}
              className={`px-2.5 py-2 text-[9px] font-bold uppercase border rounded-lg flex items-start gap-2 cursor-pointer hover:opacity-90 ${getEventStyle(event)}`}
              onClick={() => {
                if (event.type !== 'holiday') {
                  setEditingEvent(event);
                  setIsModalOpen(true);
                }
              }}
            >
              {event.type === 'holiday' && <span>🇮🇳</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate">{event.title}</p>
                {event.dueDate && event.dueDate.includes('T') && (
                  <p className="text-[8px] opacity-70 flex items-center gap-1 mt-0.5 normal-case">
                    <Clock size={8} /> {format(parseLocalDate(event.dueDate), 'h:mm a')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );

  return (
    <PageContainer className="!py-4 !space-y-4 flex flex-col min-h-[calc(100vh-6rem)]">
      <PageHeader
        title="Calendar"
        subtitle="Schedule meetings, follow-ups, and track holidays."
        actions={
          <div className="flex items-center gap-2">
             <Button variant="secondary" size="sm" onClick={() => refetchAllEvents()}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Sync Calendar</Button>
             <Button size="sm" onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}><Plus size={14} /> Create Event</Button>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        <aside className="w-full lg:w-72 space-y-4 shrink-0">
           {renderMiniCalendar()}
           {renderSelectedDayPanel()}
           <Card className="p-4 space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[var(--color-text-muted)]">Calendar Filters</h4>
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

        <main className="flex-1 min-w-0 min-h-0 flex flex-col">
           <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
              <div className="p-3 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)] flex items-center justify-between shrink-0">
                 <div className="flex items-center gap-4">
                    <Button variant="secondary" size="xs" onClick={() => { const today = new Date(); setCurrentMonth(today); setSelectedDay(today); }}>Today</Button>
                    <div className="flex items-center gap-1">
                       <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft size={16} /></Button>
                       <Button variant="ghost" size="xs" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight size={16} /></Button>
                    </div>
                    <h3 className="text-xs font-black uppercase tracking-tight ml-2">{format(currentMonth, 'MMMM yyyy')}</h3>
                 </div>
              </div>

              <div className="grid grid-cols-7 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-secondary)]/30 shrink-0">
                 {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                   <div key={d} className="py-2 text-center text-[9px] font-black uppercase tracking-widest text-[var(--color-text-muted)] border-r border-[var(--color-bg-border)] last:border-r-0">
                     {d}
                   </div>
                 ))}
              </div>

              <div className="flex-1 min-h-0 grid grid-cols-7 auto-rows-fr overflow-hidden">
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
                                className={`px-1.5 py-0.5 text-[8px] font-black uppercase truncate border rounded-sm flex items-center gap-1 ${getEventStyle(event)}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDay(day);
                                  if (event.type !== 'holiday') {
                                    setEditingEvent(event);
                                    setIsModalOpen(true);
                                  }
                                }}
                              >
                                 {event.type === 'holiday' && <span>🇮🇳</span>}
                                 <span className="truncate">{event.title}</span>
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
