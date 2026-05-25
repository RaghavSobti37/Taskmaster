const Tenant = require('../models/Tenant');
const TenantConfig = require('../models/TenantConfig');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

/**
 * Provisions a new tenant with default configurations and roles.
 * Can be triggered via Cloud Function webhook after Identity Platform signup.
 * 
 * @param {Object} tenantData - Details of the new company/tenant
 * @returns {Object} provisioned tenant and config
 */
async function provisionNewTenant(tenantData) {
  try {
    // 1. Create Tenant
    const tenant = new Tenant({
      name: tenantData.companyName,
      contactEmail: tenantData.email,
      domain: tenantData.domain || null,
      status: 'active'
    });
    await tenant.save();

    // 2. Initialize Default Module Registry (Config)
    const config = new TenantConfig({
      tenantId: tenant._id,
      features: {
        leads: true,
        tasks: true,
        campaigns: false, // Premium feature disabled by default
        analytics: true
      }
    });
    await config.save();

    // 3. Initialize Default Roles
    const adminRole = new Role({
      tenantId: tenant._id,
      name: 'Admin',
      permissions: [] // In real scenario, fetch all permission IDs and assign
    });
    await adminRole.save();

    const memberRole = new Role({
      tenantId: tenant._id,
      name: 'Member',
      permissions: [] // In real scenario, fetch basic permission IDs
    });
    await memberRole.save();

    return { tenant, config, roles: [adminRole, memberRole] };
  } catch (error) {
    console.error('Tenant Provisioning Error:', error);
    throw error;
  }
}

module.exports = {
  provisionNewTenant
};
