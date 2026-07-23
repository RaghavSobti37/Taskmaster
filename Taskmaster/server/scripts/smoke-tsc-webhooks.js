#!/usr/bin/env node
/**
 * POST all TSC webhooks directly to Taskmaster.
 * Usage: node server/scripts/smoke-tsc-webhooks.js
 * Env: TASKMASTER_BASE_URL (default http://127.0.0.1:5000), plus *_WEBHOOK_SECRET from server/.env
 */
const fs = require('fs');
const path = require('path');

for (const envPath of [
  path.join(__dirname, '../.env'),
  path.join(__dirname, '../../../server/.env'),
]) {
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
    break;
  }
}

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const TEST_EMAIL = 'webhook.smoke@example.com';
const TEST_PHONE = '9876543210';

const slotDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
const yyyy = slotDate.getFullYear();
const mm = String(slotDate.getMonth() + 1).padStart(2, '0');
const dd = String(slotDate.getDate()).padStart(2, '0');
let hours = slotDate.getHours();
const minutes = String(slotDate.getMinutes()).padStart(2, '0');
const period = hours >= 12 ? 'PM' : 'AM';
hours = hours % 12 || 12;

const tests = [
  {
    name: 'book-call',
    path: '/api/webhooks/book-call',
    secretEnv: 'BOOK_CALL_WEBHOOK_SECRET',
    body: {
      source: 'tsc-website',
      name: 'Webhook Smoke Test',
      email: TEST_EMAIL,
      phone: TEST_PHONE,
      whatsapp: TEST_PHONE,
      course: 'Smoke Test Course',
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hours}:${minutes} ${period}`,
      timezone: 'Asia/Kolkata',
    },
  },
  {
    name: 'contact-lead',
    path: '/api/webhooks/contact-lead',
    secretEnv: 'ARTIST_ENQUIRY_WEBHOOK_SECRET',
    body: {
      source: 'TSC Website Contact',
      sourceSite: 'tsc-website',
      userType: 'brand',
      name: 'Webhook Smoke Test',
      email: TEST_EMAIL,
      phone: '+919876543210',
      company: 'TSC Smoke Test',
      message: 'Contact form smoke test',
      budget: '100k-500k',
    },
  },
  {
    name: 'artist-enquiry',
    path: '/api/webhooks/artist-enquiry',
    secretEnv: 'ARTIST_ENQUIRY_WEBHOOK_SECRET',
    body: {
      source: 'tsc-website',
      name: 'Webhook Smoke Test',
      organization: 'TSC Smoke Test',
      email: TEST_EMAIL,
      phone: '+919876543210',
      collaborationType: 'Live performance',
      artist: 'YUGM',
      projectNature: 'Corporate event',
      whenWhere: 'Mumbai, Q3 2026',
      scaleReach: '500 attendees',
      logisticsSupport: 'Sound + travel',
      vision: 'High-energy opening act',
    },
  },
  {
    name: 'artist-path',
    path: '/api/webhooks/artist-path',
    secretEnv: 'ARTIST_PATH_WEBHOOK_SECRET',
    body: {
      source: 'tsc-website',
      firstName: 'Webhook',
      lastName: 'Smoke',
      stageName: 'Smoke Artist',
      place: 'Mumbai',
      mobile: TEST_PHONE,
      email: TEST_EMAIL,
      artistIdentity: 'Singer-songwriter',
    },
  },
  {
    name: 'newsletter',
    path: '/api/webhooks/newsletter',
    secretEnv: 'NEWSLETTER_WEBHOOK_SECRET',
    body: {
      email: TEST_EMAIL,
      source: 'tsc-footer',
      sourceSite: 'tsc-website',
      subscribedAt: new Date().toISOString(),
    },
  },
  {
    name: 'masterclass-review',
    path: '/api/webhooks/masterclass-review',
    secretEnv: 'MASTERCLASS_REVIEW_WEBHOOK_SECRET',
    body: {
      source: 'tsc-website',
      campaign: 'review01',
      firstName: 'Webhook',
      lastName: 'Smoke',
      registeredMobile: TEST_PHONE,
      registeredEmail: TEST_EMAIL,
      artistTypes: 'Singer',
      completion: '90%',
      oneLineExperience: 'Great masterclass smoke test',
      improvementSuggestion: 'More live demos',
      weightedRating: 5,
      rating: 5,
    },
  },
];

async function runOne(test) {
  const secret = process.env[test.secretEnv];
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Webhook-Secret'] = secret;

  const res = await fetch(`${BASE}${test.path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(test.body),
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.status === 200 || res.status === 202;
  console.log(`${ok ? '✓' : '✗'} ${test.name} → ${res.status}`, body);
  return ok;
}

(async () => {
  console.log(`Smoke target: ${BASE}`);
  let passed = 0;
  for (const test of tests) {
    if (await runOne(test)) passed += 1;
  }
  console.log(`\n${passed}/${tests.length} passed`);
  process.exit(passed === tests.length ? 0 : 1);
})();
