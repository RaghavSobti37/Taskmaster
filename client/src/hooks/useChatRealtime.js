import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToChannel, connect } from '../lib/realtime';
import { chatKeys } from './useChat';

export function useChatInboxRealtimeForUser(userId, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    return subscribeToChannel(`user-${userId}`, 'chat_inbox', () => {
      queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
    });
  }, [queryClient, enabled, userId]);
}

export function useChatChannelRealtime(channelId, onMessage, onTyping, onRead) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return undefined;

    const room = `chat-${channelId}`;
    const unsubMessage = subscribeToChannel(room, 'chat_message', (payload) => {
      if (payload?.message) {
        queryClient.setQueryData(chatKeys.messages(channelId), (old = []) => {
          const exists = old.some((m) => m._id === payload.message._id);
          if (exists) return old;
          return [...old, payload.message];
        });
        queryClient.invalidateQueries({ queryKey: ['chat-channels'] });
      }
      onMessage?.(payload);
    });

    const unsubTyping = subscribeToChannel(room, 'chat_typing', (payload) => {
      onTyping?.(payload);
    });

    const unsubRead = subscribeToChannel(room, 'chat_read', (payload) => {
      onRead?.(payload);
    });

    return () => {
      unsubMessage();
      unsubTyping();
      unsubRead();
    };
  }, [channelId, queryClient, onMessage, onTyping, onRead]);
}

export function useEmitChatTyping(channelId, userName = '') {
  return useCallback(() => {
    if (!channelId) return;
    const s = connect();
    if (s?.connected) {
      s.emit('chat_typing', { channelId, name: userName });
    } else {
      axiosPostTyping(channelId);
    }
  }, [channelId, userName]);
}

async function axiosPostTyping(channelId) {
  try {
    const axios = (await import('axios')).default;
    await axios.post(`/api/chat/channels/${channelId}/typing`, {}, {
      headers: { 'x-skip-toast': 'true' },
      withCredentials: true,
    });
  } catch {
    /* ignore */
  }
}
