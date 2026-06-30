#!/usr/bin/env node
/**
 * Runnable self-check for monthly leaderboard utilities (no jest required).
 * Usage: node server/scripts/verifyMonthlyLeaderboard.js
 */
const assert = require('assert');
const path = require('path');

const attendanceDate = require('../utils/attendanceDate');
const GamificationService = require('../services/gamificationService');

function runAttendanceDateChecks() {
  assert.strictEqual(attendanceDate.getFirstDayOfMonthDateKey('2026-06-15'), '2026-06-01');
  assert.strictEqual(attendanceDate.getLastDayOfMonthDateKey('2026-06-15'), '2026-06-30');
  assert.strictEqual(attendanceDate.getLastDayOfMonthDateKey('2024-02-10'), '2024-02-29');

  const range = attendanceDate.getCurrentMonthRange('2026-06-15');
  assert.strictEqual(range.monthStartKey, '2026-06-01');
  assert.strictEqual(range.monthEndKey, '2026-06-30');
  assert.ok(range.monthStart < range.monthEnd);

  const prev = attendanceDate.getPreviousMonthRange();
  const current = attendanceDate.getCurrentMonthRange();
  assert.ok(prev.monthEndKey < current.monthStartKey);
}

function runCalculationSummaryChecks() {
  const groups = [
    {
      action: 'LEAD_CAPTURE',
      actionLabel: 'Lead capture',
      count: 2,
      amountPerAction: 50,
      totalXp: 100,
      timeBased: false,
      calculationLine: '2 × 50 XP',
    },
    {
      action: 'COMPLETE_TASK',
      actionLabel: 'Task completion',
      count: 1,
      amountPerAction: 30,
      totalXp: 30,
      timeBased: true,
      ratePerHour: 10,
      avgHours: 3,
      calculationLine: '1 × 3h avg × 10 XP/h',
    },
  ];
  const summary = GamificationService.buildCalculationSummary(groups, 130);
  assert.strictEqual(summary.lines.length, 2);
  assert.strictEqual(summary.subtotalSum, 130);
  assert.strictEqual(summary.totalXp, 130);
  assert.strictEqual(summary.verified, true);
}

async function runMonthlyLeaderboardCheck() {
  const mongoose = require('mongoose');
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const XPAuditLog = require('../models/XPAuditLog');
  const GamificationConfig = require('../models/GamificationConfig');

  const mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  try {
    const userId = new mongoose.Types.ObjectId();
    await GamificationConfig.create({ taskCompletion: 10 });
    const { monthStart } = attendanceDate.getCurrentMonthRange();

    await XPAuditLog.create({
      userId,
      action: 'COMPLETE_TASK',
      amount: 5,
      details: { hours: 3 },
      createdAt: monthStart,
    });

    const monthly = await GamificationService.getMonthlyLeaderboard(10);
    assert.deepStrictEqual(monthly.entries, [[String(userId), 30]]);
    assert.strictEqual(monthly.resolvedSum, 30);
    assert.strictEqual(monthly.storedSum, 5);
  } finally {
    await mongoose.disconnect();
    await mongoServer.stop();
  }
}

async function main() {
  runAttendanceDateChecks();
  console.log('PASS attendanceDate month ranges');
  runCalculationSummaryChecks();
  console.log('PASS buildCalculationSummary');
  await runMonthlyLeaderboardCheck();
  console.log('PASS getMonthlyLeaderboard');
  console.log('All monthly leaderboard checks passed.');
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
