const ConnectionProvider = require('./ConnectionProvider');

class StubProvider extends ConnectionProvider {
  constructor(platformId, { connectMethod = 'coming_soon' } = {}) {
    super(platformId);
    this.connectMethod = connectMethod;
  }

  async connect() {
    return { status: 'coming_soon' };
  }

  async refresh() {
    return { status: 'coming_soon' };
  }

  async syncAnalytics() {
    return { status: 'coming_soon' };
  }

  getHealth() {
    return {
      status: this.connectMethod === 'manual' ? 'manual' : 'coming_soon',
      lastError: null,
      lastSync: null,
    };
  }
}

module.exports = StubProvider;
