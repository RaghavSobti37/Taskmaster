import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { invalidateStatusCounts } from '../../lib/queryInvalidation';

export const useCalendarEvents = () => useQuery({
  queryKey: ['calendarEvents'],
  queryFn: async () => {
    const [dbRes, googleRes] = await Promise.all([
      axios.get('/api/calendar'),
      axios.get('/api/google/calendar/events').catch(() => ({ data: [] })),
    ]);
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
    const googleEvents = googleRes.data.map((ev) => ({
      _id: ev.id,
      title: ev.summary,
      description: '',
      dueDate: ev.start.dateTime || ev.start.date,
      visibility: 'private',
      type: 'google',
      source: 'google_calendar',
    }));
    const combined = [...dbEvents, ...googleEvents];
    return Array.from(new Map(combined.map((ev) => [ev._id, ev])).values());
  },
  staleTime: 1000 * 60,
});

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
