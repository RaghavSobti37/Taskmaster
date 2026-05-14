const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD
  }
});

const sendTestEmail = async () => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_ADDRESS,
      to: 'redacted@example.com',
      subject: 'Test Email from Taskmaster Reminder System',
      text: 'Hello Redacted User,\n\nThis is a test email from the Taskmaster CRM system to verify your email configuration.\n\nStatus: SUCCESS\nTime: ' + new Date().toLocaleString()
    };

    console.log('Attempting to send test email to redacted@example.com...');
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    process.exit(0);
  } catch (error) {
    console.error('Failed to send email:', error);
    process.exit(1);
  }
};

sendTestEmail();
