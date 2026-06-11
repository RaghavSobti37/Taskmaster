import { io } from 'socket.io-client';
import { getRealtimeOrigin } from '../utils/apiBase';

let socket = null;

const getSocketUrl = () => getRealtimeOrigin();

export const connect = () => {
  // Reuse one client for all channel subscribers. Do not disconnect a socket that
  // is still connecting — parallel subscribeToChannel calls would otherwise loop
  // connect → disconnect on the server.
  if (socket) {
    return socket;
  }

  socket = io(getSocketUrl(), {
    withCredentials: true,
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
