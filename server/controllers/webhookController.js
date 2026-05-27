const User = require('../models/User');
const Lead = require('../models/Lead');
const { assignLeadToRep } = require('./crmController');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

exports.handleBookedCall = async (req, res) => {
  try {
    const { name, email, phone, whatsapp, course, referral, date, time, timezone = 'Asia/Kolkata' } = req.body;

    // 1. Assign Rep (Only if new lead or lead has no rep)
    let lead = await Lead.findOne({ email });
    let rep = null;

    if (lead && lead.assignedRepId) {
      rep = await User.findById(lead.assignedRepId);
    }
    
    if (!rep) {
      const repId = await assignLeadToRep();
      if (repId) rep = await User.findById(repId);
      if (!rep) throw new Error("No sales rep available");
    }

    // Helper to convert any local time to IST
    const convertToIST = (dStr, tStr, tz) => {
      try {
        const [year, month, day] = dStr.split('-').map(Number);
        const [timePart, period] = tStr.split(' ');
        let [hours, minutes] = timePart.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;

        const localClockUTC = Date.UTC(year, month - 1, day, hours, minutes);
        
        const getOffset = (timestamp, timeZone) => {
          const date = new Date(timestamp);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric',
            hour12: false
          }).formatToParts(date);
          
          const getVal = (type) => parseInt(parts.find(p => p.type === type).value);
          const utcAtParts = Date.UTC(getVal('year'), getVal('month') - 1, getVal('day'), getVal('hour'), getVal('minute'));
          return (utcAtParts - timestamp) / 60000;
        };

        let offset = getOffset(localClockUTC, tz);
        const realUTC = localClockUTC - (offset * 60000);
        return new Date(realUTC);
      } catch (e) {
        console.error('Conversion Error:', e);
        return new Date('Invalid');
      }
    };

    const istSlotDate = convertToIST(date, time, timezone);
    if (isNaN(istSlotDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid date or time format provided.' });
    }

    const now = new Date();
    const bufferTime = 90 * 60 * 1000; // 1.5 hours
    if (istSlotDate.getTime() < now.getTime() + bufferTime) {
      return res.status(400).json({ success: false, error: 'This slot is no longer available in your timezone.' });
    }

    const istDateStr = istSlotDate.toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
    const istTimeStr = istSlotDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true,
      timeZone: 'Asia/Kolkata' 
    });

    // 2. Upsert Lead in CRM
    const leadData = {
      name,
      phone: whatsapp || phone,
      course,
      assignedRepId: rep._id,
      leadStatus: lead ? lead.leadStatus : 'New',
      callStatus: lead ? lead.callStatus : 'Pending',
      source: 'Website Booking',
      nextFollowupDate: istDateStr,
      nextFollowupTime: istTimeStr
    };

    if (lead) {
      Object.assign(lead, leadData);
      await lead.save();
    } else {
      lead = await Lead.create({ email, ...leadData });
    }

    // 4. Send AiSensy to Customer
    await sendAiSensyMessage(
      whatsapp || phone, 
      'final_book_call_confirmation', 
      [name.split(' ')[0], course, istDateStr, istTimeStr, whatsapp || phone],
      {
        "FirstName": name.split(' ')[0],
        "CourseName": course,
        "ScheduledDate": istDateStr,
        "ScheduledTime": istTimeStr,
        "WhatsAppNumber": whatsapp || phone
      },
      name
    );

    // 5. Send AiSensy to Assigned Rep
    if (rep.phone) {
      await sendAiSensyMessage(
        rep.phone, 
        'sales_rep_new_booking_alert',
        [rep.name.split(' ')[0], name, course, istDateStr, istTimeStr],
        {
          "RepName": rep.name.split(' ')[0],
          "LeadName": name,
          "CourseName": course,
          "ScheduledDate": istDateStr,
          "ScheduledTime": istTimeStr
        },
        rep.name
      );
    } else {
      console.warn(`[Warning] No phone number for rep ${rep.name}, skipping AiSensy notification.`);
    }

    // 6. Push to Google Sheets
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const row = [
      timestamp,
      name,
      email,
      `'${phone}`,
      course,
      rep.name,
      istDateStr,
      istTimeStr,
      'No'
    ];
    await pushToGoogleSheets(row);

    res.status(200).json({ success: true, message: 'Call booked and synced' });
  } catch (error) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
};

async function sendAiSensyMessage(destination, campaign, params, attributes, userName) {
  const cleanDestination = destination.replace(/\D/g, '');
  const body = {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'User'
  };
  if (attributes) {
    body.attributes = attributes;
  }
  
  if (!process.env.AISENSY_API_KEY) {
      console.warn('[Warning] AISENSY_API_KEY not found in environment, skipping fetch');
      return;
  }

  try {
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    console.log(`[AiSensy Webhook Response for ${campaign}]:`, json);
  } catch (e) {
      console.error('[AiSensy] Fetch Error:', e);
  }
}

async function pushToGoogleSheets(row) {
  const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '19sTRQ-lUls_dWYRgL3OM70Ewpcn7M2tWYfOMPLzn8Us';
  const SHEET_NAME = 'BookedCalls';

  let serviceAccount;
  const serviceAccountPath = 'c:\\Users\\ragha\\OneDrive\\Desktop\\TSC-Website\\google_service_account.json';
  
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  } else if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    serviceAccount = {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
    };
  } else {
    throw new Error('Google Service Account credentials missing.');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [row],
    },
  });
}
