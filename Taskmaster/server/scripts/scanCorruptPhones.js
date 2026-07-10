require('dotenv').config();
const mongoose = require('mongoose');
const useProd = process.argv.includes('--prod');
const uri = useProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI;

(async () => {
  await mongoose.connect(uri);
  const Lead = require('../models/Lead');
  const Contact = require('../models/Contact');
  const { repairPhone, isValidPhone, isCorruptLeadPhone } = require('../utils/sanitizer');
  const BYPASS = { bypassTenant: true };

  const matching = await Lead.find({
    $or: [
      { phone: { $regex: '8591499393' } },
      { phone: { $regex: '60809296289249' } },
    ],
  }).setOptions(BYPASS).lean();

  console.log('=== Leads matching 8591499393 ===');
  for (const l of matching) {
    const digits = String(l.phone || '').replace(/\D/g, '');
    console.log(JSON.stringify({
      _id: l._id,
      name: l.name,
      email: l.email,
      phone: l.phone,
      digitCount: digits.length,
      repaired: repairPhone(l.phone),
      isCorrupt: isCorruptLeadPhone(l.phone),
      isValid: isValidPhone(repairPhone(l.phone)),
    }));
  }

  const all = await Lead.find({ phone: { $regex: /^\+[0-9]{16,}/ } }).setOptions(BYPASS).lean();
  console.log('\n=== All overlong phones (16+ digits after +) ===', all.length);
  for (const l of all) {
    const digits = String(l.phone || '').replace(/\D/g, '');
    console.log(JSON.stringify({
      _id: l._id,
      name: l.name,
      phone: l.phone,
      digitCount: digits.length,
      repaired: repairPhone(l.phone),
      isCorrupt: isCorruptLeadPhone(l.phone),
    }));
  }

  const contacts = await Contact.find({ phone: { $regex: '8591499393' } }).setOptions(BYPASS).lean();
  console.log('\n=== Contacts matching ===', contacts.length);
  for (const c of contacts) {
    console.log(JSON.stringify({ _id: c._id, name: c.name, phone: c.phone, email: c.email }));
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
