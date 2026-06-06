require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const BASE = (process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
const secret = process.env.BOOK_CALL_WEBHOOK_SECRET;

const slotDate = new Date(Date.now() + 3 * 60 * 60 * 1000);
const yyyy = slotDate.getFullYear();
const mm = String(slotDate.getMonth() + 1).padStart(2, '0');
const dd = String(slotDate.getDate()).padStart(2, '0');
let hours = slotDate.getHours();
const minutes = String(slotDate.getMinutes()).padStart(2, '0');
const period = hours >= 12 ? 'PM' : 'AM';
hours = hours % 12 || 12;

fetch(`${BASE}/api/webhooks/book-call`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(secret ? { 'X-Webhook-Secret': secret } : {}),
  },
  body: JSON.stringify({
    source: 'tsc-website',
    name: 'Webhook Smoke Test',
    email: 'webhook.smoke@example.com',
    phone: '9876543210',
    whatsapp: '9876543210',
    course: 'Pro Max Workflow Test',
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hours}:${minutes} ${period}`,
    timezone: 'Asia/Kolkata',
  }),
}).then(async res => {
  const json = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', json);
}).catch(console.error);
