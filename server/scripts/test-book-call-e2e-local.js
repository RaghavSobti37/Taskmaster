#!/usr/bin/env node
/**
 * End-to-end book-call assignment test (local code → production Mongo via .env).
 * Creates real CRM leads with skipNotifications. Usage:
 *   node server/scripts/test-book-call-e2e-local.js
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { processBookedCallLogic } = require('../controllers/webhookController');
const { runWithDefaultWebhookTenant } = require('../utils/webhookTenantContext');

function slot(run) {
  const slotDate = new Date(Date.now() + (3 + run) * 60 * 60 * 1000);
  const yyyy = slotDate.getFullYear();
  const mm = String(slotDate.getMonth() + 1).padStart(2, '0');
  const dd = String(slotDate.getDate()).padStart(2, '0');
  let hours = slotDate.getHours();
  const minutes = String(slotDate.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const uid = crypto.randomBytes(4).toString('hex');
  const tail = String(1000 + run).padStart(4, '0');

  const digits = `${Date.now()}${run}`.replace(/\D/g, '').slice(-9);
  const phone = `+919${digits.padStart(9, '8')}`;

  return {
    name: `RR E2E ${uid}-${run}`,
    email: `rr.e2e.${uid}.${run}@example.com`,
    phone,
    whatsapp: phone,
    course: 'Round Robin E2E',
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hours}:${minutes} ${period}`,
    timezone: 'Asia/Kolkata',
    source: 'tsc-website',
  };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri.trim());

  const assignees = [];
  for (let i = 1; i <= 4; i += 1) {
    const result = await runWithDefaultWebhookTenant(() =>
      processBookedCallLogic(slot(i), {
        skipNotifications: true,
        skipSlotValidation: false,
      })
    );
    assignees.push(result.assignedRepName || result.assignedRepId);
    console.log(`booking ${i}: rep=${result.assignedRepName} leadId=${result.leadId}`);
  }

  const unique = new Set(assignees.map(String));
  console.log(`\nUnique reps: ${unique.size} → ${[...unique].join(', ')}`);

  if (unique.size < 2) {
    console.error('FAIL: expected rotation across 2+ sales reps');
    process.exit(1);
  }

  await mongoose.disconnect();
  console.log('PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
