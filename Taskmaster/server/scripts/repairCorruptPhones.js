require('dotenv').config();
const mongoose = require('mongoose');

const runProd = process.argv.includes('--prod');
const runLocal = process.argv.includes('--local') || !runProd;

async function repairOn(uri, label) {
  await mongoose.connect(uri);
  const { repairCorruptLeadPhones } = require('../services/leadPhoneRepair');
  const { repairPhone, isCorruptLeadPhone } = require('../utils/sanitizer');
  const Lead = require('../models/Lead');
  const BYPASS = { bypassTenant: true };

  console.log(`\n=== Repairing leads [${label}] ===`);
  const stats = await repairCorruptLeadPhones();
  console.log(JSON.stringify(stats, null, 2));

  const remaining = await Lead.find({
    phone: { $exists: true, $ne: '' },
  }).setOptions(BYPASS).select('name phone').lean();

  const stillBad = remaining.filter((l) => isCorruptLeadPhone(l.phone));
  if (stillBad.length) {
    console.log(`\nStill corrupt (${stillBad.length}):`);
    for (const l of stillBad.slice(0, 20)) {
      console.log(`  ${l._id} | ${l.name} | ${l.phone} → ${repairPhone(l.phone)}`);
    }
  } else {
    console.log('\nAll lead phones clean.');
  }

  await mongoose.disconnect();
}

(async () => {
  if (runLocal && process.env.MONGODB_URI) {
    await repairOn(process.env.MONGODB_URI, 'LOCAL — taskmaster_local (leads page dev)');
  }
  if (runProd && process.env.MONGODB_URI_PROD) {
    await repairOn(process.env.MONGODB_URI_PROD, 'PRODUCTION');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
