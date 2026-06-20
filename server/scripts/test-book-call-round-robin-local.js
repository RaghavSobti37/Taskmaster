#!/usr/bin/env node
/**
 * Local integration: verify sales round-robin against MongoDB.
 * Usage: node server/scripts/test-book-call-round-robin-local.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const {
  listSalesDepartmentReps,
  assignNextBookedCallRep,
  pickNextRepFromList,
} = require('../utils/bookedCallRepAssignment');

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri.trim());

  const reps = await listSalesDepartmentReps();
  console.log(`Sales reps in pool (${reps.length}):`);
  for (const r of reps) {
    console.log(`  - ${r.name} (${r.repId || 'no repId'}) phone=${r.phone ? 'yes' : 'MISSING'}`);
  }

  if (!reps.length) {
    console.error('No sales department users — add users to sales dept in Admin.');
    process.exit(1);
  }

  const simulated = [];
  let last = null;
  for (let i = 0; i < Math.min(5, reps.length * 2); i += 1) {
    const next = pickNextRepFromList(reps, last);
    const rep = reps.find((r) => String(r._id) === String(next));
    simulated.push(rep?.name || String(next));
    last = next;
  }
  console.log('\nSimulated rotation:', simulated.join(' → '));

  const live = [];
  for (let i = 0; i < Math.min(5, reps.length * 2); i += 1) {
    const id = await assignNextBookedCallRep();
    const rep = reps.find((r) => String(r._id) === String(id));
    live.push(rep?.name || String(id));
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log('Live assignNextBookedCallRep:', live.join(' → '));

  const uniqueLive = new Set(live);
  if (reps.length > 1 && uniqueLive.size < 2) {
    console.error('\nFAIL: round-robin did not rotate across multiple reps');
    process.exit(1);
  }

  const missingPhone = reps.filter((r) => !String(r.phone || '').trim());
  if (missingPhone.length) {
    console.warn('\nReps missing phone (WhatsApp alerts will skip until set in Admin → Users):');
    missingPhone.forEach((r) => console.warn(`  - ${r.name}`));
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
