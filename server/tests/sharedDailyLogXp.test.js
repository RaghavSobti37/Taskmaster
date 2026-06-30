const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Log = require('../models/Log');
const XPAuditLog = require('../models/XPAuditLog');
const GamificationConfig = require('../models/GamificationConfig');
const { DEV_DEFAULT_PASSWORD } = require('../../shared/defaultPassword');

const TEST_PASSWORD = DEV_DEFAULT_PASSWORD;

const registerUser = async (agent, { name, email }) => {
  const res = await agent
    .post('/api/auth/register')
    .send({ name, email, password: TEST_PASSWORD, gender: 'male' });
  expect(res.statusCode).toBe(201);
  return res.body;
};

describe('shared daily log XP', () => {
  test('included teammates earn XP from shared manual daily log', async () => {
    await GamificationConfig.create({ dailyLog: 10 });

    const authorAgent = request.agent(app);
    const author = await registerUser(authorAgent, {
      name: 'Log Author',
      email: 'log-author@test.com',
    });

    const memberAgent = request.agent(app);
    const member = await registerUser(memberAgent, {
      name: 'Log Member',
      email: 'log-member@test.com',
    });

    const createRes = await authorAgent.post('/api/logs').send({
      action: 'DAILY_LOG',
      details: {
        timeSpent: '2h',
        workDate: '2026-06-02',
        description: 'Pair session',
        memberIds: [member._id],
      },
    });

    expect(createRes.statusCode).toBe(201);

    const memberLogs = await Log.find({ userId: member._id, action: 'DAILY_LOG' }).lean();
    expect(memberLogs).toHaveLength(1);
    expect(memberLogs[0].details?.isSharedCopy).toBe(true);

    const authorXp = await XPAuditLog.findOne({
      userId: author._id,
      action: 'DAILY_LOG',
      'details.logId': createRes.body._id,
    }).lean();
    const memberXp = await XPAuditLog.findOne({
      userId: member._id,
      action: 'DAILY_LOG',
      'details.logId': memberLogs[0]._id,
    }).lean();

    expect(authorXp?.amount).toBe(20);
    expect(memberXp?.amount).toBe(20);

    const authorUser = await User.findById(author._id).lean();
    const memberUser = await User.findById(member._id).lean();
    expect(authorUser.exp).toBe(20);
    expect(memberUser.exp).toBe(20);
  });
});
