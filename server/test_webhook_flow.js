fetch('http://127.0.0.1:5000/api/webhooks/book-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    "name": "Full Workflow Test",
    "email": "workflow_test_final@example.com",
    "phone": "9999999999",
    "whatsapp": "8591499393",
    "course": "Pro Max Workflow Test",
    "date": "2026-06-05",
    "time": "02:30 PM",
    "timezone": "Asia/Kolkata"
  })
}).then(async res => {
  const json = await res.json();
  console.log('Status:', res.status);
  console.log('Response:', json);
}).catch(console.error);
