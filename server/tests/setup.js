process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'jest-test-jwt-secret';
}

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(mongoUri);

  const SystemHealthService = require('../services/SystemHealthService');
  await SystemHealthService.checkDependencies();
});

afterAll(async () => {
  try {
    const { drainMemoryQueue } = require('../services/queueService');
    await drainMemoryQueue();
  } catch {
    // queueService may not have loaded in this suite
  }

  try {
    const { shutdownBackgroundQueue } = require('../services/backgroundQueue');
    await shutdownBackgroundQueue();
  } catch {
    // backgroundQueue may not have loaded in this suite
  }

  try {
    const { shutdownDomainSync } = require('../services/sync/eventBus');
    await shutdownDomainSync();
  } catch {
    // eventBus may not have loaded in this suite
  }

  if (mongoose.connection.readyState !== 0) {
    mongoose.connection.removeAllListeners();
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  try {
    const { drainMemoryQueue } = require('../services/queueService');
    await drainMemoryQueue();
  } catch {
    // queueService may not have loaded in this suite
  }

  try {
    const { drainDomainSyncMemoryQueue } = require('../services/sync/eventBus');
    await drainDomainSyncMemoryQueue();
  } catch {
    // eventBus may not have loaded in this suite
  }

  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
});
