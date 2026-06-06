const axios = require('axios');
const csv = require('csv-parser');
const { Readable } = require('stream');
const CRMImport = require('../models/CRMImport');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const PersonIdentityService = require('./PersonIdentityService');
const PersonHubBuilder = require('./PersonHubBuilder');
const ContactService = require('./ContactService');
const { mapRowToArtistPath, ARTIST_PATH_SHEET_ID, displayArtistLabel } = require('../../shared/artistPathSchema.cjs');
const logger = require('../utils/logger');

const HOLYSHEET_BASE = 'https://holysheet.soneshjain.com/api/v1';
const SHEET_EXPORT_URL = `https://docs.google.com/spreadsheets/d/${ARTIST_PATH_SHEET_ID}/export?format=csv&gid=0`;

function getArtistPathApiKey() {
  return process.env.HOLYSHEET_ARTIST_PATH_API_KEY
    || process.env.HOLYSHEET_API_KEY
    || process.env.HOLY_SHEET_API_KEY
    || '';
}

async function fetchHolySheetRows() {
  const apiKey = getArtistPathApiKey();
  if (!apiKey) return [];

  const sheetName = process.env.HOLYSHEET_ARTIST_PATH_SHEET || undefined;
  try {
    const params = sheetName ? { sheet: sheetName } : {};
    const res = await axios.get(`${HOLYSHEET_BASE}/${apiKey}/rows`, {
      params,
      timeout: 45000,
    });
    const rows = res.data?.data || [];
    logger.info('artistPathImport', 'HolySheet fetch ok', { count: rows.length, sheet: res.data?.sheet || sheetName || 'default' });
    return rows;
  } catch (err) {
    logger.warn('artistPathImport', 'HolySheet fetch failed', {
      error: err.message,
      status: err.response?.status,
    });
    return [];
  }
}

async function fetchCsvRows() {
  try {
    const res = await axios.get(SHEET_EXPORT_URL, { responseType: 'text', timeout: 30000 });
    const rows = [];
    await new Promise((resolve, reject) => {
      Readable.from([res.data])
        .pipe(csv())
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });
    return rows;
  } catch (err) {
    logger.warn('artistPathImport', 'Google CSV export failed', { error: err.message });
    return [];
  }
}

async function fetchSheetRows() {
  const holyRows = await fetchHolySheetRows();
  if (holyRows.length) return holyRows;
  return fetchCsvRows();
}

async function importRows(rows, { userId, filename = 'artist_path_sheet.csv' } = {}) {
  const importSession = userId
    ? await CRMImport.create({
      filename,
      leadCount: rows.length,
      createdBy: userId,
    })
    : null;

  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { identity, answers, submittedAt, rowId, rawRow } = mapRowToArtistPath(row);
    const email = identity.email || answers.email;
    const phone = identity.phone || answers.phone;
    const name = identity.name || answers.name || 'Anonymous';
    if (!email && !phone) continue;

    const resolved = await PersonIdentityService.resolvePerson(
      { name, email, phone, city: identity.city },
      { source: 'artist_path' }
    );
    if (!resolved) continue;

    const sheetRowId = rowId || row.rowId || row._id || row.id || `row-${i}-${email || phone}`;
    const mergedAnswers = { ...answers, name, email, phone, city: identity.city };

    const doc = await ArtistPathResponse.findOneAndUpdate(
      { sheetRowId: String(sheetRowId) },
      {
        $set: {
          personId: resolved.personId,
          submittedAt: submittedAt || new Date(),
          importId: importSession?._id,
          answers: mergedAnswers,
          rawRow,
          source: 'artist_path_sheet',
        },
      },
      { upsert: true, new: true }
    );

    await PersonIdentityService.linkSource(resolved.personId, 'artist_path', doc._id, mergedAnswers);
    await ContactService.mergeContact({
      name,
      email,
      phone,
      city: identity.city,
      recordId: doc._id,
      summary: { ...mergedAnswers, artistType: displayArtistLabel(mergedAnswers) },
      inletKey: 'artist_path',
    }, 'artist_path');
    imported++;
  }

  const personIds = new Set();
  const responseQuery = importSession?._id
    ? { importId: importSession._id }
    : { updatedAt: { $gte: new Date(Date.now() - 60000) } };
  const responses = await ArtistPathResponse.find(responseQuery).select('personId').lean();
  for (const r of responses) personIds.add(String(r.personId));
  for (const pid of personIds) {
    await PersonHubBuilder.rebuildPerson(pid);
  }

  return { importId: importSession?._id, imported, total: rows.length };
}

async function syncFromSheet(options = {}) {
  const rows = await fetchSheetRows();
  if (!rows.length) {
    return {
      imported: 0,
      total: 0,
      message: 'No rows fetched — set HOLYSHEET_ARTIST_PATH_API_KEY in server/.env or use CSV upload',
    };
  }
  return importRows(rows, { ...options, filename: 'artist_path_holysheet_sync' });
}

module.exports = {
  fetchSheetRows,
  fetchHolySheetRows,
  importRows,
  syncFromSheet,
  SHEET_EXPORT_URL,
};
