const { google } = require('googleapis');

exports.fetchAll = async (req, res) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1AvRDNpmSJqQJ9Hom7kQttr0IPNnid9iut3H6XSsWQY8';

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabNames = meta.data.sheets.map((s) => s.properties.title);

    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: tabNames.map((t) => `'${t}'!A:Z`),
    });

    const results = [];
    batch.data.valueRanges.forEach((rangeData, i) => {
      const tabName = tabNames[i];
      const rows = rangeData.values || [];
      if (rows.length < 2) return;
      const headers = rows[0].map((h) => String(h).toLowerCase().trim());
      const emailIdx = headers.findIndex((h) => h.includes('email'));
      if (emailIdx === -1) return;

      const nameIdx = headers.findIndex((h) => h === 'name' || h.includes('first name'));

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const email = row[emailIdx];
        if (email && email.includes('@')) {
          const rowData = {};
          headers.forEach((h, idx) => {
            if (!h) return;
            rowData[h] = row[idx] != null ? String(row[idx]).trim() : '';
          });
          results.push({
            name: nameIdx !== -1 ? (row[nameIdx] || '') : '',
            email: email.trim(),
            source: tabName,
            rowData,
          });
        }
      }
    });

    res.json(results);
  } catch (err) {
    console.error('Fetch HolySheet all error:', err);
    res.status(500).json({ error: err.message });
  }
};
