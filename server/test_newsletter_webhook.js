require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const secret = process.env.NEWSLETTER_WEBHOOK_SECRET;

fetch(`${BASE}/api/webhooks/newsletter`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'X-Webhook-Secret': secret } : {}),
  },
  body: JSON.stringify({
    email: 'webhook.smoke@example.com',
    source: 'tsc-footer',
    sourceSite: 'tsc-website',
    subscribedAt: new Date().toISOString(),
  }),
})
  .then(async (res) => {
    const json = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', json);
  })
  .catch(console.error);
