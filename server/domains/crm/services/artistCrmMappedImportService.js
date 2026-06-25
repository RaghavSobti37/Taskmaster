const fs = require('fs');
const csv = require('csv-parser');
const Lead = require('../models/Lead');
const CRMImport = require('../models/CRMImport');
const { CRM_TYPES, CONTACT_CATEGORIES, IMPORT_TAGS } = require('../../../../shared/artistCrmTaxonomy');
const {
  suggestArtistCrmMapping,
  validateArtistCrmMapping,
  ARTIST_CRM_IMPORT_FIELDS,
} = require('../../../../shared/artistCrmImportFields');
const {
  prepareArtistImportDoc,
  isEmptyCsvRow,
  mapRowToLead,
  importArtistCsvFile,
} = require('./artistCrmImportService');
const { detectSheetTemplate } = require('../../../../shared/artistCrmSheetMappings');
const { parseContactField } = require('../../../utils/artistContactFieldParser');
const { resolveAssigneeForImport, matchAssigneeFromSheetName, listArtistCallAssignees } = require('../../../utils/artistCallAssignees');
const { bypassOptions } = require('../../../infrastructure/database/bypassTenantPolicy');

const TENANT_LOOKUP = bypassOptions('artist_crm_mapped_import');
const BULK_INSERT_CHUNK = 500;
const PREVIEW_ROW_LIMIT = 5;

function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (h) => { headers = h; })
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve({ headers, rows }))
      .on('error', reject);
  });
}

function buildImportRowKey(filename, rowIndex) {
  return `artist-csv:${filename}:${rowIndex}`;
}

function mapRowWithColumnMapping(row, mapping, rowIndex, filename) {
  const pick = (fieldKey) => {
    const col = mapping[fieldKey];
    if (!col) return '';
    const val = row[col];
    return val != null ? String(val).trim() : '';
  };

  let name = pick('name');
  let email = pick('email');
  let phone = pick('phone');

  const emailCol = mapping.email;
  const phoneCol = mapping.phone;
  const sharedContact = emailCol && phoneCol && emailCol === phoneCol;
  const contactRaw = sharedContact ? pick('email') : `${pick('phone')} ${pick('email')}`.trim();
  const parsed = parseContactField(contactRaw);
  if (!email && parsed.email) email = parsed.email;
  if (!phone && parsed.phone) phone = parsed.phone;
  if (sharedContact && parsed.phone) phone = parsed.phone;
  if (sharedContact && parsed.email) email = parsed.email;

  if (!name || (!email && !phone)) return null;

  const tagsRaw = pick('tags');
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : [IMPORT_TAGS.EVENT_DB];

  return {
    crmType: CRM_TYPES.ARTIST,
    contactCategory: CONTACT_CATEGORIES.EVENT_DATABASE,
    name,
    email,
    phone,
    city: pick('city'),
    primaryRole: pick('primaryRole'),
    remarks: pick('remarks'),
    source: pick('source') || `CSV Import: ${filename}`,
    leadStatus: 'New',
    callStatus: 'Pending',
    meaningfulConnect: 'PENDING',
    tags: tags.length ? tags : [IMPORT_TAGS.EVENT_DB],
    metadata: {
      importRowKey: buildImportRowKey(filename, rowIndex),
      mappedImport: true,
      sourceFile: filename,
    },
  };
}

async function resolveTenantId() {
  const Tenant = require('../../../models/Tenant');
  let tenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions(TENANT_LOOKUP);
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'admin@theshakticollective.in',
    });
  }
  return tenant._id;
}

async function loadExistingIdentityRegistry(tenantId) {
  const existing = await Lead.find({ tenantId, crmType: CRM_TYPES.ARTIST })
    .select('metadata.importRowKey phone email')
    .setOptions(TENANT_LOOKUP)
    .lean();

  const importRowKeys = new Set();
  const phones = new Set();
  const emails = new Set();

  for (const row of existing) {
    const rowKey = row.metadata?.importRowKey;
    if (rowKey) importRowKeys.add(rowKey);
    if (row.phone) phones.add(row.phone);
    if (row.email) emails.add(String(row.email).toLowerCase());
  }

  return { importRowKeys, phones, emails };
}

function isAlreadyInCrm(doc, registry) {
  const key = doc.metadata?.importRowKey;
  if (key && registry.importRowKeys.has(key)) return true;
  if (doc.phone && registry.phones.has(doc.phone)) return true;
  if (doc.email && registry.emails.has(String(doc.email).toLowerCase())) return true;
  return false;
}

function trackNewLead(doc, registry) {
  const key = doc.metadata?.importRowKey;
  if (key) registry.importRowKeys.add(key);
  if (doc.phone) registry.phones.add(doc.phone);
  if (doc.email) registry.emails.add(String(doc.email).toLowerCase());
}

function isDuplicateKeyError(err) {
  return err?.code === 11000 || String(err?.message || '').includes('E11000 duplicate key');
}

async function bulkInsertNewLeads(docs) {
  if (!docs.length) return { created: 0, duplicateSkipped: 0 };

  let created = 0;
  let duplicateSkipped = 0;

  for (let i = 0; i < docs.length; i += BULK_INSERT_CHUNK) {
    const slice = docs.slice(i, i + BULK_INSERT_CHUNK);
    try {
      const inserted = await Lead.insertMany(slice, { ordered: false });
      created += inserted.length;
    } catch (err) {
      created += err.insertedDocs?.length || 0;
      const writeErrors = err.writeErrors || [];
      duplicateSkipped += writeErrors.filter((e) => e.code === 11000).length;
      const fatal = writeErrors.filter((e) => e.code !== 11000);
      if (fatal.length) throw fatal[0];
      if (!writeErrors.length && !isDuplicateKeyError(err)) throw err;
    }
  }

  return { created, duplicateSkipped };
}

async function previewArtistCsvFile(filePath, filename, { sheetName } = {}) {
  const { headers, rows } = await readCsvRows(filePath);
  const template = detectSheetTemplate(filename);
  const label = sheetName || filename.replace(/\.csv$/i, '');
  const assignees = await listArtistCallAssignees();
  const detectedAssignee = matchAssigneeFromSheetName(label, assignees);

  return {
    filename,
    sheetName: label,
    headers,
    rowCount: rows.length,
    previewRows: rows.slice(0, PREVIEW_ROW_LIMIT),
    suggestedMapping: suggestArtistCrmMapping(headers),
    fields: ARTIST_CRM_IMPORT_FIELDS,
    detectedTemplate: template?.label || null,
    detectedAssignee,
  };
}

async function importArtistCsvWithOptions({
  filePath,
  filename,
  userId,
  mapping,
  assignedRepId,
  sheetName,
}) {
  const label = sheetName || filename.replace(/\.csv$/i, '');
  const resolved = await resolveAssigneeForImport({
    sheetName: label,
    manualAssigneeId: assignedRepId,
  });
  if (!resolved?.assigneeId) {
    throw new Error('Could not resolve assignee — add name to sheet title (e.g. "Leads - Akash") or pick a rep.');
  }
  const assigneeId = resolved.assigneeId;

  const template = detectSheetTemplate(filename);
  if (!mapping && template) {
    const result = await importArtistCsvFile({
      filePath,
      filename,
      userId,
      assignedRepId: assigneeId,
      sheetName: label,
    });
    return { ...result, assignee: resolved.assigneeName, assigneeSource: resolved.source };
  }

  const mappingError = validateArtistCrmMapping(mapping || {});
  if (mappingError) throw new Error(mappingError);

  const tenantId = await resolveTenantId();
  const registry = await loadExistingIdentityRegistry(tenantId);
  const { rows } = await readCsvRows(filePath);

  const importSession = await CRMImport.create({
    filename,
    leadCount: 0,
    crmType: CRM_TYPES.ARTIST,
    sheetTemplate: 'mapped_csv',
    createdBy: userId,
  });

  const preparedDocs = [];
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    if (isEmptyCsvRow(rows[i])) {
      skipped++;
      continue;
    }

    const rowIndex = i + 2;
    let mapped = mapRowWithColumnMapping(rows[i], mapping, rowIndex, filename);

    if (!mapped && template) {
      mapped = mapRowToLead(rows[i], template, rowIndex);
      if (mapped) {
        mapped.metadata = {
          ...(mapped.metadata || {}),
          importRowKey: buildImportRowKey(filename, rowIndex),
        };
      }
    }

    if (!mapped) {
      skipped++;
      continue;
    }

    mapped.importId = importSession._id;
    mapped.assignedRepId = assigneeId;

    const prepared = prepareArtistImportDoc(mapped, {
      userId,
      importId: importSession._id,
      tenantId,
      defaultAssigneeId: assigneeId,
      reps: [],
      repIndex: 0,
    });

    if (prepared.skipped) {
      skipped++;
      continue;
    }

    const doc = prepared.doc;
    doc.assignedRepId = assigneeId;

    if (isAlreadyInCrm(doc, registry)) {
      skipped++;
      continue;
    }

    preparedDocs.push(doc);
    trackNewLead(doc, registry);
  }

  const bulk = await bulkInsertNewLeads(preparedDocs);
  importSession.leadCount = bulk.created;
  await importSession.save();

  return {
    importId: importSession._id,
    imported: bulk.created,
    skipped: skipped + bulk.duplicateSkipped,
    duplicateSkipped: bulk.duplicateSkipped,
    prepared: preparedDocs.length,
    assigneeId,
    assignee: resolved.assigneeName,
    assigneeSource: resolved.source,
    matchedToken: resolved.matchedToken,
    sheetName: label,
    mode: 'mapped_csv',
  };
}

module.exports = {
  previewArtistCsvFile,
  importArtistCsvWithOptions,
  mapRowWithColumnMapping,
  suggestArtistCrmMapping,
  validateArtistCrmMapping,
};
