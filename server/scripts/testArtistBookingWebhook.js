#!/usr/bin/env node
/**
 * Live E2E: TSC website artist booking → CRM + booked calls + Akash assignee.
 * Usage: node server/scripts/testArtistBookingWebhook.js
 * Requires: API on TASKMASTER_BASE_URL (default http://127.0.0.1:5000)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { isBookedCallSource } = require('../../shared/dataInlets');
const { resolvePrimaryCallAssigneeId } = require('../utils/primaryCallAssignee');
const { processArtistEnquiryLogic } = require('../services/artistEnquiryService');

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const stamp = Date.now();
const TEST_EMAIL = `artist-booking-live-${stamp}@coreknot-test.local`;
const TEST_PHONE = `+919${String(stamp).slice(-9)}`;

async function verifyLead(leadId, akashId) {
  const lead = await Lead.findById(leadId).setOptions({ bypassTenant: true });
  if (!lead) throw new Error('Lead not found after webhook');
  if (lead.contactCategory !== 'booking_enquiry') {
    throw new Error(`Expected booking_enquiry, got ${lead.contactCategory}`);
  }
  if (!isBookedCallSource(lead.source)) {
    throw new Error(`Source "${lead.source}" not in booked-calls inlet`);
  }
  if (String(lead.assignedRepId) !== String(akashId)) {
    const rep = await User.findById(lead.assignedRepId).setOptions({ bypassTenant: true });
    throw new Error(`Expected Akash, got ${rep?.name || lead.assignedRepId}`);
  }
  return lead;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const akashId = await resolvePrimaryCallAssigneeId();
  if (!akashId) throw new Error('Akash not found — set PRIMARY_CALL_ASSIGNEE_ID');

  const akash = await User.findById(akashId).setOptions({ bypassTenant: true });
  console.log(`Assignee: ${akash?.name} (${akashId})`);

  const payload = {
    source: 'tsc-website',
    name: 'Live Artist Booking Test',
    organization: 'TSC Smoke Corp',
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    collaborationType: 'Corporate event',
    artist: 'YUGM',
    projectNature: 'Live performance',
    whenWhere: 'Mumbai, Aug 2026',
    scaleReach: '500 pax',
    logisticsSupport: 'Travel + stay',
    vision: 'High-energy set',
  };

  console.log('\n1) Sync processArtistEnquiryLogic...');
  const sync = await processArtistEnquiryLogic(payload);
  console.log('   →', sync);
  const lead1 = await verifyLead(sync.leadId, akashId);
  console.log('   ✓ Lead in CRM:', lead1.name, '| booked-calls source | Akash assigned');

  console.log('\n2) HTTP POST /api/webhooks/artist-enquiry...');
  const httpEmail = `artist-booking-http-${stamp}@coreknot-test.local`;
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET;
  if (secret) headers['X-Webhook-Secret'] = secret;

  const res = await fetch(`${BASE}/api/webhooks/artist-enquiry`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...payload, email: httpEmail, phone: `+919${String(stamp + 1).slice(-9)}`, name: 'HTTP Artist Booking Test' }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`   → ${res.status}`, body);

  let lead2 = null;
  if (res.status === 202) {
    console.log('   (queued — polling for lead up to 15s)');
    const deadline = Date.now() + 15000;
    while (!lead2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 1500));
      lead2 = await Lead.findOne({ email: httpEmail }).setOptions({ bypassTenant: true });
    }
  } else {
    lead2 = await Lead.findOne({ email: httpEmail }).setOptions({ bypassTenant: true });
  }
  if (!lead2 && body.leadId) lead2 = await Lead.findById(body.leadId).setOptions({ bypassTenant: true });
  if (!lead2) throw new Error('HTTP webhook did not create lead (check Redis worker + YUGM project)');

  await verifyLead(lead2._id, akashId);
  console.log('   ✓ HTTP lead verified');

  const bookedCount = await Lead.countDocuments({
    assignedRepId: akashId,
    $or: [
      { source: { $regex: /website artist enquiry|website booking/i } },
      { contactCategory: 'booking_enquiry' },
    ],
  }).setOptions({ bypassTenant: true });
  console.log(`\nAkash booked-call / artist-booking leads: ${bookedCount}`);

  console.log('\n✓ Artist booking E2E passed');
  console.log('  CRM → Bookings tab (artist users) or Leads with booking_enquiry filter');
  console.log('  Data Hub → Booked Calls folder');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
