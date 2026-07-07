const NewsletterSubscriber = require('../../../models/NewsletterSubscriber');
const PersonIdentityService = require('../../../services/PersonIdentityService');
const { getAdapter } = require('../adapters/adapterRegistry');
const { unpackCredentials } = require('./integrationCredentialService');
const { emitTenantEvent } = require('../../../services/enterpriseWebhook');
const { createLead, createLeadFromForm } = require('../../crm/services/leadWriteService');
const User = require('../../../models/User');
const TenantIntegration = require('../models/TenantIntegration');
const logger = require('../../../utils/logger');

async function syncMailchimp(integrationDoc, options = {}) {
  const adapter = getAdapter('mailchimp');
  const credentials = unpackCredentials(integrationDoc.credentialsEncrypted);
  const lists = await adapter.listAudiences(credentials);
  let processed = 0;
  const listId = options.listId || integrationDoc.metadata?.defaultListId || lists[0]?.id;
  if (!listId) return { processed: 0, message: 'No Mailchimp audience found' };

  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const page = await adapter.listMembers(credentials, listId, offset);
    const members = page.members || [];
    for (const member of members) {
      const email = member.email_address;
      if (!email) continue;
      const resolved = await PersonIdentityService.resolvePerson(
        { email, name: [member.merge_fields?.FNAME, member.merge_fields?.LNAME].filter(Boolean).join(' ') },
        { source: 'mailchimp' },
      );
      await NewsletterSubscriber.findOneAndUpdate(
        { tenantId: integrationDoc.tenantId, email },
        {
          $set: {
            personId: resolved.personId,
            email,
            source: 'mailchimp',
            subscribedAt: member.timestamp_signup ? new Date(member.timestamp_signup) : new Date(),
            unsubscribed: member.status !== 'subscribed',
            metadata: { mailchimpMemberId: member.id, listId },
          },
        },
        { upsert: true, new: true },
      ).setOptions({ bypassTenant: true });
      if (resolved.personId) {
        await PersonIdentityService.linkSource(
          resolved.personId,
          'mailchimp',
          member.id,
        );
      }
      processed += 1;
    }
    offset += members.length;
    hasMore = page.total_items > offset && members.length > 0;
    if (offset > 5000) break; // ponytail: cap per manual sync
  }

  integrationDoc.lastSyncAt = new Date();
  integrationDoc.metadata = {
    ...integrationDoc.metadata,
    defaultListId: listId,
    lastSyncCount: processed,
  };
  await integrationDoc.save();
  emitTenantEvent(integrationDoc.tenantId, 'integration.sync.completed', {
    provider: 'mailchimp',
    recordsProcessed: processed,
  });
  return { processed, listId };
}

async function syncHubspot(integrationDoc, options = {}) {
  const adapter = getAdapter('hubspot');
  const credentials = unpackCredentials(integrationDoc.credentialsEncrypted);
  const syncOut = integrationDoc.metadata?.syncOut === true;
  let processed = 0;
  let after = options.after;

  const systemUser = await User.findOne({ tenantId: integrationDoc.tenantId })
    .setOptions({ bypassTenant: true })
    .sort({ createdAt: 1 });

  if (!systemUser) {
    return { processed: 0, message: 'No tenant user for CRM import' };
  }

  for (let page = 0; page < 20; page += 1) {
    const data = await adapter.listContacts(credentials, after);
    const results = data.results || [];
    for (const contact of results) {
      const props = contact.properties || {};
      const email = props.email;
      const phone = props.phone;
      const name = [props.firstname, props.lastname].filter(Boolean).join(' ') || props.company || 'HubSpot Contact';
      if (!email && !phone) continue;

      await createLead(systemUser, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        source: 'HubSpot',
        leadStatus: props.lifecyclestage || 'New',
        crmType: 'standard',
      });
      processed += 1;
    }
    after = data.paging?.next?.after;
    if (!after || !results.length) break;
  }

  integrationDoc.lastSyncAt = new Date();
  integrationDoc.metadata = { ...integrationDoc.metadata, lastSyncCount: processed, syncOut };
  await integrationDoc.save();
  emitTenantEvent(integrationDoc.tenantId, 'integration.sync.completed', {
    provider: 'hubspot',
    recordsProcessed: processed,
  });
  return { processed };
}

async function pushLeadToHubspot(integrationDoc, lead) {
  if (integrationDoc.metadata?.syncOut !== true) return null;
  const adapter = getAdapter('hubspot');
  const credentials = unpackCredentials(integrationDoc.credentialsEncrypted);
  const nameParts = String(lead.name || '').trim().split(/\s+/);
  return adapter.createContact(credentials, {
    email: lead.email,
    phone: lead.phone,
    firstname: nameParts[0] || '',
    lastname: nameParts.slice(1).join(' ') || '',
    lifecyclestage: lead.leadStatus || 'lead',
  });
}

async function syncGoogleSheets(integrationDoc) {
  const adapter = getAdapter('google_sheets');
  const credentials = unpackCredentials(integrationDoc.credentialsEncrypted);
  const spreadsheetId = adapter.parseSpreadsheetId(integrationDoc.metadata?.spreadsheetId)
    || adapter.parseSpreadsheetId(integrationDoc.metadata?.spreadsheetUrl);
  const sheetName = integrationDoc.metadata?.sheetName || 'Sheet1';
  const columnMap = integrationDoc.metadata?.columnMap || {};

  if (!spreadsheetId) {
    return { processed: 0, message: 'Configure spreadsheet ID in integration settings' };
  }

  const systemUser = await User.findOne({ tenantId: integrationDoc.tenantId })
    .setOptions({ bypassTenant: true })
    .sort({ createdAt: 1 });
  if (!systemUser) {
    return { processed: 0, message: 'No tenant user for CRM import' };
  }

  const rows = await adapter.readRows(
    credentials,
    spreadsheetId,
    `'${String(sheetName).replace(/'/g, "''")}'!A:Z`,
  );
  if (!rows.length) {
    return { processed: 0, message: 'Sheet is empty' };
  }

  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const resolveCol = (key) => {
    const mapped = columnMap[key];
    if (mapped) {
      const letter = String(mapped).toUpperCase();
      const idx = letter.charCodeAt(0) - 65;
      if (idx >= 0 && idx < 26) return idx;
      const headerIdx = headers.indexOf(String(mapped).toLowerCase());
      if (headerIdx >= 0) return headerIdx;
    }
    const defaults = { name: 'name', email: 'email', phone: 'phone' };
    const headerIdx = headers.indexOf(defaults[key]);
    return headerIdx >= 0 ? headerIdx : -1;
  };

  const nameIdx = resolveCol('name');
  const emailIdx = resolveCol('email');
  const phoneIdx = resolveCol('phone');

  let processed = 0;
  for (let i = 1; i < rows.length && processed < 2000; i += 1) {
    const row = rows[i] || [];
    const email = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : '';
    const phone = phoneIdx >= 0 ? String(row[phoneIdx] || '').trim() : '';
    const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
    if (!email && !phone) continue;

    await createLeadFromForm(systemUser, {
      name: name || email || phone || 'Sheet Contact',
      email: email || undefined,
      phone: phone || undefined,
      source: 'Google Sheets',
      leadStatus: 'New',
      crmType: 'standard',
    });
    processed += 1;
  }

  integrationDoc.lastSyncAt = new Date();
  integrationDoc.metadata = {
    ...integrationDoc.metadata,
    spreadsheetId,
    sheetName,
    lastSyncCount: processed,
  };
  await integrationDoc.save();
  emitTenantEvent(integrationDoc.tenantId, 'integration.sync.completed', {
    provider: 'google_sheets',
    recordsProcessed: processed,
  });
  return { processed, spreadsheetId, sheetName };
}

async function runSync({ integrationId, tenantId }) {
  const doc = await TenantIntegration.findOne({ _id: integrationId, tenantId, status: 'connected' })
    .select('+credentialsEncrypted')
    .setOptions({ bypassTenant: true });
  if (!doc) {
    const err = new Error('Integration not found or not connected');
    err.status = 404;
    throw err;
  }
  if (doc.provider === 'mailchimp') return syncMailchimp(doc);
  if (doc.provider === 'hubspot') return syncHubspot(doc);
  if (doc.provider === 'google_sheets') return syncGoogleSheets(doc);
  const err = new Error(`Sync not supported for ${doc.provider}`);
  err.status = 400;
  throw err;
}

module.exports = {
  syncMailchimp,
  syncHubspot,
  syncGoogleSheets,
  pushLeadToHubspot,
  runSync,
};
