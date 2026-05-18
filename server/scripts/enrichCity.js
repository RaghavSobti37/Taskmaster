const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const csv = require('csv-parser');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Lead = require('../models/Lead');
const { normalizePhone } = require('../utils/sanitizer');

const CSV_FILE = path.join(__dirname, '../../ULTIMATE_MASTER_DATA_CLEANED.csv');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('Connected to MongoDB. Starting City enrichment...');

  const cityMap = new Map();

  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (row) => {
      const city = (row.City || row.city || '').trim();
      if (!city || city === 'N/A') return;

      const email = (row.Email || row.email || '').trim().toLowerCase();
      const phone = normalizePhone(row.Phone || row.phone || '');

      if (email) cityMap.set(`email:${email}`, city);
      if (phone && phone !== '0000000000') cityMap.set(`phone:${phone}`, city);
    })
    .on('end', async () => {
      console.log(`Loaded ${cityMap.size} lookup entries from master data. Updating leads in CRM...`);

      const leads = await Lead.find({});
      let updatedCount = 0;

      for (const lead of leads) {
        if (!lead.city || lead.city === 'N/A' || lead.city.trim() === '') {
          const emailKey = lead.email ? `email:${lead.email.trim().toLowerCase()}` : '';
          const phoneKey = lead.phone ? `phone:${normalizePhone(lead.phone)}` : '';

          const foundCity = (emailKey && cityMap.get(emailKey)) || (phoneKey && cityMap.get(phoneKey));

          if (foundCity && foundCity !== lead.city) {
            lead.city = foundCity;
            await lead.save();
            updatedCount++;
          }
        }
      }

      console.log(`City enrichment complete. Updated ${updatedCount} leads.`);
      process.exit(0);
    });
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
