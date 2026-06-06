const axios = require('axios');
const CRMImport = require('../models/CRMImport');
const ArtistPathResponse = require('../models/ArtistPathResponse');
const PersonIdentityService = require('./PersonIdentityService');
const PersonHubBuilder = require('./PersonHubBuilder');
const ContactService = require('./ContactService');
const { mapRowToArtistPath, ARTIST_PATH_SHEET_ID, displayArtistLabel } = require('../../shared/artistPathSchema.cjs');
const logger = require('../utils/logger');

const HOLYSHEET_BASE = 'https://holysheet.soneshjain.com/api/v1';

function getArtistPathApiKey() {
  return process.env.HOLYSHEET_ARTIST_PATH_API_KEY
    || process.env.HOLYSHEET_API_KEY
    || process.env.HOLY_SHEET_API_KEY
    || '';
}

/** Normalize website webhook JSON → HolySheet-style row keys */
function normalizeWebhookPayload(data = {}) {
  const row = { ...data };
  const aliases = {
    fullName: 'FullName',
    stageName: 'StageName',
    place: 'Place',
    mobile: 'Mobile',
    email: 'Email',
    timestamp: 'Timestamp',
    artistIdentity: 'ArtistIdentity',
    instagram: 'Instagram',
    spotify: 'Spotify',
    youtube: 'Youtube',
  };
  for (const [from, to] of Object.entries(aliases)) {
    if (row[from] != null && row[from] !== '' && !row[to]) row[to] = row[from];
  }
  return row;
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

async function fetchSheetRows() {
  return fetchHolySheetRows();
}

/**
 * Upsert one Artist Path response + Person spine (webhook or sheet row).
 * @returns {Promise<{ personId, responseId, email, name }|null>}
 */
async function upsertArtistPathRow(rawRow, { source = 'artist_path_sheet', sheetRowIdOverride } = {}) {
  const row = source === 'artist_path_webhook' ? normalizeWebhookPayload(rawRow) : rawRow;
  const { identity, answers, submittedAt, rowId, rawRow: mappedRaw } = mapRowToArtistPath(row);
  const email = identity.email || answers.email;
  const phone = identity.phone || answers.phone;
  const name = identity.name || answers.name || 'Anonymous';
  if (!email && !phone) return null;

  const resolved = await PersonIdentityService.resolvePerson(
    { name, email, phone, city: identity.city },
    { source: 'artist_path' }
  );
  if (!resolved) return null;

  const sheetRowId = sheetRowIdOverride
    || rowId
    || row.rowId
    || row._id
    || row.id
    || `${email || phone}|${submittedAt?.toISOString?.() || Date.now()}`;
  const mergedAnswers = { ...answers, name, email, phone, city: identity.city };

  const doc = await ArtistPathResponse.findOneAndUpdate(
    { sheetRowId: String(sheetRowId) },
    {
      $set: {
        personId: resolved.personId,
        submittedAt: submittedAt || new Date(),
        answers: mergedAnswers,
        rawRow: mappedRaw,
        source,
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
  await PersonHubBuilder.rebuildPerson(resolved.personId);

  return {
    personId: resolved.personId,
    responseId: doc._id,
    email,
    name,
    sheetRowId: String(sheetRowId),
  };
}

async function processArtistPathWebhook(data) {
  const payload = data?.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? data.data
    : data;
  const result = await upsertArtistPathRow(payload, { source: 'artist_path_webhook' });
  if (!result) {
    throw new Error('Missing required identity: email or phone');
  }
  return { success: true, message: 'Artist Path response recorded', ...result };
}

async function importRows(rows, { userId, filename = 'artist_path_holysheet_sync' } = {}) {
  const importSession = userId
    ? await CRMImport.create({
      filename,
      leadCount: rows.length,
      createdBy: userId,
    })
    : null;

  let imported = 0;
  for (let i = 0; i < rows.length; i++) {
    const result = await upsertArtistPathRow(rows[i], { source: 'artist_path_sheet' });
    if (!result) continue;
    if (importSession) {
      await ArtistPathResponse.updateOne(
        { _id: result.responseId },
        { $set: { importId: importSession._id } }
      );
    }
    imported++;
  }

  return { importId: importSession?._id, imported, total: rows.length };
}

async function syncFromSheet(options = {}) {
  const rows = await fetchSheetRows();
  if (!rows.length) {
    return {
      imported: 0,
      total: 0,
      message: 'No rows fetched — check HOLYSHEET_ARTIST_PATH_API_KEY in server/.env',
    };
  }
  return importRows(rows, { ...options, filename: 'artist_path_holysheet_sync' });
}

module.exports = {
  fetchSheetRows,
  fetchHolySheetRows,
  upsertArtistPathRow,
  processArtistPathWebhook,
  importRows,
  syncFromSheet,
  normalizeWebhookPayload,
  ARTIST_PATH_SHEET_ID,
};
