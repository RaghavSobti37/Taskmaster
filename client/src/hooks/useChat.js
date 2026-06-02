import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { AXIOS_SKIP_TOAST } from '../lib/notifications';

const chatHeaders = { ...AXIOS_SKIP_TOAST };

export const chatKeys = {
  channels: (filters = {}) => ['chat-channels', filters],
  messages: (channelId) => ['chat-messages', channelId],
  channel: (channelId) => ['chat-channel', channelId],
};

export function useChatChannels({ workspace = '', projectId = '' } = {}) {
  const filters = { workspace: workspace || undefined, projectId: projectId || undefined };
  return useQuery({
    queryKey: chatKeys.channels(filters),
    queryFn: async () => {
      try {
        const { data } = await axios.get('/api/chat/channels', {
          headers: chatHeaders,
          params: filters,
        });
        return {
          grouped: data.data || { project: [], dm: [], group: [] },
          channels: data.channels || [],
          dms: data.dms || data.data?.dm || [],
          groups: data.groups || data.data?.group || [],
        };
      } catch (err) {
        throw err;
      }
    },
    staleTime: 30_000,
    retry: (failureCount, error) => {
      if (error?.code === 'ERR_NETWORK' && failureCount < 6) return true;
      return failureCount < 2;
    },
    refetchOnWindowFocus: true,
  });
}

export function useChatMessages(channelId) {
  return useQuery({
    queryKey: chatKeys.messages(channelId),
    queryFn: async () => {
      const { data } = await axios.get(`/api/chat/channels/${channelId}/messages`, {
        headers: chatHeaders,
      });
      return data.data || [];
    },
    enabled: !!channelId,
  });
}

export function useSendChatMessage(channelId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.post(`/api/chat/channels/${channelId}/messages`, payload, {
        headers: chatHeaders,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(channelId) });
      queryClient.setQueriesData({ queryKey: ['chat-channels'] }, (old) => {
        if (!old?.channels) return old;
        const patch = (list) =>
          (list || []).map((ch) =>
            ch._id === channelId ? { ...ch, unreadCount: 0 } : ch
          );
        return {
          ...old,
          channels: patch(old.channels),
          dms: patch(old.dms),
          groups: patch(old.groups),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

export function useMarkChatRead(channelId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await axios.patch(`/api/chat/channels/${channelId}/read`, {}, { headers: chatHeaders });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

export function useOpenDm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      const { data } = await axios.post('/api/chat/dm', { userId }, { headers: chatHeaders });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

export function useCreateGroupChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, memberIds, workspace, projectIds = [] }) => {
      const { data } = await axios.post(
        '/api/chat/channels',
        { name, memberIds, workspace, projectIds },
        { headers: chatHeaders }
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    },
  });
}

export function useUpdateChatChannel(channelId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axios.patch(`/api/chat/channels/${channelId}`, payload, {
        headers: chatHeaders,
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      if (channelId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.channel(channelId) });
      }
    },
  });
}

export function useLoadOlderMessages(channelId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cursor) => {
      const { data } = await axios.get(`/api/chat/channels/${channelId}/messages`, {
        params: { cursor, limit: 50 },
        headers: chatHeaders,
      });
      return data;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(chatKeys.messages(channelId), (old = []) => {
        const merged = [...(result.data || []), ...old];
        const seen = new Set();
        return merged.filter((m) => {
          const id = m._id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });
    },
  });
}
