const gmailAdapter = require('./gmailAdapter');

module.exports = {
  id: 'google_sheets',
  getClientCreds: gmailAdapter.getClientCreds,
  handleCallback: gmailAdapter.handleCallback,
  refreshToken: gmailAdapter.refreshToken,
  async healthCheck(credentials) {
    return gmailAdapter.healthCheck(credentials);
  },
};
