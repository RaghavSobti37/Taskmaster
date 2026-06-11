/**
 * Base connection provider — each platform implements connect/refresh/sync/health.
 */
class ConnectionProvider {
  constructor(platformId) {
    this.platformId = platformId;
  }

  /** @returns {Promise<{ authUrl?: string, status?: string }>} */
  async connect(_artistId, _context = {}) {
    throw new Error(`connect() not implemented for ${this.platformId}`);
  }

  /** @returns {Promise<{ accessToken?: string, refreshToken?: string, expiresAt?: Date }>} */
  async refresh(_connection) {
    throw new Error(`refresh() not implemented for ${this.platformId}`);
  }

  /** @returns {Promise<{ metrics?: object, accountName?: string, accountId?: string, followers?: number, verified?: boolean }>} */
  async syncAnalytics(_artistId, _connection) {
    throw new Error(`syncAnalytics() not implemented for ${this.platformId}`);
  }

  /** @returns {{ status: string, lastError?: string|null, lastSync?: Date|null }} */
  getHealth(connection) {
    if (!connection) {
      return { status: 'disconnected', lastError: null, lastSync: null };
    }
    if (connection.lastError) {
      return { status: 'error', lastError: connection.lastError, lastSync: connection.lastSyncedAt || null };
    }
    if (connection.status === 'expired') {
      return { status: 'expired', lastError: connection.lastError || 'Token expired', lastSync: connection.lastSyncedAt || null };
    }
    if (connection.status === 'pending_reauth') {
      return { status: 'pending', lastError: connection.lastError || null, lastSync: connection.lastSyncedAt || null };
    }
    return { status: 'active', lastError: null, lastSync: connection.lastSyncedAt || null };
  }
}

module.exports = ConnectionProvider;
