const mongoose = require('mongoose');
const Department = require('../models/Department');
const { PRESET_PAGES } = require('../utils/pagePermissions');

async function migrateDepartmentPagePermissions() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const depts = await Department.find({});
  let updated = 0;

  for (const dept of depts) {
    if (Array.isArray(dept.pagePermissions) && dept.pagePermissions.length > 0) continue;

    const preset = dept.permissionPreset || 'standard';
    const pages = PRESET_PAGES[preset] || PRESET_PAGES.standard;
    dept.pagePermissions = pages;
    await dept.save();
    updated += 1;
  }

  console.log(`Migrated pagePermissions on ${updated} department(s).`);
  await mongoose.disconnect();
}

if (require.main === module) {
  migrateDepartmentPagePermissions().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrateDepartmentPagePermissions };
