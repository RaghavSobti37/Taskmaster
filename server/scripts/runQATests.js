const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Lead = require('../models/Lead');
const Log = require('../models/Log');
const CRMAudit = require('../models/CRMAudit');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runQATests() {
  console.log('🤖 [QA_ENGINEER] Initializing Structured Autonomous QA Test Suite...');
  
  const dbUri = process.env.MONGODB_URI;
  if (!dbUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  // Connect to DB
  try {
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB Staging/Dev database.');
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }

  // Ensure QA user exists and sign token
  let qaUser = await User.findOne({ email: 'qa_engineer@theshakticollective.in' });
  if (!qaUser) {
    qaUser = await User.create({
      name: 'QA Autonomous Engineer',
      email: 'qa_engineer@theshakticollective.in',
      password: 'qa_secure_password_2026',
      role: 'admin',
      gender: 'male',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=qa'
    });
    console.log('👤 Created temporary QA Engineer Admin user.');
  }

  const token = jwt.sign({ id: qaUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const client = axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true // Allow asserting error codes without throwing axios exceptions
  });

  const runLog = async (actionType, targetEntity, status, payload, start) => {
    const end = Date.now();
    const executionTimeMs = start ? end - start : 0;
    try {
      await Log.create({
        origin: 'QA_AGENT_TEST',
        actorId: qaUser._id.toString(),
        actorRole: 'admin',
        actionType,
        targetEntity,
        status,
        payload,
        executionTimeMs
      });
      console.log(`[LOGGED] Action: ${actionType} | Status: ${status} | Target: ${targetEntity} (${executionTimeMs}ms)`);
    } catch (err) {
      console.error('❌ Failed to write QA Log to database:', err.message);
    }
  };

  // --- TEST CASE 1: Sanitization & Clean-up Verification ---
  console.log('\n--- Test Case 1: Mongoose Sanitization Hooks ---');
  const tc1Start = Date.now();
  try {
    // Delete existing duplicate leads to prevent collisions
    await Lead.deleteMany({ email: 'john.doe@example.com' });
    await Lead.deleteMany({ phone: '+919999999999' });

    const dirtyLead = new Lead({
      name: '  <b>John   Doe</b>  ',
      email: 'John.Doe@Example.com   ',
      phone: ' +91 999-999-9999 ',
      city: ' Mumbai (West) ',
      leadStatus: 'New'
    });

    await dirtyLead.save();

    // Fetch and check values
    const saved = await Lead.findById(dirtyLead._id);
    if (
      saved.name === 'John Doe' &&
      saved.email === 'john.doe@example.com' &&
      saved.phone === '+919999999999' &&
      saved.city === 'mumbai west'
    ) {
      await runLog('TEST_ASSERTION', 'Lead', 'SUCCESS', {
        testCase: 'Mongoose Sanitization Hooks',
        message: 'Name, email, phone, and city sanitized correctly on pre-save.',
        savedRecord: { name: saved.name, email: saved.email, phone: saved.phone, city: saved.city }
      }, tc1Start);
    } else {
      await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
        testCase: 'Mongoose Sanitization Hooks',
        message: 'Sanitization output mismatch.',
        expected: { name: 'John Doe', email: 'john.doe@example.com', phone: '+919999999999', city: 'mumbai west' },
        received: { name: saved.name, email: saved.email, phone: saved.phone, city: saved.city }
      }, tc1Start);
    }
  } catch (err) {
    await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
      testCase: 'Mongoose Sanitization Hooks',
      message: 'Exception thrown during sanitization test',
      errorStack: err.stack || err.message
    }, tc1Start);
  }

  // --- TEST CASE 2: Exly Webhook & Deduplication Testing ---
  console.log('\n--- Test Case 2: Exly Webhook & Deduplication ---');
  const tc2Start = Date.now();
  try {
    const testPhone = '+918888888888';
    const testEmail = 'exly-test-dedup@example.com';
    
    // Clear old test records
    await Lead.deleteMany({ $or: [{ phone: testPhone }, { email: testEmail }] });

    const webhookPayload = {
      bookingId: 'EXLY_BK_9999',
      offeringId: 'EXLY_OFF_1111',
      offeringTitle: 'QA Masterclass',
      name: 'Exly Test Lead',
      email: testEmail,
      phone: testPhone,
      city: 'Delhi',
      pricePaid: 499
    };

    // First booking request (should create lead)
    const res1 = await client.post('/exly/webhook', webhookPayload);
    
    // Wait briefly for queue or async work
    await new Promise(resolve => setTimeout(resolve, 500));

    const leadCountAfterOne = await Lead.countDocuments({ phone: testPhone });

    // Second duplicate request
    const res2 = await client.post('/exly/webhook', webhookPayload);
    
    await new Promise(resolve => setTimeout(resolve, 500));

    const leadCountAfterTwo = await Lead.countDocuments({ phone: testPhone });

    if (res1.status >= 200 && res1.status < 300 && leadCountAfterOne === 1 && leadCountAfterTwo === 1) {
      await runLog('TEST_ASSERTION', 'ExlyBooking', 'SUCCESS', {
        testCase: 'Exly Webhook & Deduplication',
        message: 'Deduplication works successfully. Only one lead created.',
        res1Status: res1.status,
        res2Status: res2.status,
        finalCount: leadCountAfterTwo
      }, tc2Start);
    } else {
      await runLog('TEST_ASSERTION', 'ExlyBooking', 'BUG_DETECTED', {
        testCase: 'Exly Webhook & Deduplication',
        message: `Deduplication failed or endpoint error. Count after 1: ${leadCountAfterOne}, Count after 2: ${leadCountAfterTwo}`,
        res1Status: res1.status,
        res2Status: res2.status
      }, tc2Start);
    }
  } catch (err) {
    await runLog('TEST_ASSERTION', 'ExlyBooking', 'BUG_DETECTED', {
      testCase: 'Exly Webhook & Deduplication',
      message: 'Exception during Exly Webhook test.',
      errorStack: err.stack || err.message
    }, tc2Start);
  }

  // --- TEST CASE 3: Callback Proxy Bounce Event Tracking ---
  console.log('\n--- Test Case 3: Callback Proxy / Resend Webhook Bounces ---');
  const tc3Start = Date.now();
  try {
    const bounceEmail = 'test-bounce@example.com';
    
    // Setup Lead
    await Lead.deleteMany({ email: bounceEmail });
    await Lead.create({
      name: 'Bounce Test Lead',
      email: bounceEmail,
      phone: '+917777777777',
      emailStatus: 'Pending',
      leadStatus: 'New'
    });

    // Send bounce payload
    const bouncePayload = {
      type: 'email.bounced',
      data: {
        to: [bounceEmail],
        error: { message: 'QA Test bounce generated event' }
      }
    };

    const res = await client.post('/webhooks/resend', bouncePayload); // root track mount or api webhooks
    
    // Wait for DB updates
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedLead = await Lead.findOne({ email: bounceEmail });
    
    if (updatedLead && (updatedLead.emailStatus === 'Bounced' || updatedLead.emailStatus === 'Invalid' || updatedLead.unsubscribed === true)) {
      await runLog('TEST_ASSERTION', 'Lead', 'SUCCESS', {
        testCase: 'Resend Webhook Bounce Handling',
        message: `Bounce registered successfully. Lead emailStatus = ${updatedLead.emailStatus}, unsubscribed = ${updatedLead.unsubscribed}`,
        webhookResponse: res.status
      }, tc3Start);
    } else {
      await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
        testCase: 'Resend Webhook Bounce Handling',
        message: 'Lead emailStatus not updated to Bounced or Invalid after webhook.',
        leadState: updatedLead ? { emailStatus: updatedLead.emailStatus, unsubscribed: updatedLead.unsubscribed } : null,
        webhookResponse: res.status
      }, tc3Start);
    }
  } catch (err) {
    await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
      testCase: 'Resend Webhook Bounce Handling',
      message: 'Exception in Bounce Webhook test.',
      errorStack: err.stack || err.message
    }, tc3Start);
  }

  // --- TEST CASE 4: API stress testing & boundary values ---
  console.log('\n--- Test Case 4: API Stress and Fuzzing ---');
  const tc4Start = Date.now();
  try {
    // 1. Send extremely long task title/description
    const longString = 'A'.repeat(15000);
    const resTask = await client.post('/tasks', {
      title: longString,
      description: 'Stress test task description',
      status: 'invalid_status_value', // Invalid status
      priority: 'high'
    });

    // We expect the server to validate and either fail gracefully (400) or handle the payload without throwing 500.
    if (resTask.status === 400 || resTask.status === 422) {
      await runLog('TEST_ASSERTION', 'Task', 'SUCCESS', {
        testCase: 'API Fuzzing / Boundary Values',
        message: 'API returned validation error for invalid task status or long title.',
        httpStatus: resTask.status,
        response: resTask.data
      }, tc4Start);
    } else if (resTask.status === 201) {
      await runLog('TEST_ASSERTION', 'Task', 'WARN', {
        testCase: 'API Fuzzing / Boundary Values',
        message: 'API accepted invalid status and long string without throwing error.',
        httpStatus: resTask.status
      }, tc4Start);
    } else {
      await runLog('TEST_ASSERTION', 'Task', 'BUG_DETECTED', {
        testCase: 'API Fuzzing / Boundary Values',
        message: `API returned unexpected status code: ${resTask.status}`,
        response: resTask.data
      }, tc4Start);
    }
  } catch (err) {
    await runLog('TEST_ASSERTION', 'Task', 'BUG_DETECTED', {
      testCase: 'API Fuzzing / Boundary Values',
      message: 'Exception in API fuzzing test.',
      errorStack: err.stack || err.message
    }, tc4Start);
  }

  // --- TEST CASE 5: Lead History / Shadow Backup Validation ---
  console.log('\n--- Test Case 5: CRMAudit / History Backup ---');
  const tc5Start = Date.now();
  try {
    const auditLead = await Lead.create({
      name: 'Audit History Lead',
      email: 'history-audit@example.com',
      phone: '+916666666666',
      leadStatus: 'New'
    });

    // Make updates to trigger audit logger
    auditLead.leadStatus = 'Warm';
    await auditLead.save();

    await new Promise(resolve => setTimeout(resolve, 300));

    // Check CRMAudit collection
    const audits = await CRMAudit.find({ leadId: auditLead._id }).sort({ timestamp: -1 });

    if (audits.length > 0) {
      await runLog('TEST_ASSERTION', 'CRMAudit', 'SUCCESS', {
        testCase: 'CRMAudit History Generation',
        message: 'CRMAudit successfully tracked lead status modification.',
        auditsCount: audits.length,
        lastDelta: { field: audits[0].fieldChanged, old: audits[0].oldValue, new: audits[0].newValue }
      }, tc5Start);
    } else {
      await runLog('TEST_ASSERTION', 'CRMAudit', 'BUG_DETECTED', {
        testCase: 'CRMAudit History Generation',
        message: 'No CRMAudit logs created for modified lead status.',
        leadId: auditLead._id
      }, tc5Start);
    }

    // Clean up
    await Lead.deleteOne({ _id: auditLead._id });
    await CRMAudit.deleteMany({ leadId: auditLead._id });
  } catch (err) {
    await runLog('TEST_ASSERTION', 'CRMAudit', 'BUG_DETECTED', {
      testCase: 'CRMAudit History Generation',
      message: 'Exception in History Backup test.',
      errorStack: err.stack || err.message
    }, tc5Start);
  }

  // --- TEST CASE 6: Unsubscribe Center Tracking ---
  console.log('\n--- Test Case 6: Unsubscribe Center / Lead Unsubscription ---');
  const tc6Start = Date.now();
  try {
    const unsubEmail = 'unsubscribe-test@example.com';
    
    // Setup Lead
    await Lead.deleteMany({ email: unsubEmail });
    await Lead.create({
      name: 'Unsubscribe Test Lead',
      email: unsubEmail,
      phone: '+918888888888',
      emailStatus: 'Pending',
      unsubscribed: false,
      leadStatus: 'New'
    });

    // Send POST to /track/unsubscribe
    const res = await client.post('/track/unsubscribe', {
      email: unsubEmail,
      reason: 'Too frequent',
      campaignId: 'undefined',
      recipientId: 'undefined'
    });

    // Wait for DB updates
    await new Promise(resolve => setTimeout(resolve, 500));

    const updatedLead = await Lead.findOne({ email: unsubEmail });
    
    if (updatedLead && updatedLead.unsubscribed === true && updatedLead.emailStatus === 'Unsubscribed' && updatedLead.unsubscribeReason === 'Too frequent') {
      await runLog('TEST_ASSERTION', 'Lead', 'SUCCESS', {
        testCase: 'Lead Unsubscription via Page',
        message: `Lead successfully unsubscribed. Status = ${updatedLead.emailStatus}, reason = ${updatedLead.unsubscribeReason}`,
        httpStatus: res.status
      }, tc6Start);
    } else {
      await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
        testCase: 'Lead Unsubscription via Page',
        message: 'Lead unsubscription fields not updated correctly in database.',
        leadState: updatedLead ? { emailStatus: updatedLead.emailStatus, unsubscribed: updatedLead.unsubscribed, reason: updatedLead.unsubscribeReason } : null,
        httpStatus: res.status
      }, tc6Start);
    }

    // Clean up
    await Lead.deleteOne({ email: unsubEmail });
  } catch (err) {
    await runLog('TEST_ASSERTION', 'Lead', 'BUG_DETECTED', {
      testCase: 'Lead Unsubscription via Page',
      message: 'Exception in Unsubscribe test.',
      errorStack: err.stack || err.message
    }, tc6Start);
  }

  console.log('\n🏁 [QA_ENGINEER] QA test runner finished. Disconnecting from database...');
  await mongoose.disconnect();
  console.log('👋 Database disconnected.');
}

runQATests();
