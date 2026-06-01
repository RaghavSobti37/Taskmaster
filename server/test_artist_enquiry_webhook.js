fetch('http://127.0.0.1:5000/api/webhooks/artist-enquiry', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET
      ? { 'X-Webhook-Secret': process.env.ARTIST_ENQUIRY_WEBHOOK_SECRET }
      : {}),
  },
  body: JSON.stringify({
    name: 'Webhook Test Partner',
    organization: 'Test Corp',
    email: 'artist.enquiry.test@example.com',
    phone: '+919876543210',
    collaborationType: 'Live performance',
    artist: 'YUGM',
    projectNature: 'Corporate event',
    whenWhere: 'Mumbai, Q3 2026',
    scaleReach: '500 attendees',
    logisticsSupport: 'Sound + travel',
    vision: 'High-energy opening act',
  }),
})
  .then(async (res) => {
    const json = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', json);
  })
  .catch(console.error);
