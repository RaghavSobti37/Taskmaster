import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';

function defaultCalendarRange() {
  const now = new Date();
  const start = subMonths(startOfMonth(now), 1);
  const end = addMonths(endOfMonth(now), 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function buildRangeParams(range) {
  const { start, end } = range?.start && range?.end ? range : defaultCalendarRange();
  return { start, end };
}

async function fetchCalendarEvents(range) {
  const { start, end } = buildRangeParams(range);
  const params = { start, end };

  const dbRes = await axios.get('/api/calendar', { params });

  let googleSyncWarning = null;
  let googleData = [];
  try {
    const googleRes = await axios.get('/api/google/calendar/events', { params });
    googleData = googleRes.data || [];
  } catch (err) {
    googleSyncWarning = err.response?.data?.error || err.message || 'Google Calendar sync failed';
  }

  const dbEvents = dbRes.data.map((ev) => ({
    _id: ev._id,
    title: ev.title,
    description: ev.description,
    dueDate: ev.date || ev.dueDate,
    endDate: ev.endDate || ev.date || ev.dueDate,
    date: ev.date,
    visibility: ev.visibility,
    createdBy: ev.createdBy,
    type: ev.type || 'event',
    eventType: ev.eventType || 'event',
    meetingLink: ev.meetingLink || '',
    workspace: ev.workspace,
    status: ev.status,
    priority: ev.priority,
    projectId: ev.projectId,
  }));

  const googleEvents = googleData.map((ev) => ({
    _id: ev.id,
    title: ev.summary,
    description: '',
    dueDate: ev.start?.dateTime || ev.start?.date,
    endDate: ev.end?.dateTime || ev.end?.date || ev.start?.dateTime || ev.start?.date,
    visibility: 'private',
    type: 'google',
    source: 'google_calendar',
  }));

  const combined = [...dbEvents, ...googleEvents];
  const events = Array.from(new Map(combined.map((ev) => [ev._id, ev])).values());
  return { events, googleSyncWarning };
}

export const useCalendarEvents = (range) => {
  const { start, end } = buildRangeParams(range);
  const query = useQuery({
    queryKey: ['calendarEvents', start, end],
    queryFn: () => fetchCalendarEvents({ start, end }),
    staleTime: 1000 * 60,
  });

  return {
    ...query,
    data: query.data?.events ?? [],
    googleSyncWarning: query.data?.googleSyncWarning ?? null,
  };
};

export const fetchCalendarHolidays = async (year) => {
  const res = await axios.get(`/api/google/holidays?year=${year}`);
  const uniqueHolidays = Array.from(new Map(res.data.map((h) => [h.id, h])).values());
  return uniqueHolidays.map((h) => ({
    _id: h.id,
    title: h.summary,
    dueDate: h.start.date || h.start.dateTime,
    endDate: h.start.date || h.start.dateTime,
    description: h.description || '',
    type: 'holiday',
    source: h.source || 'google_calendar',
  }));
};

const useCreateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event) => axios.post('/api/calendar', event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

const useUpdateCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/calendar/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

const useDeleteCalendarEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.delete(`/api/calendar/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarEvents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
      invalidateStatusCounts(queryClient);
    },
  });
};

export { useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent };
