/**
 * One-shot script: Send Songstats Enterprise API access request
 * Usage: node scripts/send_songstats_api_request.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const nodemailer = require('nodemailer');

const EMAIL_ADDRESS = process.env.EMAIL_ADDRESS;   // helloworld@theshakticollective.in
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;  // Gmail App Password

if (!EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error('❌ EMAIL_ADDRESS or EMAIL_PASSWORD missing from .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_ADDRESS,
    pass: EMAIL_PASSWORD,
  },
});

const subject = 'Enterprise API Access Request – The Shakti Collective';

const text = `Hi Songstats Team,

My name is Redacted User. I'm the manager at The Shakti Collective, a music management and artist development company based in India.

I'm building a custom internal platform (Taskmaster) to manage our artists' careers end-to-end — including streaming analytics across Spotify, Apple Music, YouTube, and other DSPs. I've reviewed your Node.js SDK (songstats-node-sdk) and the API documentation at https://docs.songstats.com and believe Songstats is the right fit for this integration.

Here are our details:

Company: The Shakti Collective
Website: https://theshakticollective.in
Contact Email: helloworld@theshakticollective.in
Use Case: Internal artist analytics dashboard — pulling track stats, artist stats, and platform data via your REST API into our custom Node.js/MongoDB application
Expected Usage: Starting with 1–3 artists, scaling to 10–20 as our roster grows
SDK Interest: songstats-node-sdk (Node.js)

Could you please share:
1. How to get an Enterprise API key
2. Pricing tiers available for our use case
3. Rate limits and data freshness details

Happy to jump on a call if that helps. Looking forward to hearing from you.

Best regards,
Redacted User
The Shakti Collective
helloworld@theshakticollective.in
`;

const mailOptions = {
  from: `"Redacted User – The Shakti Collective" <${EMAIL_ADDRESS}>`,
  to: 'api@songstats.com',
  subject,
  text,
};

(async () => {
  console.log('📤 Sending email to api@songstats.com...');
  console.log(`   From: ${EMAIL_ADDRESS}`);
  console.log(`   Subject: ${subject}`);
  console.log('');
  console.log('--- EMAIL BODY PREVIEW ---');
  console.log(text);
  console.log('--------------------------');
  console.log('');

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response:   ${info.response}`);
  } catch (err) {
    console.error('❌ Failed to send email:', err.message);
    process.exit(1);
  }
})();
