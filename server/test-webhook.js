fetch('http://localhost:5000/api/webhooks/book-call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test User',
    email: 'test@example.com',
    phone: '9999999999',
    whatsapp: '9999999999',
    course: 'The heART of Composition',
    date: '2026-05-30',
    time: '02:00 PM',
    timezone: 'Asia/Kolkata'
  })
}).then(res => res.json()).then(data => console.log('Response:', data)).catch(err => console.error('Error:', err));
