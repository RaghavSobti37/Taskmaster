require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantIntegration = require('../domains/integrations-hub/models/TenantIntegration');
const WebsiteForm = require('../domains/forms/models/WebsiteForm');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const tenants = await Tenant.find({ status: { $ne: 'suspended' } }).lean();
  let ok = true;
  for (const t of tenants) {
    const integrations = await TenantIntegration.countDocuments({ tenantId: t._id, status: 'connected' })
      .setOptions({ bypassTenant: true });
    const forms = await WebsiteForm.countDocuments({ tenantId: t._id }).setOptions({ bypassTenant: true });
    console.log(`${t.slug}: integrations=${integrations} forms=${forms}`);
    if (integrations < 5 || forms < 2) ok = false;
  }
  await mongoose.disconnect();
  process.exit(ok ? 0 : 1);
})();
