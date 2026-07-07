require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const useProd = process.argv.includes('--prod') || process.env.MAIL_USE_PROD_DB === 'true';
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  await mongoose.connect(uri);
  const User = require('../models/User');
  const GamificationConfig = require('../models/GamificationConfig');
  const XPAuditLog = require('../models/XPAuditLog');
  const GamificationService = require('../services/gamificationService');

  const config = await GamificationConfig.findOne();
  const users = await User.find().select('name email exp').lean();

  console.log('DB:', useProd ? 'production' : 'local');
  console.log('Config:', {
    taskCompletion: config?.taskCompletion,
    dailyLog: config?.dailyLog,
  });

  for (const u of users) {
    const audit = await XPAuditLog.aggregate([
      { $match: { userId: u._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const auditSum = audit[0]?.total || 0;
    console.log({
      name: u.name,
      exp: u.exp || 0,
      auditSum,
      expVsAudit: (u.exp || 0) - auditSum,
    });
  }
  const snapshot = await GamificationService.getMonthlyLeaderboardSnapshot();
  console.log(`Total users: ${users.length}, monthly snapshot entries: ${(snapshot?.entries || []).length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
