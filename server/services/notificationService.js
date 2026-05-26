const cron = require('node-cron');
const nodemailer = require('nodemailer');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { parse, addMinutes, isBefore, isAfter, format } = require('date-fns');
const logger = require('../utils/logger');

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
        const followupStr = lead.nextFollowupDate + ' ' + lead.nextFollowupTime;
        const followupDate = parse(followupStr, 'dd-MM-yyyy HH:mm', new Date());

        if (isNaN(followupDate.getTime())) continue;

        // If followup is within the next 10 minutes (and not in the past too far)
        if (isBefore(followupDate, tenMinsFromNow) && isAfter(followupDate, now)) {
          const rep = lead.assignedRepId;
          if (!rep) continue;

          logger.info('Reminder', `Sending reminder for Lead: ${lead.name} to Rep: ${rep.name}`);

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
            logger.debug('Reminder', `Email reminder skipped for ${rep.name} (no email or placeholder config)`);
          }

          // 3. Mark as sent
          lead.reminderSent = true;
          await lead.save();
        }
      } catch (err) {
        logger.error('Reminder', `Error processing reminder for lead ${lead._id}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('Reminder', 'Error in checkFollowups', { error: err.message });
  }
};

const checkOverdue = async () => {
  try {
    const now = new Date();

    // 1. Check for Overdue Tasks
    const overdueTasks = await Task.find({
      status: { $ne: 'done' },
      dueDate: { $lt: now },
      notifiedOverdue: false
    }).populate('assignees');

    for (const task of overdueTasks) {
      for (const assignee of task.assignees) {
        await Notification.create({
          recipient: assignee._id,
          title: 'Overdue Task Alert',
          message: `Task "${task.title}" is overdue. Please resolve it as soon as possible.`,
          type: 'alert'
        });
      }
      task.notifiedOverdue = true;
      await task.save();
    }

    // 2. Check for Overdue Followups (Leads)
    const overdueLeads = await Lead.find({
      leadStatus: { $ne: 'Converted' },
      nextFollowupDate: { $exists: true, $ne: '' },
      notifiedOverdue: false
    }).populate('assignedRepId');

    for (const lead of overdueLeads) {
      try {
        const followupDate = new Date(lead.nextFollowupDate);
        if (isNaN(followupDate.getTime())) continue;

        if (followupDate < now) {
          const rep = lead.assignedRepId;
          if (!rep) continue;

          await Notification.create({
            recipient: rep._id,
            title: 'Overdue Follow-up Alert',
            message: `Follow-up with ${lead.name} is overdue. Scheduled date was ${lead.nextFollowupDate}.`,
            relatedLeadId: lead._id,
            type: 'alert'
          });

          lead.notifiedOverdue = true;
          await lead.save();
        }
      } catch (err) {
        logger.error('Overdue', `Error processing overdue lead ${lead._id}`, { error: err.message });
      }
    }
  } catch (err) {
    logger.error('Overdue', 'Error in checkOverdue', { error: err.message });
  }
};

// Run every minute
const init = () => {
  logger.info('System', 'Initializing Reminder Service...');
  cron.schedule('* * * * *', () => {
    checkFollowups();
    checkOverdue();
  });
};

module.exports = { init };
