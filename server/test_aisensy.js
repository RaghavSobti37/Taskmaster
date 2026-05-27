require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Lead = require('./models/Lead');

async function sendAiSensyMessage(destination, campaign, params, attributes, userName) {
  const cleanDestination = destination.replace(/\D/g, '');
  const body = {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'Test User'
  };
  if (attributes) body.attributes = attributes;

  console.log(`[AiSensy] Sending ${campaign} to ${cleanDestination}...`);
  try {
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(`[AiSensy Response]:`, json);
  } catch (e) {
    console.error(`[AiSensy Error]:`, e.message);
  }
}

async function runTest() {
  const dbUri = (process.env.MONGO_URI || process.env.MONGODB_URI).trim();
  await mongoose.connect(dbUri);
  console.log('DB Connected.');

  // 1. Update Sales Reps in DB
  const repsData = [
    { nameMatch: 'aryaman', phone: '+91 98716 22292' },
    { nameMatch: 'satyam', phone: '+91 79 7721 2805' }
  ];

  const reps = [];
  for (const r of repsData) {
    const rep = await User.findOneAndUpdate(
      { name: { $regex: r.nameMatch, $options: 'i' }, role: 'sales' },
      { $set: { phone: r.phone } },
      { new: true }
    );
    if (rep) {
      console.log(`Updated ${rep.name} with phone ${rep.phone}`);
      reps.push(rep);
    } else {
      console.log(`Rep matching ${r.nameMatch} not found.`);
    }
  }

  // 2. Test Data from @[/test] workflow
  const testUser = {
    name: 'Raghav Raj Sobti',
    email: 'raghavsobti37@gmail.com',
    phone: '+91 8591499393',
    course: 'Pro Max Testing',
    date: '2026-05-30',
    time: '12:00 PM',
    istDateStr: '2026-05-30',
    istTimeStr: '12:00 PM'
  };

  // 3. Add to Database
  for (const rep of reps) {
    const leadData = {
      name: testUser.name,
      phone: testUser.phone,
      course: testUser.course,
      assignedRepId: rep._id,
      leadStatus: 'New',
      callStatus: 'Pending',
      source: 'Test Webhook',
      nextFollowupDate: testUser.istDateStr,
      nextFollowupTime: testUser.istTimeStr
    };

    await Lead.findOneAndUpdate(
      { email: `${rep.name.split(' ')[0].toLowerCase()}_${testUser.email}` }, // make unique per rep for test
      { $set: leadData },
      { upsert: true }
    );
    console.log(`Added Test Lead for rep ${rep.name} in DB.`);

    // 4. Send AiSensy to Test Customer
    await sendAiSensyMessage(
      testUser.phone,
      'final_book_call_confirmation',
      [testUser.name.split(' ')[0], testUser.course, testUser.istDateStr, testUser.istTimeStr, testUser.phone],
      {
        "FirstName": testUser.name.split(' ')[0],
        "CourseName": testUser.course,
        "ScheduledDate": testUser.istDateStr,
        "ScheduledTime": testUser.istTimeStr,
        "WhatsAppNumber": testUser.phone
      },
      testUser.name
    );

    // 5. Send AiSensy to Rep
    await sendAiSensyMessage(
      rep.phone,
      'final_book_call_confirmation',
      [testUser.name.split(' ')[0], testUser.course, testUser.istDateStr, testUser.istTimeStr, testUser.phone],
      {
        "FirstName": testUser.name.split(' ')[0],
        "CourseName": testUser.course,
        "ScheduledDate": testUser.istDateStr,
        "ScheduledTime": testUser.istTimeStr,
        "WhatsAppNumber": testUser.phone
      },
      rep.name
    );
  }

  process.exit(0);
}

runTest();
