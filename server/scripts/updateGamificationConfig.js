/**
 * Set production gamification defaults: dailyLog=20, taskCompletion=0.
 *
 * Usage: node scripts/updateGamificationConfig.js [--prod]
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const useProd = process.argv.includes('--prod') || process.env.MAIL_USE_PROD_DB === 'true';
  const uri = useProd
    ? process.env.MONGODB_URI_PROD || process.env.MONGODB_URI
    : process.env.MONGODB_URI;

  await mongoose.connect(uri);
  const GamificationConfig = require('../models/GamificationConfig');

  let config = await GamificationConfig.findOne();
  if (!config) config = new GamificationConfig();

  config.dailyLog = 20;
  config.taskCompletion = 0;
  await config.save();

  console.log(`Gamification config updated (${useProd ? 'production' : 'local'}):`, {
    dailyLog: config.dailyLog,
    taskCompletion: config.taskCompletion,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
