require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const EmailProfile = require('./models/EmailProfile');
const MailCampaign = require('./models/MailCampaign');
const { sendCampaign } = require('./services/mailService');

const runTest = async () => {
  const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/coreknot';
  console.log(`[TEST] Connecting to MongoDB: ${dbUri.replace(/\/\/.*:.*@/, '//****:****@')}`);
  
  await mongoose.connect(dbUri);
  console.log('[TEST] Connected successfully.');

  try {
    // 1. Get any user or admin
    let user = await User.findOne({ role: 'admin' });
    if (!user) {
      user = await User.findOne({});
    }
    if (!user) {
      user = await User.create({
        name: 'Raghav Raj Sobti',
        email: 'raghavsobti37@gmail.com',
        phone: '+918591499393',
        password: process.env.DEFAULT_SEED_PASSWORD || 'password123',
        role: 'admin'
      });
    }

    // 2. Ensure Email Profile exists and has correct SMTP host
    let profile = await EmailProfile.findOne({ smtpUser: 'helloworld@theshakticollective.in' });
    if (!profile) {
      console.log('[TEST] Creating SMTP Profile for helloworld@theshakticollective.in');
      profile = await EmailProfile.create({
        name: 'The Shakti Collective',
        email: 'helloworld@theshakticollective.in',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'helloworld@theshakticollective.in',
        smtpPass: process.env.EMAIL_PASSWORD || 'wednxwrsjqbmppid',
        isDefault: true,
        createdBy: user._id
      });
    } else {
      console.log('[TEST] Found existing SMTP Profile:', profile.name);
      if (profile.smtpHost !== 'smtp.gmail.com') {
        console.log('[TEST] Correcting SMTP Host from', profile.smtpHost, 'to smtp.gmail.com');
        profile.smtpHost = 'smtp.gmail.com';
        profile.smtpPort = 587;
        await profile.save();
      }
    }

    // 3. Create Mail Campaign targeting @[/test] specifications
    console.log('[TEST] Creating Mail Campaign for raghavsobti37@gmail.com');
    const campaign = await MailCampaign.create({
      title: 'Automated Test Campaign',
      subject: 'Taskmaster Live Verification Notice',
      content: '<div style="font-family:sans-serif; padding:20px; border-radius:10px; background:#f9f9f9;"><h2>Hello Raghav Raj Sobti,</h2><p>This is a live test email sent from the Taskmaster platform to verify SMTP dispatch, open tracking, and recipient status sync.</p><p>Phone/WhatsApp on file: +91 8591499393</p></div>',
      senderProfileId: profile._id,
      status: 'Draft',
      recipients: [{
        email: 'raghavsobti37@gmail.com',
        status: 'Pending'
      }],
      stats: { total: 1, sent: 0, opened: 0, clicked: 0, bounced: 0 },
      createdBy: user._id
    });

    console.log(`[TEST] Campaign created with ID: ${campaign._id}. Dispatching...`);

    // 4. Trigger Campaign Dispatch
    await sendCampaign(campaign._id);

    // 5. Verify Results
    const updated = await MailCampaign.findById(campaign._id);
    console.log('[TEST] Dispatch completed.');
    console.log('[TEST] Final Campaign Status:', updated.status);
    console.log('[TEST] Recipient Status:', updated.recipients[0].status);
    if (updated.recipients[0].messageId) {
      console.log('[TEST] Message ID:', updated.recipients[0].messageId);
      console.log('[SUCCESS] Live test email sent successfully!');
    } else if (updated.recipients[0].error) {
      console.error('[FAILED] Send error:', updated.recipients[0].error);
    }
  } catch (err) {
    console.error('[ERROR] Test execution failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('[TEST] Disconnected from DB.');
  }
};

runTest();
