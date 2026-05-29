import { io } from 'socket.io-client';

let socket = null;

const getSocketUrl = () => {
  const api = import.meta.env.VITE_API_URL;
  if (api) return api.replace(/\/$/, '');
  return window.location.origin;
};

const connect = () => {
  const token = localStorage.getItem('coreknot_token');
  if (!token) return null;

  if (socket?.connected && socket.auth?.token === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(getSocketUrl(), {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  return socket;
};

export const disconnectRealtime = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Subscribe to realtime broadcast events on a channel (Socket.io replacement for Supabase Realtime)
 */
export const subscribeToChannel = (channelName, event, callback) => {
  const token = localStorage.getItem('coreknot_token');
  if (!token) return () => {};

  const s = connect();
  if (!s) return () => {};

  const onConnect = () => {
    s.emit('join', channelName);
  };

  if (s.connected) {
    onConnect();
  } else {
    s.once('connect', onConnect);
  }

  const handler = (payload) => callback(payload);
  s.on(event, handler);

  return () => {
    s.off('connect', onConnect);
    s.off(event, handler);
  };
};
