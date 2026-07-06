require('dotenv').config();

require('./instrument');

const { loadConfig } = require('./config');
loadConfig();

const { initPostHog } = require('./utils/posthog');
initPostHog();

require('./services/onboardingListener');

const { createApp } = require('./app/createApp');
const { registerRoutes } = require('./app/registerRoutes');
const { startServer } = require('./app/startServer');

const app = createApp();
registerRoutes(app);
startServer(app);

module.exports = app;
