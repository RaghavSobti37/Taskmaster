import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { patchAttendanceQueries } from './attendanceCache';

export const useAttendanceRosterUsers = (params = {}, enabled = true) => useQuery({
  queryKey: ['attendanceRosterUsers', params],
  queryFn: async () => (await axios.get('/api/attendance/roster-users', { params })).data.users,
  enabled,
  staleTime: 1000 * 60,
});

export const useAttendance = (params = {}, enabled = true) => useQuery({
  queryKey: ['attendance', params],
  queryFn: async () => (await axios.get('/api/attendance', { params })).data,
  enabled,
  staleTime: 1000 * 60,
});

export const useAttendanceCheck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await axios.post('/api/attendance/check', payload)).data,
    onSuccess: (updatedRow) => {
      patchAttendanceQueries(queryClient, updatedRow);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
      queryClient.invalidateQueries({ queryKey: ['gamification', 'leaderboard'] });
    },
  });
};

export const useUndoAttendanceCheck = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => (await axios.post('/api/attendance/check/undo', payload)).data,
    onSuccess: (updatedRow) => {
      patchAttendanceQueries(queryClient, updatedRow);
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
    },
  });
};

export const useApproveAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalTarget, manualTime, workMode }) => axios.patch(`/api/attendance/${id}/approve`, { approvalTarget, manualTime, workMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
      queryClient.invalidateQueries({ queryKey: ['gamification'] });
    },
  });
};

export const useApplyLeave = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.post('/api/attendance/leave', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
  });
};

export const useLeaveRequests = (params = {}, enabled = true) => useQuery({
  queryKey: ['leaveRequests', params],
  queryFn: async () => (await axios.get('/api/attendance/leave/requests', { params })).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useMyReimbursements = (enabled = true) => useQuery({
  queryKey: ['my-reimbursements'],
  queryFn: async () => {
    const { data } = await axios.get('/api/finance/my-invoices?submissionType=reimbursement');
    return data?.data || [];
  },
  enabled,
  staleTime: 1000 * 60,
});

export const useApproveLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => axios.patch(`/api/attendance/leave/requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
    },
  });
};

export const useRejectLeaveRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reviewNote }) => axios.patch(`/api/attendance/leave/requests/${id}/reject`, { reviewNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }),
  });
};

export const useResetAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => axios.delete('/api/attendance/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
      queryClient.invalidateQueries({ queryKey: ['leaveRequests'] });
    },
  });
};

const useUpdateAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => axios.put(`/api/attendance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
    },
  });
};

export const useUpsertAttendance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => axios.put('/api/attendance/upsert/by-user-date', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceRosterUsers'] });
    },
  });
};
