require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const secret = process.env.ARTIST_PATH_WEBHOOK_SECRET;

fetch(`${BASE}/api/webhooks/artist-path`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'X-Webhook-Secret': secret } : {}),
  },
  body: JSON.stringify({
    source: 'tsc-website',
    firstName: 'Webhook',
    lastName: 'Smoke',
    stageName: 'Webhook Test',
    place: 'Mumbai',
    mobile: '9876543210',
    email: 'webhook.smoke@example.com',
    artistIdentity: 'Singer-songwriter',
  }),
})
  .then(async (res) => {
    const json = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', json);
  })
  .catch(console.error);
