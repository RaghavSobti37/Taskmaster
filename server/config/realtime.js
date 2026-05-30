const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');
const { isAdminUser, isOpsUser } = require('../utils/departmentPermissions');

let io = null;

const initRealtime = (httpServer, corsAllowlist = new Set()) => {
  const origins = [...corsAllowlist];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || origins.includes(origin) || origin.endsWith('.vercel.app')) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)
        .select('_id departmentId')
        .populate('departmentId', 'slug');
      if (!user) return next(new Error('Unauthorized'));

      socket.userId = user._id.toString();
      socket.isAdmin = isAdminUser(user);
      socket.isOps = isOpsUser(user);
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Realtime', 'Client connected', { userId: socket.userId });

    socket.on('join', (channelName) => {
      if (typeof channelName !== 'string' || !channelName.trim()) return;

      if (channelName === 'system-logs') {
        if (!socket.isAdmin && !socket.isOps) return;
      }

      if (channelName.startsWith('user-')) {
        const channelUserId = channelName.slice(5);
        if (channelUserId !== socket.userId && !socket.isAdmin) {
          return;
        }
      }

      socket.join(channelName);
    });

    socket.on('disconnect', () => {
      logger.info('Realtime', 'Client disconnected', { userId: socket.userId });
    });
  });

  logger.info('Realtime', 'Socket.io initialized');
  return io;
};

const broadcastRealtimeEvent = (channelName, event, payload = {}) => {
  if (!io) return;
  try {
    io.to(channelName).emit(event, payload);
  } catch (err) {
    logger.warn('Realtime', 'Broadcast failed', { channelName, event, error: err.message });
  }
};

module.exports = {
  initRealtime,
  broadcastRealtimeEvent,
  getIO: () => io,
};
