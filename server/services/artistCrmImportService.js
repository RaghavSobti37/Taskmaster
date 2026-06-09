const fs = require('fs');
const csv = require('csv-parser');
const Lead = require('../models/Lead');
const CRMImport = require('../models/CRMImport');
const User = require('../models/User');
const Department = require('../models/Department');
const ContactService = require('./ContactService');
const { detectSheetTemplate } = require('../../shared/artistCrmSheetMappings');
const { CRM_TYPES, categoryToTagSlug } = require('../../shared/artistCrmTaxonomy');
const {
  parseContactField,
  extractEmails,
  isPlaceholder,
  syntheticArtistPhone,
  resolveEmailStatus,
} = require('../utils/artistContactFieldParser');
const { normalizePersonRecord, applyPersonIdentityToDoc } = require('../utils/personNormalization');
const { assignLeadToArtistRep } = require('../utils/crmAssignment');
const logger = require('../utils/logger');

const ARTIST_SLUG = 'artist-management';

function pickRow(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function buildImportRowKey(sheetId, rowIndex) {
  return `${sheetId}:${rowIndex}`;
}

function mapRowToLead(row, template, rowIndex) {
  const importRowKey = buildImportRowKey(template.id, rowIndex);
  const base = {
    crmType: CRM_TYPES.ARTIST,
    artistProject: template.artistProject || undefined,
    contactCategory: template.contactCategory,
    source: `Artist CSV: ${template.label}`,
    leadStatus: 'New',
    callStatus: 'Pending',
    meaningfulConnect: 'PENDING',
    tags: [...(template.tags || [])],
    metadata: { importRowKey, sheetTemplate: template.id },
  };

  switch (template.type) {
    case 'yugm_media': {
      const contactRaw = pickRow(row, 'Contact Information');
      const parsed = parseContactField(contactRaw);
      const name = pickRow(row, 'Journalist / Contact Name', 'Journalist/Contact Name') || pickRow(row, 'Publication Name');
      return {
        ...base,
        name,
        email: parsed.email,
        phone: parsed.phone,
        city: pickRow(row, 'City / Region', 'City/Region'),
        primaryRole: pickRow(row, 'Designation / Beat', 'Designation/Beat'),
        metadata: {
          ...base.metadata,
          publication: pickRow(row, 'Publication Name'),
          rawContact: parsed.rawContact || contactRaw,
        },
      };
    }
    case 'hd_pune_media': {
      const emailRaw = pickRow(row, 'Direct Contact Email');
      const emails = extractEmails(emailRaw);
      const phoneRaw = pickRow(row, 'Contact Phone / Board', 'Contact Phone/Board');
      const parsed = parseContactField(`${phoneRaw} ${emailRaw}`);
      const name = pickRow(row, 'Target Journalist / Editor', 'Target Journalist/Editor')
        || pickRow(row, 'Publication Name');
      return {
        ...base,
        name,
        email: emails[0] || parsed.email,
        phone: parsed.phone,
        primaryRole: pickRow(row, 'Designation'),
        metadata: {
          ...base.metadata,
          publication: pickRow(row, 'Publication Name'),
          mediaFormat: pickRow(row, 'Media Format'),
          pitchVector: pickRow(row, 'Primary Strategic Pitch Vector'),
        },
      };
    }
    case 'hd_nashik_media': {
      const contactRaw = pickRow(row, 'Contact Information & Address');
      const parsed = parseContactField(contactRaw);
      const org = pickRow(row, 'Organization');
      const person = pickRow(row, 'Contact Person & Designation');
      return {
        ...base,
        name: person || org,
        email: parsed.email,
        phone: parsed.phone,
        metadata: {
          ...base.metadata,
          organization: org,
          contactPerson: person,
          mediaType: pickRow(row, 'Media Type'),
          address: contactRaw,
        },
      };
    }
    case 'hd_events': {
      const contactRaw = pickRow(row, 'contact', 'Contact');
      const parsed = parseContactField(contactRaw);
      const eventName = pickRow(row, 'Marathi event', 'Marathi Event');
      const category = pickRow(row, 'Category');
      if (category) base.tags.push(categoryToTagSlug(category));
      return {
        ...base,
        name: eventName,
        email: parsed.email,
        phone: parsed.phone,
        metadata: {
          ...base.metadata,
          address: pickRow(row, 'Address'),
          eventCategory: category,
          rawContact: contactRaw,
        },
      };
    }
    case 'hd_warkari': {
      const contactRaw = pickRow(row, 'contact', 'Contact');
      const parsed = parseContactField(contactRaw);
      const name = pickRow(row, 'Name');
      const keys = Object.keys(row);
      const detail = keys[2] && row[keys[2]] ? String(row[keys[2]]).trim() : '';
      const extras = keys.slice(3).map((k) => row[k]).filter((v) => v && !isPlaceholder(v));
      return {
        ...base,
        name,
        email: parsed.email,
        phone: parsed.phone,
        city: pickRow(row, 'City'),
        metadata: {
          ...base.metadata,
          detail,
          extras,
          rawContact: contactRaw,
        },
      };
    }
    case 'event_database': {
      const category = pickRow(row, 'Category');
      if (category) base.tags.push(categoryToTagSlug(category));
      const email = pickRow(row, 'Email');
      const phoneRaw = pickRow(row, 'Phone');
      const parsed = parseContactField(`${phoneRaw} ${email}`);
      return {
        ...base,
        name: pickRow(row, 'Name'),
        email: parsed.email || extractEmails(email)[0] || '',
        phone: parsed.phone || phoneRaw,
        city: pickRow(row, 'City'),
        metadata: {
          ...base.metadata,
          state: pickRow(row, 'State'),
          services: pickRow(row, 'What they can give (Services)', 'What they can give'),
          website: pickRow(row, 'Website / Portfolio', 'Website/Portfolio'),
          socialMedia: pickRow(row, 'Social Media'),
          wordOfMouth: pickRow(row, 'word of mouth', 'Word of mouth'),
          eventCategory: category,
        },
      };
    }
    default:
      return null;
  }
}

function isEmptyCsvRow(row) {
  return !Object.values(row || {}).some((v) => v != null && String(v).trim() !== '');
}

function deriveImportName(raw) {
  const md = raw.metadata || {};
  const candidates = [
    raw.name,
    md.publication,
    md.organization,
    md.contactPerson,
    md.detail,
    md.address,
    md.rawContact,
  ];
  for (const c of candidates) {
    if (c && String(c).trim() && !isPlaceholder(c)) {
      return String(c).trim();
    }
  }
  if (md.importRowKey) return `Import ${md.importRowKey}`;
  return 'Imported contact';
}

/** Every CSV row gets a stable name + phone (email optional). */
function coerceArtistImportIdentity(raw) {
  const importRowKey = raw.metadata?.importRowKey;
  const name = deriveImportName(raw);

  let email = raw.email || '';
  if (email && (isPlaceholder(email) || !String(email).includes('@'))) {
    email = extractEmails(email)[0] || '';
  }

  let phone = raw.phone || '';
  let usedSyntheticPhone = false;
  if (phone) {
    const check = require('../utils/phoneCountryValidation').validatePhoneE164(phone);
    if (check.valid) phone = check.phone;
    else {
      phone = syntheticArtistPhone(importRowKey || name);
      usedSyntheticPhone = true;
    }
  } else {
    phone = syntheticArtistPhone(importRowKey || name);
    usedSyntheticPhone = true;
  }

  const coerced = {
    ...raw,
    name,
    phone,
    metadata: {
      ...(raw.metadata || {}),
      ...(usedSyntheticPhone ? { importSyntheticPhone: true } : {}),
    },
  };
  if (email) coerced.email = email;
  else delete coerced.email;
  return coerced;
}

function stripEmptyEmail(doc) {
  if (doc && ('email' in doc) && (doc.email == null || !String(doc.email).trim())) {
    delete doc.email;
  }
  return doc;
}

async function finalizeLeadDoc(raw, { userId, importId, repIndex, reps, defaultAssigneeId }) {
  const prepared = coerceArtistImportIdentity(raw || {});

  const normalized = normalizePersonRecord(
    { name: prepared.name, email: prepared.email, phone: prepared.phone, city: prepared.city },
    { requireName: true, requirePhone: false, tryRepairPhone: true }
  );

  const name = normalized.name || prepared.name;
  if (!name) return { skipped: true, reason: 'missing_name' };

  let phone = normalized.phone || prepared.phone;
  if (!phone) {
    phone = syntheticArtistPhone(prepared.metadata?.importRowKey || name);
  }

  const doc = stripEmptyEmail({
    ...prepared,
    name,
    phone,
    city: normalized.city || prepared.city,
    emailStatus: resolveEmailStatus(normalized.email || prepared.email),
    importId,
    createdBy: userId,
  });
  if (normalized.email) doc.email = normalized.email;

  if (!doc.assignedRepId) {
    if (defaultAssigneeId) {
      doc.assignedRepId = defaultAssigneeId;
    } else if (reps?.length) {
      doc.assignedRepId = reps[repIndex % reps.length]._id;
    } else {
      doc.assignedRepId = await assignLeadToArtistRep();
    }
  }

  return { doc, skipped: false };
}

/** Sync prep for bulk import — no per-row DB calls. */
function prepareArtistImportDoc(raw, { userId, importId, tenantId, defaultAssigneeId, reps, repIndex }) {
  const prepared = coerceArtistImportIdentity(raw || {});

  const normalized = normalizePersonRecord(
    { name: prepared.name, email: prepared.email, phone: prepared.phone, city: prepared.city },
    { requireName: true, requirePhone: false, tryRepairPhone: true }
  );

  const name = normalized.name || prepared.name;
  if (!name) return { skipped: true, reason: 'missing_name' };

  let phone = normalized.phone || prepared.phone;
  if (!phone) {
    phone = syntheticArtistPhone(prepared.metadata?.importRowKey || name);
  }

  const doc = stripEmptyEmail({
    ...prepared,
    name,
    phone,
    city: normalized.city || prepared.city,
    emailStatus: resolveEmailStatus(normalized.email || prepared.email),
    importId,
    createdBy: userId,
    tenantId,
  });
  if (normalized.email) doc.email = normalized.email;

  if (!doc.assignedRepId) {
    if (defaultAssigneeId) doc.assignedRepId = defaultAssigneeId;
    else if (reps?.length) doc.assignedRepId = reps[repIndex % reps.length]._id;
  }

  applyPersonIdentityToDoc(doc, { phoneRequired: false });
  if (doc.leadStatus) {
    const { canonicalLeadStatus } = require('../utils/crmPipelineFilters');
    doc.leadStatus = canonicalLeadStatus(doc.leadStatus);
  }
  return { doc, skipped: false };
}

function resolveImportDocUniqueness(doc, registry) {
  const key = doc.metadata?.importRowKey;
  if (!key) return { doc, skipped: true, reason: 'missing_import_row_key' };

  let phone = doc.phone;
  if (phone && registry.phones.has(phone) && registry.phoneOwner.get(phone) !== key) {
    doc.metadata = {
      ...(doc.metadata || {}),
      originalPhone: phone,
      importSyntheticPhone: true,
    };
    phone = syntheticArtistPhone(key);
    doc.phone = phone;
  }

  let email = doc.email;
  if (email && registry.emails.has(email) && registry.emailOwner.get(email) !== key) {
    doc.metadata = { ...(doc.metadata || {}), duplicateEmailOmitted: true };
    delete doc.email;
    email = undefined;
  }

  if (phone) {
    registry.phones.add(phone);
    registry.phoneOwner.set(phone, key);
  }
  if (email) {
    registry.emails.add(email);
    registry.emailOwner.set(email, key);
  }

  stripEmptyEmail(doc);
  return { doc, skipped: false };
}

async function loadBulkImportRegistry() {
  const Tenant = require('../models/Tenant');
  let tenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions({ bypassTenant: true });
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'admin@theshakticollective.in',
    });
  }

  const artistDept = await Department.findOne({ slug: ARTIST_SLUG }).setOptions({ bypassTenant: true });
  const reps = artistDept
    ? await User.find({ departmentId: artistDept._id }).setOptions({ bypassTenant: true }).lean()
    : [];
  const defaultAssigneeId = await assignLeadToArtistRep();

  const existing = await Lead.find({ crmType: CRM_TYPES.ARTIST })
    .select('metadata.importRowKey phone email')
    .setOptions({ bypassTenant: true })
    .lean();

  const phones = new Set();
  const emails = new Set();
  const phoneOwner = new Map();
  const emailOwner = new Map();
  const importRowKeys = new Set();

  for (const row of existing) {
    const rowKey = row.metadata?.importRowKey;
    if (rowKey) importRowKeys.add(rowKey);
    if (row.phone) {
      phones.add(row.phone);
      phoneOwner.set(row.phone, rowKey || row._id.toString());
    }
    if (row.email) {
      emails.add(row.email);
      emailOwner.set(row.email, rowKey || row._id.toString());
    }
  }

  return {
    tenantId: tenant._id,
    reps,
    defaultAssigneeId,
    phones,
    emails,
    phoneOwner,
    emailOwner,
    importRowKeys,
  };
}

const BULK_WRITE_CHUNK = 1000;

async function executeBulkLeadUpsert(docs) {
  if (!docs.length) return { upserted: 0, modified: 0, failed: 0 };

  const now = new Date();
  let upserted = 0;
  let modified = 0;
  let failed = 0;

  for (let i = 0; i < docs.length; i += BULK_WRITE_CHUNK) {
    const slice = docs.slice(i, i + BULK_WRITE_CHUNK);
    const ops = slice.map((doc) => {
      const payload = { ...doc };
      delete payload._id;
      delete payload.createdAt;
      delete payload.updatedAt;
      return {
        updateOne: {
          filter: {
            tenantId: payload.tenantId,
            crmType: CRM_TYPES.ARTIST,
            'metadata.importRowKey': payload.metadata.importRowKey,
          },
          update: {
            $set: { ...payload, updatedAt: now },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      };
    });

    try {
      const result = await Lead.collection.bulkWrite(ops, { ordered: false });
      upserted += result.upsertedCount || 0;
      modified += result.modifiedCount || 0;
      failed += (result.getWriteErrors?.() || []).length;
    } catch (err) {
      if (err.code === 11000 || err.name === 'MongoBulkWriteError') {
        const writeErrors = err.writeErrors || [];
        failed += writeErrors.length;
        upserted += err.result?.nUpserted || err.result?.upsertedCount || 0;
        modified += err.result?.nModified || err.result?.modifiedCount || 0;
        logger.warn('artistCrmBulk', `Chunk ${i / BULK_WRITE_CHUNK + 1}: ${writeErrors.length} write errors (dup keys)`);
      } else {
        throw err;
      }
    }
  }

  return { upserted, modified, failed };
}

async function bulkImportArtistCsvFiles({ files, userId, skipContacts = true }) {
  const registry = await loadBulkImportRegistry();
  const importSession = await CRMImport.create({
    filename: files.map((f) => f.filename).join('; '),
    leadCount: 0,
    crmType: CRM_TYPES.ARTIST,
    sheetTemplate: 'bulk',
    createdBy: userId,
  });

  const preparedDocs = [];
  let skipped = 0;
  let repIndex = 0;
  const fileStats = [];

  for (const { filePath, filename } of files) {
    const template = detectSheetTemplate(filename);
    if (!template) {
      throw new Error(`Unknown artist CSV template for file: ${filename}`);
    }

    const rows = await readCsvRows(filePath);
    let fileImported = 0;
    let fileSkipped = 0;

    for (let i = 0; i < rows.length; i++) {
      if (isEmptyCsvRow(rows[i])) {
        fileSkipped++;
        continue;
      }
      const mapped = mapRowToLead(rows[i], template, i + 2);
      if (!mapped) {
        fileSkipped++;
        continue;
      }
      mapped.importId = importSession._id;

      const result = prepareArtistImportDoc(mapped, {
        userId,
        importId: importSession._id,
        tenantId: registry.tenantId,
        defaultAssigneeId: registry.defaultAssigneeId,
        reps: registry.reps,
        repIndex,
      });
      if (result.skipped) {
        fileSkipped++;
        continue;
      }
      if (registry.reps.length) repIndex++;

      const unique = resolveImportDocUniqueness(result.doc, registry);
      if (unique.skipped) {
        fileSkipped++;
        continue;
      }
      preparedDocs.push(unique.doc);
      fileImported++;
    }

    fileStats.push({
      filename,
      template: template.label,
      totalRows: rows.length,
      imported: fileImported,
      skipped: fileSkipped,
    });
    skipped += fileSkipped;
  }

  logger.info('artistCrmBulk', `Prepared ${preparedDocs.length} docs — bulkWrite starting`);
  const bulkResult = await executeBulkLeadUpsert(preparedDocs);

  importSession.leadCount = preparedDocs.length;
  await importSession.save();

  if (skipContacts) {
    logger.info('artistCrmBulk', 'Contact hub sync deferred — run reconcileDataHub if needed');
  }

  return {
    importId: importSession._id,
    files: fileStats,
    prepared: preparedDocs.length,
    skipped,
    ...bulkResult,
  };
}

async function findExistingLead(doc) {
  if (!doc.metadata?.importRowKey) return null;
  return Lead.findOne({
    crmType: CRM_TYPES.ARTIST,
    'metadata.importRowKey': doc.metadata.importRowKey,
  }).setOptions({ bypassTenant: true });
}

function isDuplicateKeyError(err) {
  return err?.code === 11000 || String(err?.message || '').includes('E11000 duplicate key');
}

async function saveArtistLead(existing, clean) {
  if (!clean.email) existing.email = undefined;
  try {
    await existing.save();
  } catch (saveErr) {
    if (isDuplicateKeyError(saveErr) && String(saveErr.message).includes('phone')) {
      existing.phone = syntheticArtistPhone(clean.metadata?.importRowKey || clean.name);
      existing.metadata = {
        ...(existing.metadata || {}),
        importSyntheticPhone: true,
        ...(clean.phone ? { originalPhone: clean.phone } : {}),
      };
      await existing.save();
      return;
    }
    if (isDuplicateKeyError(saveErr) && String(saveErr.message).includes('email')) {
      existing.email = undefined;
      await existing.save();
      return;
    }
    throw saveErr;
  }
}

async function createArtistLead(doc) {
  const base = stripEmptyEmail({
    ...doc,
    metadata: { ...(doc.metadata || {}) },
  });

  const attempts = [
    () => ({ ...base }),
    () => {
      const d = { ...base, metadata: { ...base.metadata } };
      if (d.phone) d.metadata.originalPhone = d.phone;
      d.phone = syntheticArtistPhone(d.metadata.importRowKey || d.name);
      d.metadata.importSyntheticPhone = true;
      return stripEmptyEmail(d);
    },
    () => {
      const d = { ...base, metadata: { ...base.metadata } };
      delete d.email;
      d.metadata.duplicateEmailOmitted = true;
      return stripEmptyEmail(d);
    },
    () => {
      const d = { ...base, metadata: { ...base.metadata } };
      delete d.email;
      d.metadata.duplicateEmailOmitted = true;
      d.metadata.originalPhone = d.metadata.originalPhone || base.phone;
      d.phone = syntheticArtistPhone(d.metadata.importRowKey || d.name);
      d.metadata.importSyntheticPhone = true;
      return stripEmptyEmail(d);
    },
  ];

  let lastErr;
  for (const build of attempts) {
    try {
      return await Lead.create(build());
    } catch (err) {
      lastErr = err;
      if (!isDuplicateKeyError(err)) throw err;
    }
  }
  throw lastErr;
}

async function upsertArtistLead(doc) {
  const clean = stripEmptyEmail({ ...doc });
  const existing = await findExistingLead(clean);
  if (existing) {
    const patch = { ...clean };
    delete patch._id;
    if (existing.tags?.length) {
      patch.tags = [...new Set([...(existing.tags || []), ...(clean.tags || [])])];
    }
    Object.assign(existing, patch);
    await saveArtistLead(existing, clean);
    return { lead: existing, action: 'update' };
  }

  const lead = await createArtistLead(clean);
  return { lead, action: 'create' };
}

async function syncArtistCrmContact(lead) {
  await ContactService.mergeContact({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    city: lead.city,
    recordId: lead._id,
    emailStatus: lead.emailStatus,
    summary: {
      artistProject: lead.artistProject,
      contactCategory: lead.contactCategory,
      source: lead.source,
      tags: lead.tags,
    },
    inletKey: 'artist_crm',
  }, 'artist_crm').catch(() => {});
}

function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function importArtistCsvFile({ filePath, filename, userId }) {
  const template = detectSheetTemplate(filename);
  if (!template) {
    throw new Error(`Unknown artist CSV template for file: ${filename}`);
  }

  const artistDept = await Department.findOne({ slug: ARTIST_SLUG });
  const reps = artistDept
    ? await User.find({ departmentId: artistDept._id })
    : [];
  const defaultAssigneeId = await assignLeadToArtistRep();

  const importSession = await CRMImport.create({
    filename,
    leadCount: 0,
    crmType: CRM_TYPES.ARTIST,
    sheetTemplate: template.id,
    createdBy: userId,
  });

  const rows = await readCsvRows(filePath);
  let imported = 0;
  let skipped = 0;
  let repIndex = 0;

  for (let i = 0; i < rows.length; i++) {
    if (isEmptyCsvRow(rows[i])) {
      skipped++;
      continue;
    }
    if (i > 0 && i % 50 === 0) {
      logger.info('artistCrmImport', `${filename}: ${i}/${rows.length} rows processed (${imported} imported, ${skipped} skipped)`);
    }
    const mapped = mapRowToLead(rows[i], template, i + 2);
    if (!mapped) {
      skipped++;
      continue;
    }
    mapped.importId = importSession._id;

    const result = await finalizeLeadDoc(mapped, {
      userId,
      importId: importSession._id,
      repIndex,
      reps,
      defaultAssigneeId,
    });
    if (result.skipped) {
      logger.debug('artistCrmImport', `Row ${i + 2} skipped: ${result.reason || 'unknown'}`);
      skipped++;
      continue;
    }
    if (reps.length) repIndex++;

    try {
      const { lead } = await upsertArtistLead(result.doc);
      await syncArtistCrmContact(lead);
      imported++;
    } catch (err) {
      logger.warn('artistCrmImport', `Row ${i + 2} failed: ${err.message}`);
      skipped++;
    }
  }

  importSession.leadCount = imported;
  await importSession.save();

  return {
    importId: importSession._id,
    template: template.label,
    totalRows: rows.length,
    imported,
    skipped,
  };
}

module.exports = {
  mapRowToLead,
  importArtistCsvFile,
  bulkImportArtistCsvFiles,
  prepareArtistImportDoc,
  resolveImportDocUniqueness,
  detectSheetTemplate,
  coerceArtistImportIdentity,
  deriveImportName,
  isEmptyCsvRow,
};
