const axios = require('axios');
const BASE_URL = 'https://holysheet.soneshjain.com/api/v1';

const HEADERS = [
  'rowId', 'customerIdExly', 'transactionIdExly', 'name', 'email', 'phone', 'city',
  'webinarDates', 'attended', 'attendanceDurationMin', 'qnaAnswered', 
  'artistType', 'fullTimeWillingness', 'primaryRole', 'learningGoal', 
  'learnedMusic', 'currentJourney', 'meaningfulConnect', 'leadQuality', 
  'callStatus', 'leadStatus', 'remarks', 'source', 'planOption', 
  'nextFollowupDate', 'nextFollowupTime', 'assignedRepId', '_id', 
  'createdAt', 'updatedAt'
];

const extractCell = (doc, key) => {
  if (!doc) return '';
  const val = doc[key];
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.toString();
  return String(val);
};

exports.syncLeadToSheet = async (leadDoc) => {
  try {
    const apiKey = process.env.HOLYSHEET_API_KEY || process.env.HOLY_SHEET_API_KEY || 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
    if (!apiKey) return;

    const sheetName = 'All Data Backup';

    // 1. Construct values object
    const values = {};
    for (const h of HEADERS) {
      values[h] = extractCell(leadDoc, h);
    }

    // 2. Fetch existing rows to check for match
    let rows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      rows = getRes.data?.data || [];
    } catch (err) {
      console.warn('[HolySheet Backup Warn] Failed to fetch rows, attempting append. Error:', err.message);
    }

    let targetIndex = -1;
    const docId = leadDoc._id ? String(leadDoc._id).trim() : '';
    const docEmail = leadDoc.email ? String(leadDoc.email).trim().toLowerCase() : '';
    const docPhone = leadDoc.phone ? String(leadDoc.phone).trim() : '';
    const docRowId = leadDoc.rowId ? String(leadDoc.rowId).trim() : '';

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const sheetId = row['_id'] ? String(row['_id']).trim() : '';
      const sheetEmail = row['email'] ? String(row['email']).trim().toLowerCase() : '';
      const sheetPhone = row['phone'] ? String(row['phone']).trim() : '';
      const sheetRowId = row['rowId'] ? String(row['rowId']).trim() : '';

      if (sheetId && docId && sheetId === docId) { targetIndex = i; break; }
      if (docEmail && sheetEmail === docEmail) { targetIndex = i; break; }
      if (!docEmail && docPhone && sheetPhone === docPhone) { targetIndex = i; break; }
      if (!docEmail && !docPhone && docRowId && sheetRowId === docRowId) { targetIndex = i; break; }
    }

    if (targetIndex !== -1) {
      // Update specific row (1-indexed row number is targetIndex + 2 since 1 is header)
      const rowIndex = targetIndex + 2;
      await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
        sheet: sheetName,
        rowIndex,
        values
      });
      console.log(`[HolySheet Backup] Successfully updated lead ${leadDoc.name} on row ${rowIndex}`);
    } else {
      // Append new row as pure values array to avoid pushing column names
      const rowValues = HEADERS.map(h => extractCell(leadDoc, h));
      await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [rowValues] }, { params: { sheet: sheetName } });
      console.log(`[HolySheet Backup] Successfully appended new lead ${leadDoc.name} to HolySheet`);
    }

  } catch (error) {
    console.error('[HolySheet Backup Error]', error.message, error.response?.data || '');
  }
};

exports.backupAllLeads = async () => {
  try {
    const apiKey = process.env.HOLYSHEET_API_KEY || process.env.HOLY_SHEET_API_KEY || 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
    if (!apiKey) return;
    const sheetName = 'All Data Backup';
    const Lead = require('../models/Lead');
    const leads = await Lead.find({}).lean();
    console.log(`[HolySheet Backup] Found ${leads.length} leads in database. Starting batch sync...`);

    // Fetch existing rows
    let existingRows = [];
    try {
      const getRes = await axios.get(`${BASE_URL}/${apiKey}/rows`, { params: { sheet: sheetName } });
      existingRows = getRes.data?.data || [];
      if (existingRows.length === 0 && (getRes.data?.count === 0 || !getRes.data)) {
        await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: [HEADERS] }, { params: { sheet: sheetName } });
        console.log('[HolySheet Backup] Initialized header row on empty sheet.');
      }
    } catch (err) {
      console.warn('[HolySheet Backup Warn] Check header error:', err.message);
    }

    const existingCount = existingRows.length;
    console.log(`[HolySheet Backup] Existing rows count: ${existingCount}`);

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (i < existingCount) {
        const values = {};
        for (const h of HEADERS) values[h] = extractCell(lead, h);
        await axios.patch(`${BASE_URL}/${apiKey}/rows`, {
          sheet: sheetName,
          rowIndex: i + 2,
          values
        });
      } else {
        const remainingLeads = leads.slice(i);
        console.log(`[HolySheet Backup] Batch posting remaining ${remainingLeads.length} leads...`);
        const batches = [];
        for (let j = 0; j < remainingLeads.length; j += 100) {
          batches.push(remainingLeads.slice(j, j + 100));
        }
        for (let k = 0; k < batches.length; k++) {
          const batch = batches[k];
          const rowsToAppend = batch.map(l => HEADERS.map(h => extractCell(l, h)));
          await axios.post(`${BASE_URL}/${apiKey}/rows`, { rows: rowsToAppend }, { params: { sheet: sheetName } });
          console.log(`[HolySheet Backup] Batch ${k + 1}/${batches.length} successfully appended.`);
        }
        break;
      }
    }
    console.log('[HolySheet Backup] Batch sync complete.');
  } catch (err) {
    console.error('[HolySheet Backup Batch Error]', err.message);
  }
};
