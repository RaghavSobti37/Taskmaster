const { Server } = require('socket.io');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const { isAdminUser, isOpsUser } = require('../utils/departmentPermissions');
const { COOKIE_NAME } = require('../utils/authCookie');
const { isVercelAppOrigin, allowVercelPreviewOrigins } = require('../utils/vercelOrigins');
const { loadAuthUser } = require('../utils/authUserLookup');
const { resolveRequestUser } = require('../middleware/authMiddleware');

let io = null;
const log = () => require('../utils/logger');

const realtimeJwtSecret = () => process.env.SOCKET_JWT_SECRET || process.env.JWT_SECRET;

const verifyRealtimeBearer = async (authToken) => {
  const secret = realtimeJwtSecret();
  if (!secret || typeof authToken !== 'string' || !authToken.trim()) return null;
  try {
    const decoded = jwt.verify(authToken.trim(), secret);
    if (decoded.scope !== 'realtime' || !decoded.id) return null;
    const user = await loadAuthUser(decoded.id);
    if (!user || user.suspended) return null;
    return user;
  } catch {
    return null;
  }
};

const buildSocketAuthRequest = (socket) => {
  const cookieHeader = socket.handshake.headers.cookie || '';
  const cookies = cookie.parse(cookieHeader);
  return {
    cookies,
    headers: { cookie: cookieHeader },
    ip: socket.handshake.address,
    get(name) {
      const key = String(name || '').toLowerCase();
      if (key === 'cookie') return cookieHeader;
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
      const authToken = socket.handshake.auth?.token;
      let user = null;

      if (authToken) {
        user = await verifyRealtimeBearer(authToken);
      } else {
        const req = buildSocketAuthRequest(socket);
        const hasCookie = Boolean(req.cookies?.[COOKIE_NAME]);
        if (!hasCookie) return next(new Error('Unauthorized'));
        const resolved = await resolveRequestUser(req);
        if (resolved.suspended || !resolved.user) return next(new Error('Unauthorized'));
        user = resolved.user;
      }

      if (!user) return next(new Error('Unauthorized'));

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
      const room = channelName.trim();
      if (room.startsWith(`user-`) && room !== `user-${socket.userId}` && !socket.isAdmin && !socket.isOps) {
        return;
      }
      socket.join(room);
    });

    socket.on('disconnect', () => {
      log().info('Realtime', 'Client disconnected', { userId: socket.userId });
    });
  });

  return io;
};

const getIo = () => io;

const broadcastRealtimeEvent = (room, event, payload) => {
  if (!io) return;
  io.to(room).emit(event, payload);
};

const closeRealtime = () => {
  if (!io) return;
  io.close();
  io = null;
};

module.exports = {
  initRealtime,
  getIo,
  broadcastRealtimeEvent,
  closeRealtime,
};
