const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ContactService = require('./ContactService');
const { DEFAULT_HAVELLS_ROOT } = require('../lib/havellsDataRoot');

const HAVELLS_IDENTITY_COLUMNS = {
  name: ['name', 'full_name', 'first name', 'first_name', 'customer name', 'contestant name'],
  email: ['email', 'email id', 'e-mail'],
  phone: ['phone', 'mobile', 'contact', 'phone number', 'mobile number'],
  city: ['city', 'audition_city'],
  state: ['state'],
  offering: ['offering', 'offering title', 'offering_title', 'product', 'course', 'program'],
  status: ['status', 'lead status', 'attendance', 'selected', 'attended'],
};

const CANONICAL_HAVELLS_FILES = [
  { path: 'data/merged_selected_data.csv', statusKey: 'havells_selected' },
  { path: 'data/merged_havells_data.csv', statusKey: 'havells_registered' },
  { path: 'data/Final Data/master_db_final.csv', statusKey: 'havells_registered' },
  { path: 'data/Delhi Data/Registration Delhi.csv', statusKey: 'havells_registered' },
  { path: 'data/Indore Data/final selected Indore.csv', statusKey: 'havells_selected' },
  { path: 'data/Indore Data/Indore Final attendance.csv', statusKey: 'havells_attended_indore' },
  { path: 'reports/non_attendees/non_attendees_delhi.csv', statusKey: 'havells_non_attended_delhi' },
  { path: 'reports/non_attendees/non_attendees_indore.csv', statusKey: 'havells_non_attended_indore' },
];

function clean(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  const raw = clean(value);
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function normalizeName(value) {
  return clean(value).replace(/\s+/g, ' ');
}

function headerLookup(row) {
  const map = new Map();
  for (const [k, v] of Object.entries(row || {})) {
    map.set(String(k || '').trim().toLowerCase(), v);
  }
  return map;
}

function pickColumnValue(row, aliases = []) {
  const lookup = headerLookup(row);
  for (const key of aliases) {
    if (lookup.has(key.toLowerCase())) return lookup.get(key.toLowerCase());
  }
  return '';
}

function detectStatusFromPath(relativePath, fallback = 'havells_registered') {
  const lower = String(relativePath || '').toLowerCase();
  if (lower.includes('selected')) return 'havells_selected';
  if (lower.includes('attendance') && lower.includes('indore')) return 'havells_attended_indore';
  if (lower.includes('attendance') && lower.includes('delhi')) return 'havells_attended_delhi';
  if (lower.includes('attendance') && lower.includes('dumka')) return 'havells_attended_dumka';
  return fallback;
}

function isIMLOffering(text) {
  return /\biml\b|i\.?m\.?l/i.test(clean(text));
}

function normalizeHavellsInletKey(statusKey) {
  if (statusKey === 'havells_non_attended_delhi' || statusKey === 'havells_non_attended_indore') {
    return 'havells_registered';
  }
  return statusKey;
}

function classifyHavellsRecord(row, relativePath, configuredStatus) {
  const statusText = clean(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.status)).toLowerCase();
  let statusKey = detectStatusFromPath(relativePath, configuredStatus);
  if (statusText.includes('selected')) statusKey = 'havells_selected';
  if (statusText.includes('attended') && /delhi/.test(statusText)) statusKey = 'havells_attended_delhi';
  if (statusText.includes('attended') && /indore/.test(statusText)) statusKey = 'havells_attended_indore';
  if (statusText.includes('attended') && /dumka/.test(statusText)) statusKey = 'havells_attended_dumka';
  return normalizeHavellsInletKey(statusKey);
}

function mapHavellsRow(row, relativePath, configuredStatus) {
  const name = normalizeName(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.name));
  const email = normalizeEmail(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.email));
  const phone = normalizePhone(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.phone));
  const city = normalizeName(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.city));
  const state = normalizeName(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.state));
  const offeringTitle = normalizeName(pickColumnValue(row, HAVELLS_IDENTITY_COLUMNS.offering));
  const statusKey = classifyHavellsRecord(row, relativePath, configuredStatus);
  return {
    name: name || 'Anonymous',
    email,
    phone,
    city,
    state,
    statusKey,
    offeringTitle,
    sourceFilename: relativePath,
    isIML: isIMLOffering(offeringTitle),
    raw: row,
  };
}

function resolveCanonicalFiles(rootPath = DEFAULT_HAVELLS_ROOT) {
  return CANONICAL_HAVELLS_FILES
    .map((entry) => ({
      ...entry,
      absolutePath: path.join(rootPath, entry.path),
    }))
    .filter((entry) => fs.existsSync(entry.absolutePath));
}

async function readCsvRows(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function identityKey(email, phone) {
  if (email) return `e:${email}`;
  if (phone) return `p:${phone}`;
  return '';
}

async function loadCanonicalHavellsRecords(rootPath = DEFAULT_HAVELLS_ROOT) {
  const files = resolveCanonicalFiles(rootPath);
  const records = [];
  for (const file of files) {
    const rows = await readCsvRows(file.absolutePath);
    for (const row of rows) {
      const mapped = mapHavellsRow(row, file.path, file.statusKey);
      if (!mapped.email && !mapped.phone) continue;
      records.push(mapped);
    }
  }
  return { files, records };
}

function mergeHavellsRecords(existing, incoming) {
  const inletKey = normalizeHavellsInletKey(incoming.statusKey);
  const statusKeys = new Set([...(existing.statusKeys || []), inletKey]);
  return {
    ...existing,
    name: existing.name && existing.name !== 'Anonymous' ? existing.name : incoming.name,
    email: existing.email || incoming.email,
    phone: existing.phone || incoming.phone,
    city: existing.city || incoming.city,
    state: existing.state || incoming.state,
    offeringTitle: existing.offeringTitle || incoming.offeringTitle,
    isIML: existing.isIML || incoming.isIML,
    statusKeys: [...statusKeys],
  };
}

function buildHavellsIdentitySet(records = []) {
  const phoneToEmail = new Map();
  for (const record of records) {
    if (record.email && record.phone) phoneToEmail.set(record.phone, record.email);
  }

  const map = new Map();
  for (const record of records) {
    const email = record.email || phoneToEmail.get(record.phone) || '';
    const phone = record.phone;
    const key = identityKey(email, phone);
    if (!key) continue;
    const normalized = { ...record, email: email || record.email };
    if (!map.has(key)) {
      map.set(key, {
        ...normalized,
        statusKeys: [normalizeHavellsInletKey(record.statusKey)],
      });
      continue;
    }
    map.set(key, mergeHavellsRecords(map.get(key), normalized));
  }
  return map;
}

async function importHavellsIntoDataHub({ rootPath = DEFAULT_HAVELLS_ROOT, dryRun = true, onProgress } = {}) {
  const { files, records } = await loadCanonicalHavellsRecords(rootPath);
  const identityMap = buildHavellsIdentitySet(records);
  const stats = {
    files: files.length,
    rowsRead: records.length,
    uniqueIdentityRows: identityMap.size,
    imported: 0,
    skipped: 0,
    errors: 0,
  };
  if (dryRun) return { ...stats, dryRun: true };

  for (const [, record] of identityMap.entries()) {
    try {
      const inletKeys = [...new Set(record.statusKeys || [normalizeHavellsInletKey(record.statusKey)])];
      for (const inletKey of inletKeys) {
        await ContactService.mergeLegacyInletContact({
          name: record.name,
          email: record.email,
          phone: record.phone,
          city: record.city,
          sourceFilename: record.sourceFilename,
          exlyOfferingTitle: record.offeringTitle,
          imlPriority: record.isIML,
          summary: {
            state: record.state,
            havellsStatus: inletKey,
            offeringTitle: record.offeringTitle,
            sourceFilename: record.sourceFilename,
          },
          recordId: null,
        }, inletKey);
      }
      stats.imported += 1;
    } catch (error) {
      stats.errors += 1;
      if (onProgress && stats.errors <= 20) {
        onProgress(`Skipped identity ${record.email || record.phone}: ${error.message}`);
      }
    }
    if (onProgress && stats.imported % 1000 === 0) {
      onProgress(`Imported ${stats.imported}/${identityMap.size}`);
    }
  }

  return { ...stats, dryRun: false };
}

module.exports = {
  HAVELLS_IDENTITY_COLUMNS,
  CANONICAL_HAVELLS_FILES,
  normalizeEmail,
  normalizePhone,
  normalizeName,
  mapHavellsRow,
  resolveCanonicalFiles,
  loadCanonicalHavellsRecords,
  buildHavellsIdentitySet,
  importHavellsIntoDataHub,
  identityKey,
  isIMLOffering,
};
