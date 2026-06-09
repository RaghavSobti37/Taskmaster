/** Remove empty-string emails that break sparse unique index. */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const result = await Lead.updateMany(
    { email: '' },
    { $unset: { email: 1 } },
    { bypassTenant: true }
  );
  console.log(`Unset empty email on ${result.modifiedCount} leads`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
