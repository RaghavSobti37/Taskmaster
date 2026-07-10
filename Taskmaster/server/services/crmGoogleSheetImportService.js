const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { google } = require('googleapis');
const Lead = require('../models/Lead');
const CRMImport = require('../models/CRMImport');
const User = require('../models/User');
const {
  CRM_TYPES,
  CONTACT_CATEGORIES,
  IMPORT_TAGS,
  categoryToTagSlug,
} = require('../../shared/artistCrmTaxonomy');
const { detectSheetTemplate } = require('../../shared/artistCrmSheetMappings');
const {
  mapRowToLead,
  prepareArtistImportDoc,
  isEmptyCsvRow,
} = require('../domains/crm/services/artistCrmImportService');
const { parseContactField } = require('../utils/artistContactFieldParser');
const { resolveAssigneeForImport } = require('../utils/artistCallAssignees');
const { bypassOptions } = require('../infrastructure/database/bypassTenantPolicy');

const DEFAULT_SPREADSHEET_ID = '1ZOHoK4hPBGJXrdEvwSv7vgwBO_I7UbmPKceHOBLKP4A';
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  || 'tsc-newsletter@tsc-website-470512.iam.gserviceaccount.com';

const TENANT_LOOKUP = bypassOptions('crm_sheet_import');

function sheetAccessHelpMessage(cause) {
  return `${cause} Share the Google Sheet with ${SERVICE_ACCOUNT_EMAIL} (Viewer is enough), then retry.`;
}

function normalizeHeader(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function pickRowField(row, ...keys) {
  const normalized = {};
  for (const [key, value] of Object.entries(row || {})) {
    normalized[normalizeHeader(key)] = value != null ? String(value).trim() : '';
  }
  for (const key of keys) {
    const val = normalized[normalizeHeader(key)];
    if (val) return val;
  }
  return '';
}

function buildImportRowKey(spreadsheetId, sheetName, rowIndex) {
  return `gsheet:${spreadsheetId}:${sheetName}:${rowIndex}`;
}

function rowsToObjects(headers, dataRows) {
  return dataRows.map((row) => {
    const obj = {};
    headers.forEach((header, idx) => {
      const key = header != null ? String(header).trim() : '';
      if (!key) return;
      obj[key] = row[idx] != null ? String(row[idx]).trim() : '';
    });
    return obj;
  });
}

const SKIP_SHEETS = /^tracker$|^poa$/i;
const EVENT_DB_HEADERS = new Set(['category', 'name', 'email', 'phone', 'city', 'state']);

function headersAreEventDatabase(headers) {
  const h = new Set(headers.map(normalizeHeader).filter(Boolean));
  for (const key of EVENT_DB_HEADERS) {
    if (!h.has(key)) return false;
  }
  return true;
}

function baseArtistLead(sheetName, rowIndex, spreadsheetId, extraMeta = {}) {
  const tag = categoryToTagSlug(sheetName);
  return {
    crmType: CRM_TYPES.ARTIST,
    contactCategory: CONTACT_CATEGORIES.EVENT_DATABASE,
    source: `Google Sheet: ${sheetName}`,
    leadStatus: 'New',
    callStatus: 'Pending',
    meaningfulConnect: 'PENDING',
    tags: [IMPORT_TAGS.EVENT_DB, ...(tag ? [tag] : [])],
    metadata: {
      importRowKey: buildImportRowKey(spreadsheetId, sheetName, rowIndex),
      sourceSheet: sheetName,
      sheetImport: true,
      ...extraMeta,
    },
  };
}

function orderedRowValues(headers, row) {
  return headers.map((header) => (row[header] != null ? String(row[header]).trim() : ''));
}

function mapEventDatabaseRow(row, sheetName, rowIndex) {
  const template = {
    id: 'event_database',
    label: sheetName,
    type: 'event_database',
    artistProject: null,
    contactCategory: CONTACT_CATEGORIES.EVENT_DATABASE,
    tags: [IMPORT_TAGS.EVENT_DB],
  };
  return mapRowToLead(row, template, rowIndex);
}

function mapAwardsSummitsRow(row, sheetName, rowIndex, spreadsheetId) {
  const name = pickRowField(row, 'event name');
  const contactRaw = pickRowField(row, 'contact information');
  const parsed = parseContactField(contactRaw);
  if (!name || (!parsed.email && !parsed.phone)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      website: pickRowField(row, 'website link'),
      dates: pickRowField(row, 'dates'),
      rawContact: contactRaw,
    }),
    name,
    email: parsed.email,
    phone: parsed.phone,
    city: pickRowField(row, 'location'),
  };
}

function mapCollegeRow(row, sheetName, rowIndex, spreadsheetId) {
  const name = pickRowField(row, 'college name');
  const email = pickRowField(row, 'contact email');
  const phone = pickRowField(row, 'contact phone / fax', 'contact phone');
  if (!name || (!email && !phone)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      website: pickRowField(row, 'official website / url'),
      culturalContext: pickRowField(row, 'cultural circle context & marathi relevance'),
    }),
    name,
    email,
    phone,
    city: pickRowField(row, 'location (city / district)', 'location'),
  };
}

function mapFestivalPerformanceRow(row, sheetName, rowIndex, spreadsheetId) {
  const name = pickRowField(
    row,
    'festival / event name',
    'organization / entity',
    'category',
  );
  const emailRaw = pickRowField(row, 'email address', 'email');
  const phoneRaw = pickRowField(row, 'contact number', 'phone number', 'phone number ');
  const contactRaw = pickRowField(row, 'contact information') || `${phoneRaw} ${emailRaw}`;
  const parsed = parseContactField(contactRaw);
  const resolvedName = pickRowField(row, 'festival / event name', 'organization / entity') || name;
  if (!resolvedName || (!parsed.email && !parsed.phone)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      organizingAgency: pickRowField(row, 'organizing agency'),
      contactPerson: pickRowField(row, 'contact person / role'),
      website: pickRowField(row, 'official website', 'website'),
      rawContact: contactRaw,
    }),
    name: resolvedName,
    email: parsed.email || emailRaw,
    phone: parsed.phone || phoneRaw,
    city: pickRowField(row, 'location / venue', 'city'),
  };
}

function mapEventCompanyRow(row, sheetName, rowIndex, spreadsheetId) {
  const name = pickRowField(row, 'organization / event comany', 'organization');
  const email = pickRowField(row, 'email');
  const phoneRaw = pickRowField(row, 'contact');
  const parsed = parseContactField(`${phoneRaw} ${email}`);
  if (!name || (!parsed.email && !parsed.phone && !email && !phoneRaw)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      role: pickRowField(row, 'role'),
      website: pickRowField(row, 'website'),
    }),
    name,
    email: parsed.email || email,
    phone: parsed.phone || phoneRaw,
    city: pickRowField(row, 'city'),
  };
}

function mapLiveVenueRow(row, sheetName, rowIndex, spreadsheetId) {
  const name = pickRowField(row, 'venues', 'venue');
  const email = pickRowField(row, 'email id', 'email');
  const phoneRaw = pickRowField(row, 'contact');
  const parsed = parseContactField(`${phoneRaw} ${email}`);
  if (!name || (!parsed.email && !parsed.phone)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      content: pickRowField(row, 'content'),
    }),
    name,
    email: parsed.email || email,
    phone: parsed.phone || phoneRaw,
    city: pickRowField(row, 'city'),
  };
}

function mapPositionalLead(headers, row, sheetName, rowIndex, spreadsheetId, spec) {
  const vals = orderedRowValues(headers, row);
  const name = vals[spec.nameIdx] || vals[0];
  const phoneRaw = spec.phoneIdx != null ? vals[spec.phoneIdx] : '';
  const emailRaw = spec.emailIdx != null ? vals[spec.emailIdx] : '';
  const parsed = parseContactField(`${phoneRaw} ${emailRaw}`);
  if (!name || (!parsed.email && !parsed.phone && !emailRaw && !phoneRaw)) return null;
  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
      positionalImport: true,
      extra: spec.extraIdx != null ? vals[spec.extraIdx] : undefined,
    }),
    name,
    email: parsed.email || emailRaw,
    phone: parsed.phone || phoneRaw,
    city: spec.cityIdx != null ? vals[spec.cityIdx] : '',
    primaryRole: spec.roleIdx != null ? vals[spec.roleIdx] : undefined,
  };
}

function mapSheetRow({ headers, row, sheetName, rowIndex, spreadsheetId }) {
  const lowerSheet = sheetName.toLowerCase();

  if (SKIP_SHEETS.test(sheetName.trim())) return null;
  if (headers.length === 1 && normalizeHeader(headers[0]) === '#ref!') return null;

  const filenameTemplate = detectSheetTemplate(`${sheetName}.csv`);
  if (filenameTemplate) {
    return mapRowToLead(row, filenameTemplate, rowIndex);
  }

  if (headersAreEventDatabase(headers)) {
    return mapEventDatabaseRow(row, sheetName, rowIndex);
  }

  if (/awards.*summit/i.test(sheetName)) {
    return mapAwardsSummitsRow(row, sheetName, rowIndex, spreadsheetId);
  }
  if (/college/i.test(sheetName)) {
    return mapCollegeRow(row, sheetName, rowIndex, spreadsheetId);
  }
  if (/iccr/i.test(sheetName)) {
    const name = pickRowField(row, 'key personnel / designation', 'iccr division / region');
    const contactRaw = pickRowField(row, 'contact information');
    const parsed = parseContactField(contactRaw);
    if (!name || (!parsed.email && !parsed.phone)) return null;
    return {
      ...baseArtistLead(sheetName, rowIndex, spreadsheetId, {
        division: pickRowField(row, 'iccr division / region'),
        address: pickRowField(row, 'location / address'),
        rawContact: contactRaw,
      }),
      name,
      email: parsed.email,
      phone: parsed.phone,
      city: pickRowField(row, 'location / address'),
    };
  }
  if (/kabir|agnee|parvaaz|yugm|state govt/i.test(sheetName)) {
    return mapFestivalPerformanceRow(row, sheetName, rowIndex, spreadsheetId);
  }
  if (/event management/i.test(sheetName)) {
    return mapEventCompanyRow(row, sheetName, rowIndex, spreadsheetId);
  }
  if (/live gig venue|music event venues/i.test(sheetName)) {
    return mapLiveVenueRow(row, sheetName, rowIndex, spreadsheetId);
  }
  if (/private shows/i.test(sheetName)) {
    return mapPositionalLead(headers, row, sheetName, rowIndex, spreadsheetId, {
      nameIdx: 4,
      cityIdx: 1,
      phoneIdx: 5,
      emailIdx: 6,
      extraIdx: 0,
    });
  }
  if (/nashik.*sponcer|sponsor/i.test(sheetName)) {
    return mapPositionalLead(headers, row, sheetName, rowIndex, spreadsheetId, {
      nameIdx: 0,
      phoneIdx: 1,
      cityIdx: 3,
      extraIdx: 2,
    });
  }
  if (/govt.*cultural/i.test(sheetName)) {
    return mapPositionalLead(headers, row, sheetName, rowIndex, spreadsheetId, {
      nameIdx: 0,
      phoneIdx: 1,
      roleIdx: 2,
    });
  }
  if (/storytelling|art festival|music festival|brands for music|master database/i.test(lowerSheet)) {
    if (headersAreEventDatabase(headers)) {
      return mapEventDatabaseRow(row, sheetName, rowIndex);
    }
  }

  const name = pickRowField(
    row,
    'name', 'full name', 'contact name', 'event name', 'college name',
    'organization / entity', 'organization / event comany', 'venues',
  );
  const email = pickRowField(row, 'email', 'email id', 'email address', 'contact email');
  const phoneRaw = pickRowField(
    row,
    'phone', 'mobile', 'contact', 'contact number', 'contact phone / fax', 'contact information',
  );
  const parsed = parseContactField(`${phoneRaw} ${email}`);
  if (!name || (!parsed.email && !parsed.phone && !email && !phoneRaw)) return null;

  return {
    ...baseArtistLead(sheetName, rowIndex, spreadsheetId),
    name,
    email: parsed.email || email,
    phone: parsed.phone || phoneRaw,
    city: pickRowField(row, 'city', 'location', 'location (city / district)'),
  };
}

function isDuplicateKeyError(err) {
  return err?.code === 11000 || String(err?.message || '').includes('E11000 duplicate key');
}

async function getSheetsClient(spreadsheetId) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error(sheetAccessHelpMessage('Google service account credentials are missing.'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    await sheets.spreadsheets.get({ spreadsheetId });
    return sheets;
  } catch (err) {
    const msg = String(err.message || '');
    if (/permission|403|404|not found|caller does not have/i.test(msg)) {
      throw new Error(sheetAccessHelpMessage('Service account cannot read this sheet yet.'));
    }
    throw err;
  }
}

async function fetchAllSheetTabs(spreadsheetId) {
  const sheets = await getSheetsClient(spreadsheetId);
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabNames = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
  const batch = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabNames.map((t) => `'${t.replace(/'/g, "''")}'!A:Z`),
  });

  return (batch.data.valueRanges || []).map((rangeData, i) => {
    const sheetName = tabNames[i];
    const values = rangeData.values || [];
    const headers = values[0] || [];
    const dataRows = values.slice(1);
    return {
      sheetName,
      headers,
      dataRows,
      rowObjects: rowsToObjects(headers, dataRows),
    };
  });
}

async function resolveAkashAssigneeId() {
  const resolved = await resolveAssigneeForImport({});
  return resolved?.assigneeId || null;
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

async function resolveTenantId() {
  const Tenant = require('../models/Tenant');
  let tenant = await Tenant.findOne({ name: 'Default Tenant' }).setOptions(TENANT_LOOKUP);
  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Tenant',
      contactEmail: 'helloworld@theshakticollective',
    });
  }
  return tenant._id;
}

const DEFAULT_CSV_DIR = path.join(__dirname, '../data/crm-sheet-import');
const BULK_INSERT_CHUNK = 500;

function sanitizeSheetFilename(sheetName) {
  return String(sheetName || 'sheet')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function escapeCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function writeTabCsv(filePath, headers, dataRows) {
  const headerRow = headers.map((h) => (h != null ? String(h) : ''));
  const lines = [headerRow.map(escapeCsvCell).join(',')];
  for (const row of dataRows) {
    lines.push(headerRow.map((_, idx) => escapeCsvCell(row[idx] ?? '')).join(','));
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function readLocalCsv(filePath) {
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

async function exportSheetTabsToCsvDir({
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
  outputDir = path.join(DEFAULT_CSV_DIR, DEFAULT_SPREADSHEET_ID),
} = {}) {
  const tabs = await fetchAllSheetTabs(spreadsheetId);
  const files = [];

  for (const tab of tabs) {
    if (SKIP_SHEETS.test(tab.sheetName.trim())) continue;
    if (!tab.headers.length && !tab.dataRows.length) continue;

    const filename = `${sanitizeSheetFilename(tab.sheetName)}.csv`;
    const filePath = path.join(outputDir, filename);
    writeTabCsv(filePath, tab.headers, tab.dataRows);
    files.push({ sheetName: tab.sheetName, filePath, filename, rowCount: tab.dataRows.length });
  }

  return { spreadsheetId, outputDir, files };
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

function prepareLeadsFromTab({
  tab,
  spreadsheetId,
  userId,
  importId,
  tenantId,
  assigneeId,
  registry,
  dryRun = false,
}) {
  const template = detectSheetTemplate(`${tab.sheetName}.csv`);
  let tabCreated = 0;
  let tabSkipped = 0;
  const docs = [];

  for (let i = 0; i < tab.rowObjects.length; i++) {
    const row = tab.rowObjects[i];
    if (isEmptyCsvRow(row)) {
      tabSkipped++;
      continue;
    }

    const rowIndex = i + 2;
    let mapped = mapSheetRow({
      headers: tab.headers,
      row,
      sheetName: tab.sheetName,
      rowIndex,
      spreadsheetId,
    });
    if (!mapped && template) {
      mapped = mapRowToLead(row, template, rowIndex);
    }
    if (!mapped) {
      tabSkipped++;
      continue;
    }

    if (!mapped.metadata?.importRowKey) {
      mapped.metadata = {
        ...(mapped.metadata || {}),
        importRowKey: buildImportRowKey(spreadsheetId, tab.sheetName, rowIndex),
        sourceSheet: tab.sheetName,
      };
    }

    mapped.importId = importId;
    mapped.assignedRepId = assigneeId;

    const prepared = prepareArtistImportDoc(mapped, {
      userId,
      importId,
      tenantId,
      defaultAssigneeId: assigneeId,
      reps: [],
      repIndex: 0,
    });
    if (prepared.skipped) {
      tabSkipped++;
      continue;
    }

    const doc = prepared.doc;
    doc.assignedRepId = assigneeId;

    if (isAlreadyInCrm(doc, registry)) {
      tabSkipped++;
      continue;
    }

    if (dryRun) {
      tabCreated++;
      trackNewLead(doc, registry);
      continue;
    }

    docs.push(doc);
    trackNewLead(doc, registry);
    tabCreated++;
  }

  return {
    docs,
    sheetResult: {
      sheet: tab.sheetName,
      template: template?.label || (headersAreEventDatabase(tab.headers) ? 'event_database' : 'sheet_mapper'),
      totalRows: tab.rowObjects.length,
      prepared: tabCreated,
      skipped: tabSkipped,
    },
  };
}

async function importCrmLeadsFromLocalCsvDir({
  csvDir,
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
  userId,
  dryRun = false,
  assigneeId: forcedAssigneeId,
} = {}) {
  if (!csvDir || !fs.existsSync(csvDir)) {
    throw new Error(`CSV directory not found: ${csvDir}`);
  }

  const tenantId = await resolveTenantId();
  const registry = await loadExistingIdentityRegistry(tenantId);

  const manifestPath = path.join(csvDir, 'manifest.json');
  const entries = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).sheets
    : fs.readdirSync(csvDir)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((filename) => ({ filename, sheetName: path.basename(filename, '.csv') }));

  const importSession = dryRun
    ? null
    : await CRMImport.create({
      filename: `Local CSV import ${csvDir}`,
      leadCount: 0,
      crmType: CRM_TYPES.ARTIST,
      sheetTemplate: 'google_sheet_csv',
      createdBy: userId,
    });

  const sheetResults = [];
  const preparedDocs = [];

  for (const entry of entries) {
    const filePath = path.join(csvDir, entry.filename);
    const { headers, rows } = await readLocalCsv(filePath);
    const sheetName = entry.sheetName || path.basename(entry.filename, '.csv');
    const tab = {
      sheetName,
      headers,
      dataRows: rows.map((row) => headers.map((h) => row[h] ?? '')),
      rowObjects: rows,
    };

    const sheetAssignee = await resolveAssigneeForImport({
      sheetName,
      manualAssigneeId: forcedAssigneeId,
    });
    if (!sheetAssignee?.assigneeId) {
      sheetResults.push({
        sheet: sheetName,
        error: 'No assignee resolved from sheet name or fallback',
        totalRows: rows.length,
        prepared: 0,
        skipped: rows.length,
      });
      continue;
    }

    const { docs, sheetResult } = prepareLeadsFromTab({
      tab,
      spreadsheetId,
      userId,
      importId: importSession?._id,
      tenantId,
      assigneeId: sheetAssignee.assigneeId,
      registry,
      dryRun,
    });
    preparedDocs.push(...docs);
    sheetResults.push({
      ...sheetResult,
      assignee: sheetAssignee.assigneeName,
      assigneeSource: sheetAssignee.source,
      matchedToken: sheetAssignee.matchedToken,
    });
  }

  let created = 0;
  let duplicateSkipped = 0;
  if (!dryRun && preparedDocs.length) {
    const bulk = await bulkInsertNewLeads(preparedDocs);
    created = bulk.created;
    duplicateSkipped = bulk.duplicateSkipped;
  } else if (dryRun) {
    created = preparedDocs.length;
  }

  if (importSession) {
    importSession.leadCount = created;
    await importSession.save();
  }

  const skipped = sheetResults.reduce((sum, s) => sum + s.skipped, 0);

  return {
    spreadsheetId,
    csvDir,
    dryRun,
    sheets: sheetResults,
    prepared: preparedDocs.length,
    created,
    skipped,
    duplicateSkipped,
    importId: importSession?._id,
  };
}

async function importCrmLeadsFromGoogleSheet({
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
  userId,
  dryRun = false,
  assigneeId: forcedAssigneeId,
  csvDir = path.join(DEFAULT_CSV_DIR, spreadsheetId),
} = {}) {
  const exported = await exportSheetTabsToCsvDir({ spreadsheetId, outputDir: csvDir });
  const manifest = {
    spreadsheetId,
    exportedAt: new Date().toISOString(),
    sheets: exported.files,
  };
  fs.writeFileSync(path.join(csvDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return importCrmLeadsFromLocalCsvDir({
    csvDir,
    spreadsheetId,
    userId,
    dryRun,
    assigneeId: forcedAssigneeId,
  });
}

module.exports = {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_CSV_DIR,
  SERVICE_ACCOUNT_EMAIL,
  exportSheetTabsToCsvDir,
  importCrmLeadsFromLocalCsvDir,
  importCrmLeadsFromGoogleSheet,
  fetchAllSheetTabs,
  mapSheetRow,
};
