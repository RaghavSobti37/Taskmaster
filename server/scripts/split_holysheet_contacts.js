const axios = require('axios');

const API_KEY = process.env.HOLYSHEET_API_KEY || 'A4NWMO7Hr9zJGlf1epJAOGzp0mzBfLMH';
const BASE_URL = 'https://holysheet.soneshjain.com/api/v1';

// List of tabs you want to process.
const TABS = [
  'All Data Backup',
  'Sheet1',
  'Sheet2',
  'Sheet3',
  'Leads',
  'Contacts',
  'Main',
  'Artists',
  'Form Responses 1',
  'PR Contacts'
];

// The headers matching HolySheet. 
// We will fetch the first row to determine headers dynamically to be safe.
async function processTab(sheetName) {
  console.log(`\n--- Processing Tab: ${sheetName} ---`);
  
  try {
    const getRes = await axios.get(`${BASE_URL}/${API_KEY}/rows`, { params: { sheet: sheetName } });
    const rows = getRes.data?.data || [];
    
    if (rows.length === 0) {
      console.log('No rows found in sheet.');
      return;
    }

    // Determine columns from the first row
    const headers = Object.keys(rows[0]).filter(k => k !== '_rowNum' && k !== '_id'); 
    
    let updatedCount = 0;
    let appendedCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawEmail = row.email ? String(row.email) : '';
      const rawPhone = row.phone ? String(row.phone) : '';

      // Check if separator exists
      const hasSeparator = /[,;/]/.test(rawEmail) || /[,;/]/.test(rawPhone);
      
      if (hasSeparator) {
        const emails = rawEmail.split(/[,;/]/).map(s => s.trim()).filter(Boolean);
        const phones = rawPhone.split(/[,;/]/).map(s => s.trim()).filter(Boolean);

        // If after splitting we actually have multiple
        if (emails.length > 1 || phones.length > 1) {
          console.log(`Found multi-value row (Row ${i + 2}): Email: ${rawEmail} | Phone: ${rawPhone}`);
          
          const maxLen = Math.max(emails.length || 1, phones.length || 1);
          
          // 1. Update the original row with the first value
          const firstEmail = emails[0] || '';
          const firstPhone = phones[0] || '';
          
          try {
            await axios.patch(`${BASE_URL}/${API_KEY}/rows`, {
              sheet: sheetName,
              rowIndex: i + 2, // HolySheet uses 1-based indexing, and row 1 is header
              values: {
                ...row,
                email: firstEmail,
                phone: firstPhone
              }
            });
            updatedCount++;
            console.log(`  -> Patched original row ${i + 2} with ${firstEmail} | ${firstPhone}`);
          } catch (e) {
            console.error(`  -> Failed to patch row ${i + 2}:`, e.message);
          }

          // 2. Create new rows for the rest of the values
          for (let j = 1; j < maxLen; j++) {
            const nextEmail = emails[j] || '';
            const nextPhone = phones[j] || '';
            
            const newRowValues = headers.map(h => {
              if (h === 'email') return nextEmail;
              if (h === 'phone') return nextPhone;
              return row[h] || '';
            });

            try {
              await axios.post(`${BASE_URL}/${API_KEY}/rows`, { rows: [newRowValues] }, { params: { sheet: sheetName } });
              appendedCount++;
              console.log(`  -> Appended new row for ${nextEmail} | ${nextPhone}`);
            } catch (e) {
              console.error(`  -> Failed to append new row:`, e.message);
            }
          }
        }
      }
    }
    
    console.log(`Finished processing ${sheetName}. Updated ${updatedCount} rows, Appended ${appendedCount} rows.`);

  } catch (err) {
    console.error(`Error fetching rows for tab ${sheetName}:`, err.response ? err.response.data : err.message);
  }
}

async function run() {
  for (const tab of TABS) {
    await processTab(tab);
  }
  console.log('\nAll tabs processed.');
}

run();
