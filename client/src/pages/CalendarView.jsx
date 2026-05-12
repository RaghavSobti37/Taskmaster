import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from 'lucide-react';

const CalendarView = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await axios.get('/api/tasks');
        setTasks(res.data);
      } catch (err) {
        console.error('Error fetching tasks:', err);
      }
    };
    fetchTasks();
  }, []);

  const renderHeader = () => (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Temporal Layout</h1>
        <p className="text-[var(--color-text-secondary)]">Map scheduled tasks to daily, weekly, or monthly calendar grids.</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-[var(--color-bg-surface)] border border-[var(--color-bg-border)] rounded-xl overflow-hidden shadow-sm">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2.5 hover:bg-[var(--color-bg-workspace)] transition-colors border-r border-[var(--color-bg-border)]">
            <ChevronLeft size={20} />
          </button>
          <div className="px-6 py-2.5 font-bold text-sm min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2.5 hover:bg-[var(--color-bg-workspace)] transition-colors border-l border-[var(--color-bg-border)]">
            <ChevronRight size={20} />
          </button>
        </div>
        <button className="flex items-center gap-2 bg-[var(--color-action-primary)] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--color-action-hover)] transition-all shadow-lg shadow-blue-500/20">
          <Plus size={20} /> New Entry
        </button>
      </div>
    </div>
  );

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map(day => (
          <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] py-2">
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

    return (
      <div className="grid grid-cols-7 bg-[var(--color-bg-border)] gap-px border border-[var(--color-bg-border)] rounded-2xl overflow-hidden shadow-sm">
        {days.map(day => {
          const dayTasks = tasks.filter(task => task.dueDate && isSameDay(new Date(task.dueDate), day));
          return (
            <div 
              key={day.toString()} 
              className={`min-h-[140px] bg-[var(--color-bg-surface)] p-3 transition-colors hover:bg-gray-50
                ${!isSameMonth(day, monthStart) ? 'bg-gray-50/50' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-bold ${isSameDay(day, new Date()) ? 'w-6 h-6 bg-[var(--color-action-primary)] text-white flex items-center justify-center rounded-full' : 'text-[var(--color-text-secondary)]'}`}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1 overflow-y-auto max-h-[90px]">
                {dayTasks.map(task => (
                  <div key={task._id} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-md truncate border border-blue-100">
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
};

export default CalendarView;
