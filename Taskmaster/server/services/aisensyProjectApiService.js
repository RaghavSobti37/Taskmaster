const AISENSY_PROJECT_API_BASE = 'https://apis.aisensy.com';

function resolveProjectCredentials() {
  const projectId = (
    process.env.AISENSY_PROJECT_ID
    || process.env.AISENSY_PROJECT_API_ID
    || ''
  ).trim();
  const projectApiPwd = (
    process.env.AISENSY_PROJECT_API_PWD
    || process.env.AISENSY_PROJECT_API_PASSWORD
    || ''
  ).trim();
  if (!projectId || !projectApiPwd) {
    throw new Error('AISENSY_PROJECT_ID and AISENSY_PROJECT_API_PWD must be set in server .env');
  }
  return { projectId, projectApiPwd };
}

async function listProjectCampaigns({
  projectId,
  projectApiPwd,
  campaignType = 'BROADCAST',
  skip = 0,
  limit = 0,
} = {}) {
  const creds = projectId && projectApiPwd
    ? { projectId, projectApiPwd }
    : resolveProjectCredentials();
  const url = `${AISENSY_PROJECT_API_BASE}/project-apis/v1/project/${creds.projectId}/campaigns`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-AiSensy-Project-API-Pwd': creds.projectApiPwd,
    },
    body: JSON.stringify({ skip, limit, campaignType }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.message || json?.name || res.statusText || 'AiSensy project API error';
    throw new Error(msg);
  }
  return Array.isArray(json?.campaigns) ? json.campaigns : [];
}

async function listAllProjectCampaigns(options = {}) {
  const types = options.campaignTypes || ['BROADCAST', 'API'];
  const merged = new Map();
  for (const campaignType of types) {
    const rows = await listProjectCampaigns({ ...options, campaignType });
    for (const row of rows) {
      if (row?.id) merged.set(row.id, row);
    }
  }
  return [...merged.values()];
}

module.exports = {
  AISENSY_PROJECT_API_BASE,
  resolveProjectCredentials,
  listProjectCampaigns,
  listAllProjectCampaigns,
};
