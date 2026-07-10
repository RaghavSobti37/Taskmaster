require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');

const SLUG_ALIASES = {
  admin: 'admin',
  administrator: 'admin',
  sales: 'sales',
  'sales rep': 'sales',
  operations: 'operations',
  ops: 'operations',
  artist_management: 'artist-management',
  'artist management': 'artist-management',
  user: null,
  editor: 'editor',
  videographer: 'videographer',
  'cg artist': 'cg-artist',
};

async function updateDepartment() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  const targetEmail = process.argv[2];
  const targetSlug = (process.argv[3] || '').toLowerCase().trim();

  if (!uri || !targetEmail || !targetSlug) {
    console.error('Usage: node setUserDepartment.js <email> <department-slug>');
    console.log('Examples: admin, sales, operations, artist-management, editor');
    process.exit(1);
  }

  const slug = SLUG_ALIASES[targetSlug] ?? targetSlug;
  await mongoose.connect(uri);

  const dept = await Department.findOne({ slug });
  if (!dept) {
    console.error(`Department slug "${slug}" not found`);
    process.exit(1);
  }

  const user = await User.findOne({ email: targetEmail.toLowerCase().trim() });
  if (!user) {
    console.error(`User ${targetEmail} not found`);
    process.exit(1);
  }

  const prev = user.departmentId;
  user.departmentId = dept._id;
  await user.save();
  console.log(`Updated ${user.name} department → ${dept.name} (was ${prev || 'none'})`);
  process.exit(0);
}

updateDepartment().catch((err) => {
  console.error(err);
  process.exit(1);
});
