async function sendAiSensyMessage(destination, campaign, params, attributes, userName) {
  if (!destination || !campaign) return;

  const cleanDestination = String(destination).replace(/\D/g, '');
  const body = {
    apiKey: process.env.AISENSY_API_KEY,
    campaignName: campaign,
    destination: cleanDestination,
    templateParams: params,
    userName: userName || 'User',
  };
  if (attributes) body.attributes = attributes;

  if (!process.env.AISENSY_API_KEY) {
    console.warn('[Warning] AISENSY_API_KEY not found in environment, skipping fetch');
    return;
  }

  try {
    const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    console.log(`[AiSensy Webhook Response for ${campaign}]:`, json);
  } catch (e) {
    console.error('[AiSensy] Fetch Error:', e);
  }
}

module.exports = { sendAiSensyMessage };
