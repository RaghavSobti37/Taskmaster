const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { parse, addMinutes, isBefore, isAfter, format } = require('date-fns');

// Transporter setup - using placeholders for now
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS || 'placeholder@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'placeholder_pass'
  }
});

const checkFollowups = async () => {
  try {
    const now = new Date();
    const tenMinsFromNow = addMinutes(now, 10);
    
    // Find leads with follow-up scheduled in the next 10-11 minutes
    // and where reminderSent is false
    const leads = await Lead.find({
      nextFollowupDate: { $exists: true, $ne: '' },
      nextFollowupTime: { $exists: true, $ne: '' },
      reminderSent: false
    }).populate('assignedRepId');

    for (const lead of leads) {
      try {
        // Parse DD-MM-YYYY HH:mm
        const followupStr = `${lead.nextFollowupDate} ${lead.nextFollowupTime}`;
        const followupDate = parse(followupStr, 'dd-MM-yyyy HH:mm', new Date());

        if (isNaN(followupDate.getTime())) continue;

        // If followup is within the next 10 minutes (and not in the past too far)
        if (isBefore(followupDate, tenMinsFromNow) && isAfter(followupDate, now)) {
          const rep = lead.assignedRepId;
          if (!rep) continue;

          console.log(`[REMINDER] Sending reminder for Lead: ${lead.name} to Rep: ${rep.name}`);

          // 1. Create In-App Notification
          await Notification.create({
            recipient: rep._id,
            title: 'Follow-up Call Reminder',
            message: `You have a scheduled follow-up call with ${lead.name} (${lead.phone}) in 10 minutes.`,
            relatedLeadId: lead._id
          });

          // 2. Send Email
          if (rep.email && process.env.EMAIL_ADDRESS !== 'placeholder@gmail.com') {
            const mailOptions = {
              from: process.env.EMAIL_ADDRESS,
              to: rep.email,
              subject: `Reminder: Follow-up call with ${lead.name} in 10 minutes`,
              text: `Hello ${rep.name},\n\nThis is a reminder for your scheduled follow-up call with ${lead.name} at ${lead.nextFollowupTime}.\n\nLead Details:\nName: ${lead.name}\nPhone: ${lead.phone}\nRemarks: ${lead.remarks || 'None'}\n\nGood luck!`
            };

            await transporter.sendMail(mailOptions);
          } else {
            console.log(`[SKIPPED] Email reminder skipped for ${rep.name} (no email or placeholder config)`);
          }

          // 3. Mark as sent
          lead.reminderSent = true;
          await lead.save();
        }
      } catch (err) {
        console.error(`Error processing reminder for lead ${lead._id}:`, err);
      }
    }
  } catch (err) {
    console.error('Error in checkFollowups:', err);
  }
};

// Run every minute
const init = () => {
  console.log('[SYSTEM] Initializing Reminder Service...');
  cron.schedule('* * * * *', () => {
    checkFollowups();
  });
};

module.exports = { init };
