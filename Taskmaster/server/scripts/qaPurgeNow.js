require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const QATestRun = require('../models/QATestRun');
  await QATestRun.updateMany(
    { status: { $in: ['pending', 'in-progress'] } },
    { status: 'cancelled', completedAt: new Date() }
  );
  const { purgeQaTestData, countQaResiduals } = require('../services/qa/qaTestData');
  const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');
  const swept = await purgeQaTestData();
  const phoneRepair = await repairCorruptLeadPhones();
  console.log('purged:', JSON.stringify(swept.deleted, null, 2));
  console.log('phoneRepair:', phoneRepair);
  console.log('residuals:', await countQaResiduals());
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
