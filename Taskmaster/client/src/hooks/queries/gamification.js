import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const normalizeLeaderboardResponse = (raw) => {
  if (Array.isArray(raw)) return { entries: raw, meta: null };
  return { entries: raw?.entries || [], meta: raw?.meta || null };
};

export const useLeaderboard = (monthStartKey, enabled = true) => useQuery({
  queryKey: ['gamification', 'leaderboard', monthStartKey || 'current'],
  queryFn: async () =>
    normalizeLeaderboardResponse(
      (await axios.get('/api/gamification/leaderboard', { params: monthStartKey ? { monthStartKey } : {} })).data
    ),
  enabled,
  staleTime: 1000 * 60,
});

export const useLeaderboardBreakdown = (userId, monthStartKey, enabled = true) => useQuery({
  queryKey: ['gamification', 'leaderboard', 'breakdown', userId, monthStartKey || 'current'],
  queryFn: async () =>
    (await axios.get(`/api/gamification/leaderboard/${userId}/breakdown`, { params: monthStartKey ? { monthStartKey } : {} })).data,
  enabled: enabled && !!userId,
  staleTime: 1000 * 30,
});

export const useLeaderboardHistory = (limit = 12, enabled = true) => useQuery({
  queryKey: ['gamification', 'leaderboard', 'history', limit],
  queryFn: async () => (await axios.get('/api/gamification/leaderboard/history', { params: { limit } })).data,
  enabled,
  staleTime: 1000 * 60,
});

export const useGamificationProgress = (enabled = true) => useQuery({
  queryKey: ['gamification', 'progress'],
  queryFn: async () => (await axios.get('/api/gamification/progress')).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useGamificationHistory = (page = 1, limit = 10, enabled = true) => useQuery({
  queryKey: ['gamification', 'history', page, limit],
  queryFn: async () => (await axios.get('/api/gamification/history', { params: { page, limit } })).data,
  enabled,
  staleTime: 1000 * 30,
});

export const useGamificationMissions = (enabled = true) => useQuery({
  queryKey: ['gamification', 'missions'],
  queryFn: async () => (await axios.get('/api/gamification/missions')).data,
  enabled,
  staleTime: 1000 * 60,
});
