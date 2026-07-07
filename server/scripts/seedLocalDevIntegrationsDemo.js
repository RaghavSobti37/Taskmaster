#!/usr/bin/env node
/**
 * Seed demo Connected Apps + Website Forms for local UI review.
 * Safe for taskmaster_local only — dummy credentials, no external API calls.
 *
 * Usage:
 *   node server/scripts/seedLocalDevIntegrationsDemo.js
 *   node server/scripts/seedLocalDevIntegrationsDemo.js --slug=tsc
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const crypto = require('crypto');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const TenantIntegration = require('../domains/integrations-hub/models/TenantIntegration');
const WebsiteForm = require('../domains/forms/models/WebsiteForm');
const { INTEGRATION_PROVIDERS } = require('../config/integrationProviders.config');
const { packCredentials } = require('../domains/integrations-hub/services/integrationCredentialService');
const webhookInAdapter = require('../domains/integrations-hub/adapters/webhookInAdapter');

const BYPASS = { bypassTenant: true };
const slugArg = process.argv.find((a) => a.startsWith('--slug='));
const tenantSlug = (slugArg ? slugArg.split('=')[1] : process.env.PLATFORM_TENANT_SLUG || 'tsc').trim();

function assertLocalDb(uri) {
  const dbName = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || '';
  if (!dbName.includes('local') && !dbName.includes('staging')) {
    console.error(`Refusing seed: database "${dbName || '(default)'}" is not a local/staging DB`);
    process.exit(1);
  }
}

function demoCredentials(providerId, tenant, integrationId) {
  switch (providerId) {
    case 'gmail':
      return {
        accessToken: 'demo_gmail_access',
        refreshToken: 'demo_gmail_refresh',
        expiresAt: Date.now() + 86400000,
        email: 'demo@example.com',
        accountId: 'demo@example.com',
      };
    case 'resend':
      return { apiKey: 're_demo_local_only', accountId: 'resend-demo' };
    case 'google_sheets':
      return {
        accessToken: 'demo_sheets_access',
        refreshToken: 'demo_sheets_refresh',
        expiresAt: Date.now() + 86400000,
        email: 'demo@example.com',
        accountId: 'demo@example.com',
      };
    case 'aisensy':
      return {
        apiKey: 'aisensy_demo_local_only',
        accountId: 'aisensy',
        webhookVerifyToken: crypto.randomBytes(16).toString('hex'),
        webhookSecret: crypto.randomBytes(24).toString('base64url'),
      };
    case 'webhook_in': {
      const { secret, prefix } = webhookInAdapter.generateWebhookSecret();
      return { webhookSecret: secret, secretPrefix: prefix };
    }
    default:
      return { demo: true, accountId: providerId };
  }
}

function demoMetadata(providerId, tenant, integrationId, credentials) {
  const slug = tenant.slug || String(tenant._id);
  const base = process.env.PUBLIC_API_BASE_URL || 'http://localhost:5000';
  switch (providerId) {
    case 'gmail':
      return { accountEmail: 'demo@example.com', demo: true };
    case 'resend':
      return { fromEmail: 'hello@demo.local', demo: true };
    case 'google_sheets':
      return {
        demo: true,
        spreadsheetId: '1DEMO_SPREADSHEET_ID',
        spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1DEMO_SPREADSHEET_ID/edit',
        sheetName: 'Contacts',
        columnMap: { name: 'Name', email: 'Email', phone: 'Phone' },
        lastImportedCount: 12,
      };
    case 'aisensy':
      return {
        demo: true,
        defaultCampaignName: 'welcome_message',
        webhookUrl: `${base}/api/webhooks/aisensy`,
      };
    case 'webhook_in':
      return {
        inboundPath: `/api/integrations/webhooks/inbound/${slug}/${integrationId}`,
        secretPrefix: credentials.secretPrefix,
        demo: true,
      };
    default:
      return { demo: true };
  }
}

function demoLabel(providerId) {
  const labels = {
    gmail: 'Gmail — demo@example.com',
    resend: 'Resend — demo workspace',
    google_sheets: 'Leads Import Sheet',
    webhook_in: 'Inbound Webhook (demo)',
    aisensy: 'AiSensy — demo',
  };
  return labels[providerId] || 'Demo connection';
}

async function upsertIntegration(tenant, providerConfig, userId) {
  const integrationId = new mongoose.Types.ObjectId();
  const credentials = demoCredentials(providerConfig.id, tenant, integrationId);
  const metadata = demoMetadata(providerConfig.id, tenant, integrationId, credentials);
  const filter = {
    tenantId: tenant._id,
    provider: providerConfig.id,
    externalAccountId: credentials.accountId || String(integrationId),
  };
  const existing = await TenantIntegration.findOne(filter).setOptions(BYPASS);
  const doc = await TenantIntegration.findOneAndUpdate(
    filter,
    {
      $setOnInsert: { _id: integrationId },
      $set: {
        tenantId: tenant._id,
        provider: providerConfig.id,
        category: providerConfig.category,
        label: demoLabel(providerConfig.id),
        status: 'connected',
        authType: providerConfig.authType,
        credentialsEncrypted: packCredentials(credentials),
        externalAccountId: credentials.accountId || String(integrationId),
        capabilities: providerConfig.capabilities,
        metadata,
        lastSyncAt: providerConfig.id === 'google_sheets' ? new Date() : undefined,
        createdBy: userId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).setOptions(BYPASS);
  return { doc, created: !existing };
}

async function upsertWebsiteForms(tenant, userId) {
  const demos = [
    {
      name: 'Homepage Contact',
      slug: 'homepage-contact',
      allowedOrigins: ['http://localhost:5173', 'https://theshakticollective.in'],
      defaults: { source: 'Website Form', leadStatus: 'New', crmType: 'sales' },
    },
    {
      name: 'Landing Page Lead',
      slug: 'landing-lead',
      allowedOrigins: ['http://localhost:3000'],
      defaults: { source: 'Landing Page', leadStatus: 'New', crmType: 'standard' },
    },
  ];

  const results = [];
  for (const demo of demos) {
    const existing = await WebsiteForm.findOne({ tenantId: tenant._id, slug: demo.slug }).setOptions(BYPASS);
    const publishableKey = existing?.publishableKey || `ckf_live_${crypto.randomBytes(24).toString('base64url')}`;
    const keyPrefix = existing?.keyPrefix || publishableKey.slice(0, 16);
    const doc = await WebsiteForm.findOneAndUpdate(
      { tenantId: tenant._id, slug: demo.slug },
      {
        $set: {
          tenantId: tenant._id,
          name: demo.name,
          slug: demo.slug,
          publishableKey,
          keyPrefix,
          allowedOrigins: demo.allowedOrigins,
          defaults: demo.defaults,
          status: 'active',
          metadata: { demo: true },
          createdBy: userId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).setOptions(BYPASS);
    results.push({ slug: demo.slug, created: !existing, key: doc.publishableKey });
  }
  return results;
}

async function main() {
  const uri = process.env.MONGODB_URI || '';
  if (!uri) {
    console.error('MONGODB_URI missing in server/.env');
    process.exit(1);
  }
  assertLocalDb(uri);

  await mongoose.connect(uri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Connected: ${dbName}`);

  const User = require('../models/User');
  let tenants = await Tenant.find({ status: { $ne: 'suspended' } }).setOptions(BYPASS);
  if (slugArg) {
    const one = await Tenant.findOne({ slug: tenantSlug }).setOptions(BYPASS);
    tenants = one ? [one] : [];
  }
  if (!tenants.length) {
    console.error('No tenant found. Run sync:prod-tenant-tsc or seed a tenant first.');
    process.exit(1);
  }

  for (const tenant of tenants) {
    const admin = await User.findOne({ tenantId: tenant._id, role: { $in: ['admin', 'owner', 'org_admin'] } })
      .setOptions(BYPASS)
      || await User.findOne({ tenantId: tenant._id }).setOptions(BYPASS);
    const userId = admin?._id;

    if (tenant.plan !== 'enterprise' && tenant.plan !== 'pro') {
      tenant.plan = 'pro';
      tenant.featureUnlocks = tenant.featureUnlocks || {};
      Object.assign(tenant.featureUnlocks, {
        resend: true,
        google: true,
        meta: true,
        finance: true,
        integrations: true,
      });
      await tenant.save();
      console.log(`Bumped tenant plan → pro (${tenant.slug || tenant._id})`);
    }

    console.log(`\nSeeding demo data for tenant: ${tenant.name} (${tenant.slug || tenant._id})`);

    for (const providerConfig of INTEGRATION_PROVIDERS) {
      const { doc, created } = await upsertIntegration(tenant, providerConfig, userId);
      console.log(`  ${created ? '+' : '~'} ${providerConfig.id} → ${doc._id}`);
    }

    const forms = await upsertWebsiteForms(tenant, userId);
    for (const f of forms) {
      console.log(`  ${f.created ? '+' : '~'} form:${f.slug} key=${f.key.slice(0, 20)}…`);
    }
  }

  console.log('\nDone. Open:');
  console.log('  http://localhost:5173/settings?tab=integrations');
  console.log('  http://localhost:5173/settings/developers');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
