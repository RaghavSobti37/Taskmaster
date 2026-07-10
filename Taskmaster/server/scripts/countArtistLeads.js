require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const total = await Lead.countDocuments({ crmType: 'artist' }).setOptions({ bypassTenant: true });
  const byCat = await Lead.aggregate([
    { $match: { crmType: 'artist' } },
    { $group: { _id: '$contactCategory', n: { $sum: 1 } } },
  ]);
  console.log('Artist leads:', total);
  console.log(byCat);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
