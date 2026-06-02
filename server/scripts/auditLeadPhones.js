require('dotenv').config();
const mongoose = require('mongoose');
const useProd = process.argv.includes('--prod');
const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;
const { repairPhone, isValidPhone, phoneDigitCount } = require('../utils/sanitizer');
const BYPASS = { bypassTenant: true };

(async () => {
  await mongoose.connect(uri);
  const Lead = require('../models/Lead');
  const all = await Lead.find({ phone: { $exists: true, $ne: '' } }).setOptions(BYPASS).select('name email phone').lean();

  const mismatched = [];
  const over10 = [];
  for (const l of all) {
    const stored = String(l.phone);
    const repaired = repairPhone(stored);
    const digits = phoneDigitCount(stored);
    if (repaired !== stored && isValidPhone(repaired)) {
      mismatched.push({ _id: l._id, name: l.name, phone: stored, repaired, digits });
    }
    if (digits > 12) {
      over10.push({ _id: l._id, name: l.name, phone: stored, repaired, digits });
    }
  }

  console.log(`[${useProd ? 'PROD' : 'LOCAL'}] stored !== repaired: ${mismatched.length}`);
  console.log(JSON.stringify(mismatched.slice(0, 20), null, 2));
  console.log(`\nDigit count > 12: ${over10.length}`);
  console.log(JSON.stringify(over10.slice(0, 20), null, 2));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
