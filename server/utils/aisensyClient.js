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
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.success === false) {
      console.error(`[AiSensy] ${campaign} failed (${res.status}):`, json);
      return { ok: false, status: res.status, body: json };
    }
    console.log(`[AiSensy] ${campaign} sent to ${cleanDestination.slice(-4).padStart(cleanDestination.length, '*')}`);
    return { ok: true, status: res.status, body: json };
  } catch (e) {
    console.error('[AiSensy] Fetch Error:', e.message || e);
    return { ok: false, error: e.message || String(e) };
  }
}

module.exports = { sendAiSensyMessage };
