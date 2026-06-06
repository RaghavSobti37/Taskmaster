require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const secret = process.env.MASTERCLASS_REVIEW_WEBHOOK_SECRET;

fetch(`${BASE}/api/webhooks/masterclass-review`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'X-Webhook-Secret': secret } : {}),
  },
  body: JSON.stringify({
    source: 'tsc-website',
    campaign: 'review01',
    firstName: 'Webhook',
    lastName: 'Smoke',
    registeredMobile: '9876543210',
    registeredEmail: 'webhook.smoke@example.com',
    artistTypes: 'Singer',
    completion: '90%',
    oneLineExperience: 'Excellent masterclass',
    improvementSuggestion: 'More Q&A time',
    weightedRating: 5,
    rating: 5,
  }),
})
  .then(async (res) => {
    const json = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', json);
  })
  .catch(console.error);
