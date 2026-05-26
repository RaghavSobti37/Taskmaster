const { google } = require('googleapis');
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

async function run() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.trim(),
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.get({
      spreadsheetId: '1AvRDNpmSJqQJ9Hom7kQttr0IPNnid9iut3H6XSsWQY8'
    });
    
    const tabs = response.data.sheets.map(s => s.properties.title);
    console.log(tabs);
  } catch(e) {
    console.error(e.message);
  }
}
run();
