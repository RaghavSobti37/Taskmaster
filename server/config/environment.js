require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const ENV_CONFIG = {
  isProduction,
  // Local environment uses an explicit tunneling proxy link (Ngrok / Cloudflare Tunnel)
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  
  // Choose production mailer or local sandbox testing provider
  mailProvider: isProduction ? 'sendgrid' : 'nodemailer', 
  
  // Secure configuration fallbacks
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

module.exports = { ENV_CONFIG };
