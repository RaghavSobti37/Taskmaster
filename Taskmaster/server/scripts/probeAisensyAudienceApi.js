require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { listAllProjectCampaigns } = require('../services/aisensyProjectApiService');

const projectId = process.env.AISENSY_PROJECT_ID;
const projPwd = process.env.AISENSY_PROJECT_API_PWD;
const apiKey = process.env.AISENSY_API_KEY;

async function tryFetch(label, url, init = {}) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const preview = text.slice(0, 400).replace(/\s+/g, ' ');
    console.log(`${label} -> ${res.status} ${preview}`);
    if (res.ok && text.startsWith('{')) {
      try {
        const json = JSON.parse(text);
        const keys = Object.keys(json);
        console.log(`  keys: ${keys.join(', ')}`);
        if (Array.isArray(json.data)) console.log(`  data.len=${json.data.length}`);
        if (Array.isArray(json.audience)) console.log(`  audience.len=${json.audience.length}`);
        if (Array.isArray(json.contacts)) console.log(`  contacts.len=${json.contacts.length}`);
        if (Array.isArray(json.recipients)) console.log(`  recipients.len=${json.recipients.length}`);
      } catch {
        // ignore
      }
    }
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    console.log(`${label} -> ERR ${err.message}`);
    return { ok: false, error: err.message };
  }
}

async function main() {
  const campaigns = await listAllProjectCampaigns();
  const sample = campaigns.find((c) => (c.audience_size || 0) > 0) || campaigns[0];
  if (!sample) {
    console.log('No campaigns');
    return;
  }
  const cid = sample.id;
  const cname = sample.name;
  console.log(`Sample campaign: ${cname} (${cid}) audience=${sample.audience_size}`);

  const headers = {
    'Content-Type': 'application/json',
    'X-AiSensy-Project-API-Pwd': projPwd,
  };
  const base = `https://apis.aisensy.com/project-apis/v1/project/${projectId}`;

  const postBodies = [
    { campaign_id: cid },
    { campaignId: cid },
    { id: cid },
    { campaign_id: cid, status: 'FAILED' },
    { campaign_id: cid, status: 'DELIVERED' },
    { campaign_id: cid, status: 'READ' },
    { campaign_id: cid, filter: 'failed' },
    { campaign_id: cid, audience_type: 'failed' },
    { campaign_id: cid, skip: 0, limit: 10 },
  ];

  const suffixes = [
    `campaigns/${cid}`,
    `campaigns/${cid}/audience`,
    `campaigns/${cid}/analytics`,
    `campaigns/${cid}/messages`,
    `campaigns/${cid}/contacts`,
    `campaigns/${cid}/report`,
    `campaigns/${cid}/stats`,
    `campaigns/${cid}/export`,
    `campaign/${cid}/audience`,
    `get-campaign-audience`,
    `campaign-audience`,
    `campaigns/audience`,
    `campaigns/export`,
    `campaigns/analytics`,
    `campaigns/report`,
    `campaigns/messages`,
    `campaigns/recipients`,
  ];

  for (const suffix of suffixes) {
    await tryFetch(`GET ${suffix}`, `${base}/${suffix}`, { method: 'GET', headers });
    for (const body of postBodies.slice(0, 3)) {
      await tryFetch(`POST ${suffix} ${JSON.stringify(body)}`, `${base}/${suffix}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    }
  }

  const jwtPaths = [
    'campaign/t1/api/campaign-details',
    'campaign/t1/api/campaign-audience',
    'campaign/t1/api/get-campaign-audience',
    'campaign/t1/api/campaign-list',
    'direct-apis/t1/get-campaign-audience',
    'direct-apis/t1/get-campaign-stats',
    'direct-apis/t1/get-campaign-list',
  ];
  for (const path of jwtPaths) {
    await tryFetch(`JWT POST ${path}`, `https://backend.aisensy.com/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        campaignName: cname,
        campaignId: cid,
        campaign_id: cid,
        status: 'FAILED',
        skip: 0,
        limit: 10,
      }),
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
