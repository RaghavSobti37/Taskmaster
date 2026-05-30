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
  const users = await User.find().select('name email exp level').lean();

  console.log('DB:', useProd ? 'production' : 'local');
  console.log('Config:', {
    stepXp: config?.stepXp,
    taskCompletion: config?.taskCompletion,
    dailyLog: config?.dailyLog,
  });

  let mismatches = 0;
  for (const u of users) {
    const calcLevel = await GamificationService.getLevelFromExp(u.exp || 0);
    const audit = await XPAuditLog.aggregate([
      { $match: { userId: u._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const auditSum = audit[0]?.total || 0;
    const mismatch = calcLevel !== (u.level || 1);
    if (mismatch) mismatches++;
    console.log({
      name: u.name,
      exp: u.exp || 0,
      level: u.level || 1,
      calcLevel,
      mismatch,
      auditSum,
      expVsAudit: (u.exp || 0) - auditSum,
    });
  }
  console.log(`Total users: ${users.length}, level mismatches: ${mismatches}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
