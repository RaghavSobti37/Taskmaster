/**
 * PowerSync backend connector — fetches JWT from CoreKnot sync token API.
 */
export class CoreKnotPowerSyncConnector {
  constructor({ fetchCredentials, uploadData }) {
    this.fetchCredentials = fetchCredentials;
    this.uploadData = uploadData;
  }

  async fetchCredentials() {
    return this.fetchCredentials();
  }

  async uploadData(database) {
    if (this.uploadData) {
      return this.uploadData(database);
    }
  }
}

export async function fetchSyncCredentialsFromApi(apiBase = '') {
  const response = await fetch(`${apiBase}/api/v1/sync/token`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Sync token fetch failed: ${response.status}`);
  }
  const body = await response.json();
  return {
    endpoint: body.endpoint,
    token: body.token,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
  };
}
