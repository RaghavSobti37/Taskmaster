/**
 * Smoke test for Socket.io realtime (replaces Supabase Realtime).
 * Usage: node scripts/testRealtime.js
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const User = require('../models/User');
const { initRealtime, broadcastRealtimeEvent } = require('../config/realtime');
const http = require('http');

const PORT = 5099;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne();
  if (!user) throw new Error('No user in DB for test');

  const token = jwt.sign(
    { id: user._id.toString(), scope: 'realtime', jti: crypto.randomBytes(8).toString('hex') },
    process.env.JWT_SECRET,
    { expiresIn: '5m' },
  );

  const httpServer = http.createServer();
  initRealtime(httpServer, new Set(['http://localhost:5173']));
  await new Promise((resolve) => httpServer.listen(PORT, resolve));

  const received = [];
  const socket = io(`http://127.0.0.1:${PORT}`, {
    auth: { token },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Socket connect timeout')), 5000);
  });

  socket.emit('join', `user-${user._id}`);
  socket.emit('join', 'tasks');

  socket.on('xp_awarded', (payload) => received.push({ event: 'xp_awarded', payload }));
  socket.on('task_change', (payload) => received.push({ event: 'task_change', payload }));

  await new Promise((r) => setTimeout(r, 200));

  broadcastRealtimeEvent(`user-${user._id}`, 'xp_awarded', { amount: 1, newTotal: 100, action: 'TEST' });
  broadcastRealtimeEvent('tasks', 'task_change', { taskId: 'test-id', action: 'update' });

  await new Promise((r) => setTimeout(r, 300));

  socket.disconnect();
  httpServer.close();
  await mongoose.disconnect();

  const events = received.map((r) => r.event);
  if (!events.includes('xp_awarded') || !events.includes('task_change')) {
    console.error('FAIL: expected xp_awarded + task_change, got:', events);
    process.exit(1);
  }

  console.log('PASS: Socket.io realtime broadcasts received:', events);
}

run().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
