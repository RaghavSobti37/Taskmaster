const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const MediaContact = require('../models/MediaContact');
const { MEDIA_SHEETS, sheetFilePath } = require('../data/mediaSheetManifest');

const SPREADSHEET_ID = '1AvRDNpmSJqQJ9Hom7kQttr0IPNnid9iut3H6XSsWQY8';

const GLOBAL_ALIASES = {
  publication: [
    'publication / platform', 'publication', 'platform', 'outlet name', 'agency name',
    'podcast title', 'event / venue name', 'magazine rolling stone india', 'publication name',
    'publication wires pti ians', 'publication ', 'publication toi', 'youtubers ',
  ],
  journalistName: [
    'journalist name', "journalist's name:", 'journalist', 'name', 'host / producer',
    'journalist ', 'journalist arpita misra',
  ],
  designation: ['designation', 'title', 'role', 'organizing entity', 'profling\ncolumn inspiration'],
  contactEmail: [
    'contact email', 'email id:', 'email', 'email address', 'email id ', 'email ',
    'partnership contact email', 'work email', 'contact details',
  ],
  contactPhone: [
    'contact phone', 'contact no.:', 'phone', 'phone number', 'mobile', 'mobile number ',
    'contact number', 'number ',
  ],
  niche: [
    'niche / beat', 'niche', 'beat', 'primary beat', 'demographic & core theme',
    'proposed strategic collaboration model', 'proposed collaboration model', 'status:',
    'brief personal / career - women centric', 'print/online',
  ],
  location: ['location', 'city'],
  notes: ['website / details', 'status: '],
};

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function rowValues(rawRow) {
  return Object.values(rawRow).map((v) => String(v || '').replace(/\s+/g, ' ').trim());
}

function cleanEmail(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const first = raw.split(/[;,]/)[0].trim();
  return first.replace(/\s+/g, '');
}

function cleanPhone(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function splitContactDetails(value) {
  const raw = String(value || '').trim();
  if (!raw) return { contactEmail: '', contactPhone: '' };
  if (raw.includes('@')) return { contactEmail: cleanEmail(raw), contactPhone: '' };
  return { contactEmail: '', contactPhone: cleanPhone(raw) };
}

function buildNormalizedMap(rawRow) {
  const normalized = {};
  for (const [key, value] of Object.entries(rawRow)) {
    normalized[normalizeHeader(key)] = String(value || '').replace(/\n/g, ' ').trim();
  }
  return normalized;
}

function pickField(normalized, field) {
  for (const alias of GLOBAL_ALIASES[field] || []) {
    const key = normalizeHeader(alias);
    if (normalized[key]) return normalized[key];
  }
  return '';
}

function isHeaderNoise(row) {
  const name = (row.journalistName || '').toLowerCase();
  const pub = (row.publication || '').toLowerCase();
  if (!row.contactEmail && !row.contactPhone && !row.journalistName) return true;
  if (name.includes('journalist') && name.includes('name')) return true;
  if (pub === 'print' || pub === 'wires' || pub === 'regional') return true;
  if (name === 'name' || pub === 'publication') return true;
  return false;
}

function finalizeRow(partial, sourceSheet, context) {
  let publication = (partial.publication || '').trim();
  const journalistName = (partial.journalistName || '').replace(/\s+/g, ' ').trim();

  if (publication) context.lastPublication = publication;
  else if (context.lastPublication) publication = context.lastPublication;

  if (!publication && !journalistName) return null;

  const row = {
    publication: publication || journalistName || 'Unknown',
    journalistName: journalistName || publication || 'Contact',
    designation: (partial.designation || '').trim(),
    contactEmail: cleanEmail(partial.contactEmail),
    contactPhone: cleanPhone(partial.contactPhone),
    niche: (partial.niche || '').trim(),
    location: (partial.location || '').trim(),
    notes: (partial.notes || '').trim(),
    sourceSheet,
  };

  if (isHeaderNoise(row)) return null;
  return row;
}

function mapStandardMedia(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'journalistName'),
    designation: pickField(n, 'designation'),
    contactEmail: pickField(n, 'contactEmail'),
    contactPhone: pickField(n, 'contactPhone'),
    niche: pickField(n, 'niche'),
  }, sourceSheet, context);
}

function mapPodcasts(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  const details = splitContactDetails(pickField(n, 'contactEmail') || n['contact details']);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'journalistName'),
    contactEmail: details.contactEmail,
    contactPhone: details.contactPhone,
    niche: pickField(n, 'niche'),
    designation: n['proposed strategic collaboration model'] || '',
  }, sourceSheet, context);
}

function mapAgency(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: 'Agency Contact',
    contactEmail: pickField(n, 'contactEmail'),
    contactPhone: pickField(n, 'contactPhone'),
    location: pickField(n, 'location'),
    notes: n['website / details'] || '',
  }, sourceSheet, context);
}

function mapEvents(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'designation') || 'Partnership',
    designation: pickField(n, 'designation'),
    contactEmail: pickField(n, 'contactEmail'),
    location: pickField(n, 'location'),
    niche: n['proposed collaboration model'] || '',
  }, sourceSheet, context);
}

function mapMusicSimple(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'journalistName'),
    contactEmail: pickField(n, 'contactEmail'),
    contactPhone: pickField(n, 'contactPhone'),
  }, sourceSheet, context);
}

function mapConsumer(rawRow, sourceSheet, context) {
  const vals = rowValues(rawRow);
  return finalizeRow({
    publication: vals[0],
    journalistName: vals[1],
    contactPhone: vals[2],
    contactEmail: vals[3],
    niche: vals[4],
  }, sourceSheet, context);
}

function mapEducation(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  const work = n['work email'] || '';
  const personal = n['personal email'] || '';
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'journalistName'),
    contactPhone: pickField(n, 'contactPhone'),
    contactEmail: work || personal,
    location: pickField(n, 'location'),
    notes: work && personal && work !== personal ? `Personal: ${personal}` : '',
  }, sourceSheet, context);
}

function mapIndore(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: n.journalist || pickField(n, 'journalistName'),
    designation: pickField(n, 'designation'),
    contactPhone: pickField(n, 'contactPhone'),
    niche: n['print/online'] || '',
  }, sourceSheet, context);
}

function mapPositionalPubNamePhoneEmail(rawRow, sourceSheet, context) {
  const vals = rowValues(rawRow);
  return finalizeRow({
    publication: vals[0],
    journalistName: vals[1],
    contactPhone: vals[2],
    contactEmail: vals[3],
  }, sourceSheet, context);
}

function mapYoutube(rawRow, sourceSheet, context) {
  const vals = rowValues(rawRow);
  const channel = vals[1];
  const journalistName = `${vals[2] || ''} ${vals[3] || ''}`.trim();
  return finalizeRow({
    publication: channel || vals[0] || 'YouTube',
    journalistName: journalistName || channel || 'Creator',
    contactEmail: vals[4],
    niche: vals[0] || 'YouTube',
  }, sourceSheet, context);
}

function mapCityGeneral(rawRow, sourceSheet, context) {
  const n = buildNormalizedMap(rawRow);
  const work = n['work email'] || '';
  const personal = n['personal email'] || '';
  return finalizeRow({
    publication: pickField(n, 'publication'),
    journalistName: pickField(n, 'journalistName'),
    niche: pickField(n, 'niche'),
    contactPhone: pickField(n, 'contactPhone'),
    contactEmail: work || personal,
    notes: work && personal && work !== personal ? `Personal: ${personal}` : '',
  }, sourceSheet, context);
}

function mapCeoProfiling(rawRow, sourceSheet, context) {
  const vals = rowValues(rawRow);
  return finalizeRow({
    publication: vals[0],
    designation: vals[1],
    niche: vals[2],
    journalistName: vals[3],
    contactPhone: vals[4],
    contactEmail: vals[5],
  }, sourceSheet, context);
}

const MAPPERS = {
  standardMedia: mapStandardMedia,
  podcasts: mapPodcasts,
  agency: mapAgency,
  events: mapEvents,
  musicSimple: mapMusicSimple,
  consumer: mapConsumer,
  education: mapEducation,
  indore: mapIndore,
  positionalPubNamePhoneEmail: mapPositionalPubNamePhoneEmail,
  youtube: mapYoutube,
  cityGeneral: mapCityGeneral,
  ceoProfiling: mapCeoProfiling,
};

function mapRow(rawRow, sheetConfig, context = { lastPublication: '' }) {
  const mapper = MAPPERS[sheetConfig.mapper] || mapStandardMedia;
  return mapper(rawRow, sheetConfig.name, context);
}

async function readCsvRows(filePath, sheetConfig) {
  const context = { lastPublication: '' };
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const mapped = mapRow(row, sheetConfig, context);
        if (mapped) rows.push(mapped);
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

async function upsertRows(rows, { dryRun = false } = {}) {
  if (dryRun) {
    return { imported: rows.length, updated: 0, skipped: 0, total: rows.length, dryRun: true };
  }

  let imported = 0;
  let updated = 0;

  for (const row of rows) {
    const filter = {
      sourceSheet: row.sourceSheet,
      publication: row.publication,
      journalistName: row.journalistName,
      contactEmail: row.contactEmail || '',
    };
    const existing = await MediaContact.findOne(filter).select('_id');
    if (existing) {
      await MediaContact.findByIdAndUpdate(existing._id, row);
      updated += 1;
    } else {
      await MediaContact.create(row);
      imported += 1;
    }
  }

  return {
    imported,
    updated,
    skipped: rows.length - imported - updated,
    total: rows.length,
  };
}

async function importMediaListFromFile({
  filePath,
  sheetConfig,
  dryRun = false,
} = {}) {
  if (!sheetConfig) {
    throw new Error('sheetConfig required for single-file import');
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`CSV not found: ${resolved}`);
  }

  const rows = await readCsvRows(resolved, sheetConfig);
  const stats = await upsertRows(rows, { dryRun });
  return { ...stats, sheet: sheetConfig.name, filePath: resolved };
}

async function importAllMediaSheets({
  dryRun = false,
  replace = false,
  sheets = MEDIA_SHEETS,
} = {}) {
  if (replace && !dryRun) {
    await MediaContact.deleteMany({
      sourceSheet: { $in: sheets.map((s) => s.name) },
    });
  }

  const results = [];
  let imported = 0;
  let updated = 0;
  let total = 0;

  for (const sheet of sheets) {
    const filePath = sheetFilePath(sheet);
    if (!fs.existsSync(filePath)) {
      results.push({ sheet: sheet.name, error: `Missing file: ${filePath}` });
      continue;
    }
    const result = await importMediaListFromFile({ filePath, sheetConfig: sheet, dryRun });
    results.push(result);
    imported += result.imported || 0;
    updated += result.updated || 0;
    total += result.total || 0;
  }

  return { imported, updated, total, sheets: results };
}

module.exports = {
  SPREADSHEET_ID,
  MEDIA_SHEETS,
  mapRow,
  readCsvRows,
  importMediaListFromFile,
  importAllMediaSheets,
};
