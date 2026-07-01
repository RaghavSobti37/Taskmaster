const { Server } = require('socket.io');
const cookie = require('cookie');
const User = require('../models/User');
const { isAdminUser, isOpsUser } = require('../utils/departmentPermissions');
const { COOKIE_NAME } = require('../utils/authCookie');
const { isVercelAppOrigin, allowVercelPreviewOrigins } = require('../utils/vercelOrigins');
const { resolveRequestUser } = require('../middleware/authMiddleware');

let io = null;
const log = () => require('../utils/logger');

const buildSocketAuthRequest = (socket) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookies = cookie.parse(cookieHeader);
  const authToken = socket.handshake.auth?.token;
  const headers = { cookie: cookieHeader };

  if (authToken && typeof authToken === 'string') {
    headers.authorization = `Bearer ${authToken}`;
  }

  return {
    cookies,
    headers,
    ip: socket.handshake.address,
    get(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'cookie') return cookieHeader;
      if (key === 'authorization') return headers.authorization;
      return socket.handshake.headers[key];
    },
  };
};

const initRealtime = (httpServer, corsAllowlist = new Set()) => {
  if (io) return io;

  const origins = [...corsAllowlist];
  const allowVercelPreviews = allowVercelPreviewOrigins();

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origins.includes(origin)) return callback(null, true);
        if (allowVercelPreviews && isVercelAppOrigin(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const req = buildSocketAuthRequest(socket);
      const hasToken = Boolean(
        req.cookies?.[COOKIE_NAME]
        || req.headers.authorization,
      );
      if (!hasToken) return next(new Error('Unauthorized'));

      const { user, suspended } = await resolveRequestUser(req);
      if (suspended || !user) return next(new Error('Unauthorized'));

      socket.userId = user._id.toString();
      socket.isAdmin = isAdminUser(user);
      socket.isOps = isOpsUser(user);
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    log().info('Realtime', 'Client connected', { userId: socket.userId });

    socket.join(`user-${socket.userId}`);

    socket.on('join', async (channelName) => {
      if (typeof channelName !== 'string' || !channelName.trim()) return;

      if (channelName.startsWith('user-')) {
        const channelUserId = channelName.slice(5);
        if (channelUserId !== socket.userId && !socket.isAdmin) {
          return;
        }
      }

      socket.join(channelName);
    });

    socket.on('disconnect', () => {
      log().info('Realtime', 'Client disconnected', { userId: socket.userId });
    });
  });

  log().debug('Realtime', 'Socket.io initialized');
  return io;
};

const broadcastRealtimeEvent = (channelName, event, payload = {}) => {
  if (!io) return;
  try {
    io.to(channelName).emit(event, payload);
  } catch (err) {
    log().warn('Realtime', 'Broadcast failed', { channelName, event, error: err.message });
  }
};

const closeRealtime = () =>
  new Promise((resolve) => {
    if (!io) return resolve();
    io.close(() => {
      io = null;
      resolve();
    });
  });

module.exports = {
  initRealtime,
  broadcastRealtimeEvent,
  closeRealtime,
  buildSocketAuthRequest,
};
