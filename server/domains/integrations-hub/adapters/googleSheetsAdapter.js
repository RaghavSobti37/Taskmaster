const { google } = require('googleapis');
const gmailAdapter = require('./gmailAdapter');

function oauthClient(credentials) {
  const { clientId, clientSecret } = gmailAdapter.getClientCreds();
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
    expiry_date: credentials.expiresAt ? new Date(credentials.expiresAt).getTime() : undefined,
  });
  return client;
}

function parseSpreadsheetId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const match = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return raw;
  return null;
}

module.exports = {
  id: 'google_sheets',
  getClientCreds: gmailAdapter.getClientCreds,
  handleCallback: gmailAdapter.handleCallback,
  refreshToken: gmailAdapter.refreshToken,
  parseSpreadsheetId,
  async healthCheck(credentials) {
    const auth = oauthClient(credentials);
    const drive = google.drive({ version: 'v3', auth });
    await drive.files.list({
      pageSize: 1,
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id)',
    });
    return { ok: true };
  },
  async listSpreadsheets(credentials, { pageSize = 25 } = {}) {
    const auth = oauthClient(credentials);
    const drive = google.drive({ version: 'v3', auth });
    const { data } = await drive.files.list({
      pageSize,
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id,name,modifiedTime)',
      orderBy: 'modifiedTime desc',
    });
    return data.files || [];
  },
  async getSpreadsheetMeta(credentials, spreadsheetId) {
    const auth = oauthClient(credentials);
    const sheets = google.sheets({ version: 'v4', auth });
    const { data } = await sheets.spreadsheets.get({ spreadsheetId });
    return {
      title: data.properties?.title,
      sheets: (data.sheets || []).map((s) => ({
        title: s.properties?.title,
        sheetId: s.properties?.sheetId,
      })),
    };
  },
  async getSheetHeaders(credentials, spreadsheetId, sheetName) {
    const auth = oauthClient(credentials);
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `'${String(sheetName).replace(/'/g, "''")}'!1:1`;
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return (data.values?.[0] || []).map((h) => String(h || '').trim());
  },
  async readRows(credentials, spreadsheetId, range) {
    const auth = oauthClient(credentials);
    const sheets = google.sheets({ version: 'v4', auth });
    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return data.values || [];
  },
  async appendRow(credentials, spreadsheetId, sheetName, rowValues) {
    const auth = oauthClient(credentials);
    const sheets = google.sheets({ version: 'v4', auth });
    const range = `'${String(sheetName).replace(/'/g, "''")}'!A:Z`;
    const { data } = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rowValues] },
    });
    return data;
  },
};
