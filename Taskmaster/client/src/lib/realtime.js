import { io } from 'socket.io-client';
import { getRealtimeOrigin, isCrossOriginRealtime, apiPath } from '../utils/apiBase';
import { AUTH_SESSION_PROBE_HEADERS } from '../utils/authSessionProbe';

let socket = null;
let socketPromise = null;
let subscriberCount = 0;
let disconnectTimer = null;

const REALTIME_IDLE_DISCONNECT_MS = 60_000;

const fetchRealtimeToken = async () => {
  const res = await fetch(apiPath('/api/auth/realtime-token'), {
    method: 'GET',
    credentials: 'include',
    headers: AUTH_SESSION_PROBE_HEADERS,
  });
  if (!res.ok) return null;
  const body = await res.json();
  return body.token || null;
};

const createSocket = async () => {
  const options = {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    autoConnect: true,
  };

  if (isCrossOriginRealtime()) {
    const token = await fetchRealtimeToken();
    if (token) {
      options.auth = { token };
    }
  }

  return io(getRealtimeOrigin(), options);
};

const ensureSocket = () => {
  if (socket) return Promise.resolve(socket);
  if (!socketPromise) {
    socketPromise = createSocket().then((created) => {
      socket = created;
      return created;
    });
  }
  return socketPromise;
};

const retainSocket = () => {
  subscriberCount += 1;
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  ensureSocket().catch(() => {});
};

const releaseSocket = () => {
  subscriberCount = Math.max(0, subscriberCount - 1);
  if (subscriberCount > 0 || disconnectTimer) return;
  disconnectTimer = setTimeout(() => {
    disconnectTimer = null;
    if (subscriberCount === 0) disconnectRealtime();
  }, REALTIME_IDLE_DISCONNECT_MS);
};

export const connect = () => {
  retainSocket();
  return socket;
};

export const disconnectRealtime = () => {
  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }
  subscriberCount = 0;
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socketPromise = null;
};

/**
 * Subscribe to realtime broadcast events on a channel (Socket.io replacement for Supabase Realtime)
 */
export const subscribeToChannel = (channelName, event, callback) => {
  let cleaned = false;
  let socketRef = null;
  let onConnect = null;
  const handler = (payload) => callback(payload);

  retainSocket();

  const attach = (s) => {
    if (cleaned || !s) return;
    socketRef = s;
    onConnect = () => {
      s.emit('join', channelName);
    };
    if (s.connected) {
      onConnect();
    } else {
      s.once('connect', onConnect);
    }
    s.on(event, handler);
  };

  ensureSocket().then(attach).catch(() => {});

  return () => {
    cleaned = true;
    if (!socketRef) {
      releaseSocket();
      return;
    }
    if (onConnect) socketRef.off('connect', onConnect);
    socketRef.off(event, handler);
    releaseSocket();
  };
};
