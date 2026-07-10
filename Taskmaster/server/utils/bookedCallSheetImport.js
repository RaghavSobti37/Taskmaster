/**
 * Read TSC website BookedCalls Google Sheet rows.
 */
const { google } = require('googleapis');

const DEFAULT_SPREADSHEET_ID = '1AvRDNpmSJqQJ9Hom7kQttr0IPNnid9iut3H6XSsWQY8';
const DEFAULT_SHEET_TAB = 'BookedCalls';

function normalizeHeader(value) {
  return String(value || '').toLowerCase().trim().replace(/[\s_-]+/g, '');
}

function pickField(row, headers, aliases) {
  for (const alias of aliases) {
    const idx = headers.findIndex((h) => h === alias || h.includes(alias));
    if (idx >= 0 && row[idx] != null && String(row[idx]).trim() !== '') {
      return String(row[idx]).trim();
    }
  }
  return '';
}

function parseSheetRow(headers, row) {
  const name = pickField(row, headers, ['name', 'fullname', 'full name', 'customername']);
  const email = pickField(row, headers, ['email', 'emailaddress']);
  const phone = pickField(row, headers, ['whatsapp', 'phone', 'mobile', 'phonenumber']);
  const course = pickField(row, headers, ['course', 'coursename', 'program', 'interest']);
  const date = pickField(row, headers, ['date', 'scheduleddate', 'bookingdate', 'slotdate']);
  const time = pickField(row, headers, ['time', 'scheduledtime', 'bookingtime', 'slottime']);
  const timezone = pickField(row, headers, ['timezone', 'tz']) || 'Asia/Kolkata';

  if (!name || (!email && !phone) || !date || !time) return null;

  return {
    source: 'tsc-website-sheet',
    name,
    email: email || undefined,
    phone: phone || undefined,
    whatsapp: phone || undefined,
    course: course || 'Website Booking',
    date,
    time,
    timezone,
  };
}

async function fetchBookedCallsFromSheet(options = {}) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !privateKey) {
    return { rows: [], skipped: 'missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY' };
  }

  const spreadsheetId = options.spreadsheetId
    || process.env.BOOKED_CALLS_SPREADSHEET_ID
    || process.env.SPREADSHEET_ID
    || DEFAULT_SPREADSHEET_ID;
  const sheetTab = options.sheetTab || process.env.BOOKED_CALLS_SHEET_TAB || DEFAULT_SHEET_TAB;

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  let tabName = sheetTab;
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const titles = (meta.data.sheets || []).map((s) => s.properties?.title).filter(Boolean);
    if (!titles.includes(tabName)) {
      tabName = titles.find((t) => /booked/i.test(t)) || titles[0];
    }
  } catch (err) {
    return { rows: [], skipped: `sheet meta failed: ${err.message}` };
  }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName.replace(/'/g, "''")}'`,
  });
  const values = res.data.values || [];
  if (values.length < 2) return { rows: [], tabName, spreadsheetId };

  const headers = values[0].map(normalizeHeader);
  const rows = [];
  for (let i = 1; i < values.length; i += 1) {
    const parsed = parseSheetRow(headers, values[i]);
    if (parsed) rows.push(parsed);
  }
  return { rows, tabName, spreadsheetId };
}

module.exports = {
  DEFAULT_SPREADSHEET_ID,
  DEFAULT_SHEET_TAB,
  fetchBookedCallsFromSheet,
  parseSheetRow,
};
