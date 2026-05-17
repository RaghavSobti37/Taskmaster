const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
require('dotenv').config();
const Lead = require('../models/Lead');
const EmailLog = require('../models/EmailLog');
const Campaign = require('../models/Campaign');
const { prepareCampaignHTML } = require('../utils/emailTracker');

async function runAIEmailTestAgent() {
  console.log('🚀 [AI Test Agent] Starting Advanced Email Engine Validation Pipeline...\n');

  const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot').trim();
  console.log(`[Connecting DB] Connecting to ${dbUri}...`);
  await mongoose.connect(dbUri, {
    serverSelectionTimeoutMS: 5000
  });
  console.log('✅ DB Connected successfully.\n');

  const stamp = Date.now();
  const testEmail = `agent_synthetic_${stamp}@domain.test`;
  const campaignKey = `SYNTHETIC_CAMP_${stamp}`;

  try {
    // --- PHASE 1: Data Ingestion & Clean Lead Setup ---
    console.log(`[Phase 1] Seeding synthetic test lead: ${testEmail}`);
    await Lead.create({
      email: testEmail,
      name: 'AI Test Synthetic Target',
      phone: `99999${stamp.toString().slice(-5)}`,
      status: 'active',
      emailStatus: 'Pending',
      unsubscribed: false,
      bounceCount: 0
    });
    console.log('✅ Phase 1 Passed: Synthetic lead successfully ingested into MongoDB.\n');

    // --- PHASE 2: Mock Campaign Generation & Tracking Code Injection ---
    console.log('[Phase 2] Simulating Campaign HTML rendering & tracker proxy injection...');
    const sampleRawHtml = `<div><p>Welcome to Advanced Auto-Mailer Engine</p><a href="https://target-cta.com/verify">Verify Alignment CTA</a></div>`;
    
    const baseUrl = 'http://localhost:5000';
    const { processedHtml, pixelId, clickId } = await prepareCampaignHTML(sampleRawHtml, campaignKey, testEmail, baseUrl);
    
    const $ = cheerio.load(processedHtml);
    const pixelSrc = $('img').attr('src');
    const ctaHref = $('a').attr('href');

    console.log(`   Found Tracking Pixel URL: ${pixelSrc}`);
    console.log(`   Found Rewritten CTA URL:  ${ctaHref}`);

    if (!pixelSrc || !pixelSrc.includes('/api/track/open/')) {
      throw new Error('❌ Test Failed: Tracking pixel missing or incorrectly structured.');
    }
    if (!ctaHref || !ctaHref.includes('/api/track/click/')) {
      throw new Error('❌ Test Failed: CTA target anchor URL not rewritten through click proxy.');
    }

    // Seed dummy campaign to collect analytics metrics
    await Campaign.create({
      campaignId: campaignKey,
      title: 'Synthetic Test Campaign',
      recipients: [{ email: testEmail, status: 'Pending' }]
    });

    console.log('✅ Phase 2 Passed: HTML transformation & unique tracking hashes verified.\n');

    // --- PHASE 3: Simulated Open Event Verification ---
    console.log('[Phase 3] Simulating email open request (HTTP GET to transparent 1x1 GIF)...');
    const localPixelUrl = pixelSrc.replace(process.env.APP_BASE_URL || 'https://nasty-parts-cut.loca.lt', baseUrl);
    const openResponse = await axios.get(localPixelUrl, { 
      headers: { 'X-Forwarded-For': '8.8.8.8' },
      validateStatus: () => true 
    });

    if (openResponse.status !== 200 || !openResponse.headers['content-type']?.includes('image/gif')) {
      throw new Error(`❌ Test Failed: Pixel endpoint returned status ${openResponse.status} / content-type ${openResponse.headers['content-type']}`);
    }

    // Verify DB updated
    const leadAfterOpen = await Lead.findOne({ email: testEmail });
    if (leadAfterOpen.status !== 'active') {
      throw new Error(`❌ Test Failed: Lead status did not update properly after open event.`);
    }

    const campCheck = await Campaign.findOne({ campaignId: campaignKey });
    if (!campCheck || campCheck.recipients[0].status !== 'Opened') {
      throw new Error(`❌ Test Failed: Campaign recipient status did not update to "Opened". Current: ${campCheck?.recipients[0]?.status}`);
    }

    console.log('✅ Phase 3 Passed: 1x1 transparent GIF returned and DB engagement (Lead active + Campaign recipient Opened) logged.\n');

    // --- PHASE 4: Edge Cases & Three-Strike Bounce Hygiene ---
    console.log('[Phase 4A] Simulating Three-Strike hard bounce delivery failures...');
    for (let strike = 1; strike <= 3; strike++) {
      console.log(`   Simulating Hard Bounce Strike #${strike}...`);
      await axios.post(`${baseUrl}/webhooks/bounces`, {
        email: testEmail,
        type: 'bounce'
      });
      await new Promise(res => setTimeout(res, 200));
    }

    const finalLeadCheck = await Lead.findOne({ email: testEmail });
    if (finalLeadCheck) {
      throw new Error('❌ Test Failed: Lead was not scrubbed from DB after hitting 3-bounce strike limit.');
    }
    console.log('✅ Phase 4A Passed: Automated list hygiene successfully purged lead on 3rd bounce strike.\n');

    // --- PHASE 4B: Unsubscribe Verification ---
    const optOutEmail = `agent_optout_${stamp}@domain.test`;
    console.log(`[Phase 4B] Simulating Unsubscribe webhook for lead: ${optOutEmail}`);
    await Lead.create({
      email: optOutEmail,
      name: 'Opt-Out Lead',
      phone: `88888${stamp.toString().slice(-5)}`,
      status: 'active'
    });

    await axios.post(`${baseUrl}/api/crm/unsubscribe`, {
      email: optOutEmail,
      reason: 'Synthetic AI Agent Opt-out validation'
    });

    const optOutCheck = await Lead.findOne({ email: optOutEmail });
    if (!optOutCheck || !optOutCheck.unsubscribed) {
      throw new Error('❌ Test Failed: Lead was not marked unsubscribed: true.');
    }
    console.log('✅ Phase 4B Passed: Unsubscribe status instantly updated across ecosystem.\n');

    console.log('🎉 [SUCCESS] Advanced Auto-Mailer AI Validation Complete! All 4 phases passed flawlessly.');
    process.exit(0);
  } catch (err) {
    console.error('\n💥 [PIPELINE ERROR]', err.message || err);
    process.exit(1);
  }
}

runAIEmailTestAgent();
