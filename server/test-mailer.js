const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { sendCampaign } = require('./services/mailService');
const EmailProfile = require('./models/EmailProfile');
const MailCampaign = require('./models/MailCampaign');
const User = require('./models/User');

dotenv.config({ path: './.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) throw new Error('No admin user found');

  let profile = await EmailProfile.findOne();
  if (!profile) {
    profile = await EmailProfile.create({
      name: 'Test Profile',
      email: 'redacted@example.com',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: process.env.SMTP_USER || 'someuser',
      smtpPass: process.env.SMTP_PASS || 'somepass',
      createdBy: admin._id
    });
  }

  const campaign = await MailCampaign.create({
    title: 'QA Test Campaign with Attachments',
    subject: 'Important Update from Taskmaster QA',
    content: '<p>Hello Redacted User,</p><p>This is a test of the fully functional campaign builder including rich text, attachments, and HolySheet logic.</p><br/><br/><div dir="ltr"><strong>The Shakti Collective</strong></div>',
    senderProfileId: profile._id,
    recipients: [{ name: 'Redacted User', email: 'redacted@example.com' }],
    status: 'Draft',
    createdBy: admin._id,
    attachments: [
      {
        filename: 'TestFile.txt',
        content: Buffer.from('This is a test attachment.').toString('base64'),
        contentType: 'text/plain'
      }
    ]
  });

  console.log('Created test campaign:', campaign._id);
  
  try {
    await sendCampaign(campaign._id);
    console.log('Campaign executed successfully.');
  } catch(e) {
    console.log('Campaign execution failed:', e.message);
  }
  
  process.exit(0);
}

run().catch(console.error);
