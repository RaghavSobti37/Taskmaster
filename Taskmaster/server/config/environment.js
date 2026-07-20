require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const ENV_CONFIG = {
  isProduction,
  // Local environment uses an explicit tunneling proxy link (Ngrok / Cloudflare Tunnel)
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:5000',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  
  // CoreKnot delegates outbound email delivery to Auto-Mailer.
  mailProvider: 'auto-mailer',
  autoMailerApiUrl: process.env.AUTO_MAILER_API_URL
};

module.exports = { ENV_CONFIG };
