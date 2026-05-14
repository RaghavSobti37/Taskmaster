import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProjectCalendar = ({ projectId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/projects/${projectId}/calendar-events`);
      setEvents(res.data);
    } catch (err) {
      console.error('Error fetching calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [projectId]);

  const handleLinkCalendar = async () => {
    setLinking(true);
    try {
      await axios.post(`/api/projects/${projectId}/link-calendar`);
      fetchEvents();
    } catch (err) {
      console.error('Error linking calendar:', err);
      alert('Failed to link calendar. Make sure you are signed in with Google.');
    } finally {
      setLinking(false);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date);
      return isSameDay(day, eventDate);
    });
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-surface)] rounded-3xl border border-[var(--color-bg-border)] overflow-hidden shadow-sm">
      {/* Calendar Header */}
      <div className="flex items-center justify-between p-6 border-b border-[var(--color-bg-border)]">
        <div className="flex items-center gap-6">
          <h2 className="text-xl font-black uppercase tracking-tight text-[var(--color-text-primary)]">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-[var(--color-bg-workspace)] rounded-xl border border-[var(--color-bg-border)] p-1">
            <button 
              onClick={prevMonth}
              className="p-1.5 hover:bg-[var(--color-bg-surface)] rounded-lg transition-colors text-[var(--color-text-muted)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-bg-surface)] rounded-lg transition-colors text-[var(--color-text-secondary)]"
            >
              Today
            </button>
            <button 
              onClick={nextMonth}
              className="p-1.5 hover:bg-[var(--color-bg-surface)] rounded-lg transition-colors text-[var(--color-text-muted)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2.5 bg-[var(--color-bg-workspace)] border border-[var(--color-bg-border)] rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-action-primary)] transition-all"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLinkCalendar}
            disabled={linking}
            className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            <CalendarIcon size={14} /> Link My Calendar
          </button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b border-[var(--color-bg-border)] bg-[var(--color-bg-workspace)]/30">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] border-r border-[var(--color-bg-border)] last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-7 h-full min-h-[600px]">
          {calendarDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDay = isToday(day);

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[120px] p-2 border-r border-b border-[var(--color-bg-border)] transition-colors hover:bg-[var(--color-bg-workspace)]/40 ${!isCurrentMonth ? 'bg-[var(--color-bg-workspace)]/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`
                    flex items-center justify-center w-7 h-7 text-[11px] font-black rounded-full transition-all
                    ${isTodayDay ? 'bg-[var(--color-action-primary)] text-white shadow-lg shadow-blue-500/30' : 
                      isCurrentMonth ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)] opacity-50'}
                  `}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      className="group relative px-2 py-1 bg-blue-50 border border-blue-100 rounded-md text-[10px] text-blue-700 font-bold truncate hover:z-10 hover:shadow-md transition-all cursor-pointer"
                      title={event.summary}
                    >
                      <div className="flex items-center gap-1">
                        {event.user?.avatar ? (
                          <img src={event.user.avatar} alt="" className="w-3 h-3 rounded-full" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-blue-200 flex items-center justify-center text-[6px]">
                            {event.user?.name?.[0]}
                          </div>
                        )}
                        <span className="truncate">{event.summary}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProjectCalendar;
