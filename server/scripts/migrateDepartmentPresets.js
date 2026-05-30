const mongoose = require('mongoose');
const Department = require('../models/Department');

const KNOWN_PRESETS = new Set(['admin', 'operations', 'sales', 'artist-management']);

async function migrateDepartmentPresets() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const depts = await Department.find({});
  let updated = 0;
  for (const dept of depts) {
    if (dept.permissionPreset && dept.permissionPreset !== 'standard') continue;
    const preset = KNOWN_PRESETS.has(dept.slug) ? dept.slug : 'standard';
    if (dept.permissionPreset !== preset) {
      dept.permissionPreset = preset;
      await dept.save();
      updated += 1;
    }
  }
  console.log(`Migrated ${updated} department(s).`);
  await mongoose.disconnect();
}

if (require.main === module) {
  migrateDepartmentPresets().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { migrateDepartmentPresets };
